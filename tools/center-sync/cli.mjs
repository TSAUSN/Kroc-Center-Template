#!/usr/bin/env node
// Center sync — Path A of the 11-12 architecture call: one template repo, many
// center instances. Models live in schema/models/*.json (exported from the
// main instance), code in webengine/, and both are pushed to every center
// listed in centers.json. Design + rules: docs/center-sync.md.
//
//   node tools/center-sync/cli.mjs export [model…]           main instance → schema/models/
//   node tools/center-sync/cli.mjs deploy --branch stage|production [--center id]
//        [--since <sha> | --full] [--dry-run] [--report out.md]
//        stage:      models (additive) then code saved to each center's dev version
//        production: dev → live for the changed code; deletes views of deleted files
//   node tools/center-sync/cli.mjs schema [--center id] [--removals] [--prune] [--dry-run]
//        by hand only: --removals applies schema/removed.json; --prune makes a
//        center match schema/ exactly (deletes extras, recreates type conflicts)
//
// Tokens: each center's `tokenEnv` names an env var (in CI, a repo secret
// passed through CENTER_SECRETS). The main instance's token is
// $ZESTY_TOKEN_MAIN or the VS Code extension's token in .vscode/settings.json.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { client } from "./zesty.mjs";
import { readInstance, modelSpec, planSchema, applySchema, describeOp, secretsIn } from "./schema.mjs";
import { manifest, changedPaths, readCode, planCode, applyCode } from "./code.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCHEMA_DIR = join(ROOT, "schema", "models");
const REMOVED = join(ROOT, "schema", "removed.json");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
};
const VALUED = new Set(["--branch", "--center", "--since", "--report"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !VALUED.has(argv[i - 1]));
const [CMD, ...ARGS] = positional;
const DRY = flag("dry-run") || Boolean(opt("report"));

const config = JSON.parse(readFileSync(join(ROOT, "centers.json"), "utf8"));
const log = (s = "") => {
  console.log(s);
};

function tokenFor(entry) {
  const secrets = process.env.CENTER_SECRETS ? JSON.parse(process.env.CENTER_SECRETS) : {};
  return process.env[entry.tokenEnv] || secrets[entry.tokenEnv];
}

function mainClient() {
  let token = process.env.ZESTY_TOKEN_MAIN;
  const settings = join(ROOT, ".vscode", "settings.json");
  if (!token && existsSync(settings)) {
    const raw = readFileSync(settings, "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
    token = JSON.parse(raw)["zesty.editor.token"];
  }
  return client({ id: config.main.id, zuid: config.main.zuid, token });
}

function centers() {
  const only = opt("center");
  const list = config.centers.filter((c) => !only || c.id === only);
  if (only && list.length === 0) throw new Error(`no center "${only}" in centers.json`);
  return list;
}

function loadSchema() {
  if (!existsSync(SCHEMA_DIR)) throw new Error("schema/models/ is missing: run export first");
  return readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(SCHEMA_DIR, f), "utf8")));
}
const loadRemoved = () => (existsSync(REMOVED) ? JSON.parse(readFileSync(REMOVED, "utf8")) : {});

// ---------- export ----------

async function cmdExport(names) {
  const c = mainClient();
  const state = await readInstance(c);
  const exclude = new Set(config.schemaExclude || []);
  const models = state.models.filter((m) => (names.length ? names.includes(m.name) : !exclude.has(m.name)));
  if (names.length && models.length !== names.length) {
    const missing = names.filter((n) => !models.some((m) => m.name === n));
    throw new Error(`not on the main instance: ${missing.join(", ")}`);
  }
  mkdirSync(SCHEMA_DIR, { recursive: true });
  const problems = [];
  for (const m of models.sort((a, b) => a.name.localeCompare(b.name))) {
    const spec = modelSpec(state, m);
    const secrets = secretsIn(spec);
    if (secrets.length) {
      problems.push(`${m.name}: looks like it holds a credential (${secrets.join(", ")}); not written. Add it to schemaExclude or clean it on the main instance.`);
      continue;
    }
    const unresolved = JSON.stringify(spec).match(/unresolved:[\w-]+/g) || [];
    if (m.parentZUID && m.parentZUID !== "0" && !spec.parent) unresolved.push(`parent ${m.parentZUID}`);
    if (unresolved.length) log(`  ! ${m.name}: points at something that no longer exists (${[...new Set(unresolved)].join(", ")}); exported without it`);
    writeFileSync(join(SCHEMA_DIR, `${m.name}.json`), JSON.stringify(spec, null, 2) + "\n");
  }
  log(`Exported ${models.length - problems.length} model(s) from ${config.main.id} to schema/models/.`);
  if (!names.length) {
    const onMain = new Set(state.models.map((m) => m.name));
    const stale = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".json") && !onMain.has(f.slice(0, -5)));
    if (stale.length) log(`  ! in schema/ but not on ${config.main.id}: ${stale.join(", ")} (removed? list it in schema/removed.json)`);
  }
  if (problems.length) throw new Error(problems.join("\n"));
}

// ---------- schema ----------

function schemaPlanFor(state) {
  return planSchema(loadSchema(), state, { removed: loadRemoved(), exclude: config.schemaExclude || [] });
}

// Prune and additive ops can name the same field; when pruning, a conflict's
// remove+add replaces the plain add of the additive pass.
function gatesFor({ removals, prune }) {
  const gates = ["additive"];
  if (removals) gates.push("removals");
  if (prune) gates.push("prune");
  return gates;
}

async function runSchema(center, c, { removals = false, prune = false } = {}) {
  const state = await readInstance(c);
  const ops = schemaPlanFor(state);
  const gates = gatesFor({ removals, prune });
  const doing = ops.filter((o) => gates.includes(o.gate));
  const reported = ops.filter((o) => o.gate === "report");
  const later = ops.filter((o) => !gates.includes(o.gate) && o.gate !== "report");
  log(`  models: ${doing.length} change(s), ${reported.length} to review, ${later.filter((o) => o.gate === "removals").length} removal(s) pending`);
  for (const o of reported) log(`    ? ${describeOp(o).replace(/\*\*/g, "")}`);
  const result = await applySchema(c, state, ops, { gates, dry: DRY, log: (s) => log(`  ${s}`) });
  return { ops, gates, reported, later, ...result };
}

// ---------- deploy ----------

async function cmdDeploy() {
  const branch = opt("branch");
  if (!["stage", "production"].includes(branch)) throw new Error("--branch stage|production");
  const schema = loadSchema();
  const files = manifest(ROOT, { exclude: config.codeExclude || [], modelNames: new Set(schema.map((s) => s.name)) });
  const scope = flag("full") ? null : changedPaths(ROOT, opt("since") ?? process.env.DIFF_BASE, process.env.DIFF_HEAD || "HEAD");
  log(`Center sync → ${branch}${DRY ? " (dry run)" : ""}: ${scope ? `${scope.changed.size} changed / ${scope.deleted.length} deleted file(s)` : `all ${files.length} files`}`);

  const report = [];
  let failed = 0;
  for (const center of centers()) {
    log(`\n■ ${center.id} (${center.zuid})`);
    const section = { center, schema: null, code: null, errors: [] };
    report.push(section);
    try {
      const c = client({ id: center.id, zuid: center.zuid, token: tokenFor(center) });
      if (branch === "stage") {
        section.schema = await runSchema(center, c);
        section.errors.push(...section.schema.errors);
        if (section.schema.errors.length) {
          log("  code skipped: the model step failed, and code must not reach a center before its models");
          failed++;
          continue;
        }
      }
      const remote = await readCode(c);
      // In a dry run the models aren't created yet; their views will be.
      const pendingModels = new Set(
        DRY && section.schema
          ? section.schema.ops.filter((o) => o.op === "create-model" && section.schema.gates.includes(o.gate)).map((o) => o.model)
          : []
      );
      const ops = planCode(ROOT, files, remote, { mode: branch, scope, pendingModels });
      section.code = ops;
      const count = (op) => ops.filter((o) => o.op === op).length;
      log(`  code: ${count("create")} create, ${count("save")} save, ${count("publish")} publish, ${count("delete")} delete, ${count("unchanged")} unchanged, ${count("skip")} skipped, ${count("error")} error(s)`);
      for (const o of ops.filter((o) => o.op === "skip")) log(`    - ${o.file.path}: ${o.detail}`);
      const res = await applyCode(c, ops, { dry: DRY, log: (s) => log(`  ${s}`) });
      section.errors.push(...res.errors);
      if (res.errors.length) failed++;
    } catch (e) {
      section.errors.push(e.message);
      log(`  ✗ ${e.message}`);
      failed++;
    }
  }
  if (opt("report")) writeFileSync(opt("report"), reportMarkdown(branch, scope, report));
  if (failed && !DRY) process.exitCode = 1;
  if (failed && DRY) log(`\n${failed} center(s) would fail — see above.`);
}

async function cmdSchema() {
  const removals = flag("removals");
  const prune = flag("prune");
  let failed = 0;
  for (const center of centers()) {
    log(`\n■ ${center.id} (${center.zuid})${prune ? " — prune" : ""}${removals ? " — removals" : ""}${DRY ? " (dry run)" : ""}`);
    const c = client({ id: center.id, zuid: center.zuid, token: tokenFor(center) });
    const res = await runSchema(center, c, { removals, prune });
    if (res.errors.length) failed++;
  }
  if (failed) process.exitCode = 1;
}

// ---------- PR comment ----------

function reportMarkdown(branch, scope, sections) {
  const out = [`### Center sync preview → \`${branch}\``, ""];
  out.push(scope ? `Changed in this PR: ${scope.changed.size} file(s), deleted: ${scope.deleted.length}.` : "Full sync (no diff base).", "");
  for (const s of sections) {
    out.push(`#### ${s.center.label || s.center.id} \`${s.center.zuid}\``);
    if (s.schema) {
      const doing = s.schema.ops.filter((o) => s.schema.gates.includes(o.gate));
      out.push(`**Models (applied at merge):** ${doing.length ? "" : "_no change_"}`);
      for (const o of doing) out.push(`- ${describeOp(o)}`);
      if (s.schema.reported.length) {
        out.push("", "**Needs a person (not applied):**");
        for (const o of s.schema.reported) out.push(`- ${describeOp(o)}`);
      }
      const pending = s.schema.later.filter((o) => o.gate === "removals");
      if (pending.length) {
        out.push("", "**Removals waiting for the manual run after production:**");
        for (const o of pending) out.push(`- ${describeOp(o)}`);
      }
      out.push("");
    }
    if (s.code) {
      const show = s.code.filter((o) => !["unchanged"].includes(o.op));
      out.push(`**Code:** ${show.length ? "" : "_no change_"}`);
      for (const o of show.slice(0, 60)) out.push(`- ${o.op} \`${o.file.path}\`${o.detail ? ` — ${o.detail}` : ""}`);
      if (show.length > 60) out.push(`- …and ${show.length - 60} more`);
    }
    if (s.errors.length) {
      out.push("", "**Would fail:**");
      for (const e of s.errors) out.push(`- ${e}`);
    }
    out.push("");
  }
  out.push("<!-- center-sync-report -->");
  return out.join("\n") + "\n";
}

// ---------- main ----------

const COMMANDS = { export: () => cmdExport(ARGS), deploy: cmdDeploy, schema: cmdSchema };
const fn = COMMANDS[CMD];
if (!fn) {
  console.error("usage: cli.mjs export [model…] | deploy --branch stage|production | schema [--removals] [--prune]");
  process.exit(2);
}
fn().catch((e) => {
  console.error(`center-sync: ${e.message}`);
  process.exit(1);
});
