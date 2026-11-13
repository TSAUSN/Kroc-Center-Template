// Code as files: webengine/{views,styles,scripts} → each center's instance.
// Content.One's sync (github.com/contentdotone/website, scripts/sync-to-zesty.js)
// is the model: stage saves to the dev version, production publishes dev →
// live. The difference: it maps files to view ZUIDs in zesty.config.json,
// which only fits one instance (and is gitignored here), so this finds each
// center's view by its fileName instead.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { mapLimit } from "./zesty.mjs";

const SECTIONS = { views: "views", styles: "stylesheets", scripts: "scripts" };
// Zesty's generated stub for a block model whose template hasn't been written.
// Each instance generates its own (with a link to its own Manager), so the
// main instance's stub is never copied over it.
const PLACEHOLDER = "Template File is empty";

const norm = (s) => (s == null ? "" : String(s).replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n+$/, ""));

export function globToRegex(glob) {
  const re = glob
    .split("**")
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]"))
    .join(".*");
  return new RegExp(`^${re}$`);
}

// The fileName Zesty keys a file by: views with an extension (or in a folder)
// get a leading "/" ("/components/hero.jsx"); bare views don't ("loader").
// Stylesheets and scripts are bare ("main.less").
function fileNameFor(section, rel) {
  if (section !== "views") return rel;
  return extname(rel) || rel.includes("/") ? `/${rel}` : rel;
}

// What a missing file would be created as. Views that belong to a model
// (block views, page views named after their model) come from creating the
// model, never from the code sync.
function kindFor(section, rel, modelNames) {
  const ext = extname(rel).toLowerCase();
  if (section === "styles") return { type: ext === ".css" ? "text/css" : ext === ".scss" ? "text/scss" : "text/less" };
  if (section === "scripts") return { type: "text/javascript" };
  const block = rel.match(/^-\/block\/(.+)\.html$/);
  if (block) return { model: block[1] };
  if (!ext && modelNames.has(rel)) return { model: rel };
  return { type: ext ? "ajax-json" : "snippet" };
}

function walk(dir, base = "") {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(join(dir, e.name), rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

// Every syncable file: [{ section, endpoint, path (repo-relative), fileName, kind }]
export function manifest(root, { exclude = [], modelNames = new Set() } = {}) {
  const skip = exclude.map(globToRegex);
  const files = [];
  for (const [section, endpoint] of Object.entries(SECTIONS)) {
    for (const rel of walk(join(root, "webengine", section))) {
      const inWebengine = `${section}/${rel}`;
      if (skip.some((re) => re.test(inWebengine))) continue;
      files.push({
        section,
        endpoint,
        rel,
        path: `webengine/${inWebengine}`,
        fileName: fileNameFor(section, rel),
        kind: kindFor(section, rel, modelNames)
      });
    }
  }
  return files;
}

// Files a push changed, from git. null = no usable base (first push, manual
// run): the caller syncs everything.
export function changedPaths(root, base, head = "HEAD") {
  if (!base || /^0+$/.test(base)) return null;
  try {
    const out = execFileSync("git", ["diff", "--name-status", "--no-renames", base, head, "--", "webengine"], {
      cwd: root,
      encoding: "utf8"
    });
    const changed = new Set();
    const deleted = [];
    for (const line of out.split("\n").filter(Boolean)) {
      const [status, path] = line.split("\t");
      if (status === "D") deleted.push(path);
      else changed.add(path);
    }
    return { changed, deleted };
  } catch {
    return null;
  }
}

// fileName → { zuid, dev: {code, version}, live: {code, version} } per section.
export async function readCode(c) {
  const out = {};
  await mapLimit(Object.entries(SECTIONS), 3, async ([section, endpoint]) => {
    const map = new Map();
    for (const status of ["dev", "live"]) {
      const rows = (await c.api("GET", `web/${endpoint}?status=${status}`)) || [];
      for (const r of rows) {
        if (r.status && r.status !== status) continue;
        const entry = map.get(r.fileName) || { zuid: r.ZUID, type: r.type };
        entry[status] = { code: r.code, version: r.version };
        map.set(r.fileName, entry);
      }
    }
    out[section] = map;
  });
  return out;
}

const PATH_TO_FILE = (files) => new Map(files.map((f) => [f.path, f]));

// mode "stage": save changed files to dev (create the plain ones that are missing).
// mode "production": publish dev → live for changed files; delete views whose
// file was deleted (the code that used them is live by then).
export function planCode(root, files, remote, { mode, scope, pendingModels = new Set() }) {
  const ops = [];
  const byPath = PATH_TO_FILE(files);
  const inScope = scope ? files.filter((f) => scope.changed.has(f.path)) : files;

  for (const f of inScope) {
    const code = readFileSync(join(root, f.path), "utf8");
    const there = remote[f.section].get(f.fileName);
    if (mode === "stage") {
      if (code.includes(PLACEHOLDER) && f.kind.model) {
        ops.push({ op: "skip", file: f, detail: "unbuilt block placeholder; the center keeps its own" });
      } else if (!there && f.kind.model && pendingModels.has(f.kind.model)) {
        // dry run only: the model step creates it (and its view) first
        ops.push({ op: "save", file: f, code, detail: `once model "${f.kind.model}" is created` });
      } else if (!there) {
        ops.push(
          f.kind.model
            ? { op: "error", file: f, detail: `belongs to model "${f.kind.model}", which isn't on the center` }
            : { op: "create", file: f, code }
        );
      } else if (norm(there.dev?.code) === norm(code)) {
        ops.push({ op: "unchanged", file: f });
      } else {
        ops.push({ op: "save", file: f, code, zuid: there.zuid, type: there.type });
      }
    } else {
      if (code.includes(PLACEHOLDER) && f.kind.model) {
        ops.push({ op: "skip", file: f, detail: "unbuilt block placeholder" });
      } else if (!there?.dev) {
        ops.push({ op: "error", file: f, detail: "not on the center's dev version; merge it through stage first" });
      } else if (norm(there.dev.code) !== norm(code)) {
        ops.push({ op: "error", file: f, detail: "the center's dev version differs from this commit; merge it through stage first" });
      } else if (there.live && norm(there.live.code) === norm(there.dev.code)) {
        ops.push({ op: "unchanged", file: f, detail: "already live" });
      } else {
        ops.push({ op: "publish", file: f, zuid: there.zuid, version: there.dev.version });
      }
    }
  }

  for (const path of scope?.deleted || []) {
    if (byPath.has(path)) continue; // re-added
    const [, section, ...restParts] = path.split("/");
    const rel = restParts.join("/");
    if (!SECTIONS[section]) continue;
    const fileName = fileNameFor(section, rel);
    const there = remote[section].get(fileName);
    const f = { section, endpoint: SECTIONS[section], rel, path, fileName, kind: kindFor(section, rel, new Set()) };
    if (!there) continue;
    if (f.kind.model) ops.push({ op: "skip", file: f, detail: "model view: goes when the model is removed" });
    else if (mode === "stage") ops.push({ op: "skip", file: f, detail: "deleted in git; removed from the center at the production merge" });
    else ops.push({ op: "delete", file: f, zuid: there.zuid });
  }
  return ops;
}

export async function applyCode(c, ops, { dry, log }) {
  const errors = [];
  for (const o of ops) {
    const f = o.file;
    const label = `${o.op} ${f.path}`;
    if (o.op === "error") {
      errors.push(`${f.path}: ${o.detail}`);
      log(`  ✗ ${f.path}: ${o.detail}`);
      continue;
    }
    if (!["create", "save", "publish", "delete"].includes(o.op)) continue;
    if (dry) {
      log(`  [dry-run] ${label}`);
      continue;
    }
    try {
      const ep = `web/${f.endpoint}`;
      if (o.op === "create") {
        // Creating a view publishes it at once (v1 is live). Create it blank,
        // then save the real code as v2, so live stays blank until the
        // production merge publishes v2 — the same gate as every other file.
        const data = await c.api("POST", ep, { filename: f.fileName, type: f.kind.type, code: " " });
        const body = f.section === "views" ? { code: o.code || " " } : { filename: f.fileName, code: o.code || " ", type: f.kind.type };
        await c.api("PUT", `${ep}/${data.ZUID}`, body);
        log(`  ✓ ${label} → ${data.ZUID} (live stays blank until production)`);
        continue;
      }
      if (o.op === "save") {
        const body = f.section === "views" ? { code: o.code || " " } : { filename: f.fileName, code: o.code || " ", type: o.type };
        await c.api("PUT", `${ep}/${o.zuid}`, body);
      }
      if (o.op === "publish") await c.api("POST", `${ep}/${o.zuid}/versions/${o.version}?purge_cache=true`, {});
      if (o.op === "delete") await c.api("DELETE", `${ep}/${o.zuid}`);
      log(`  ✓ ${label}`);
    } catch (e) {
      errors.push(`${label}: ${e.message}`);
      log(`  ✗ ${label}: ${e.message}`);
    }
  }
  return { errors };
}
