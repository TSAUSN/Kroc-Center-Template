// Pushes local webengine/ changes to the Zesty instance's dev versions. The
// VS Code extension only uploads on an editor save, so files written by
// scripts (build:css, format), git or Claude never reach the instance.
//
// Uses the extension's own setup: zesty.config.json (instance ZUID + the
// file → ZUID map a "Sync to Instance" writes) and the developer token from
// .vscode/settings.json ("zesty.editor.token"), or $ZESTY_TOKEN.
//
// Safety: each file gets a three-way check against the last content both
// sides agreed on (kept in .zesty-sync.json). If the instance copy changed
// since then (someone edited it in the Manager) and the local copy differs
// too, it is reported as a conflict and not pushed. A scan that finds more
// than MANY_FILES changes (a branch switch, a stash) pushes nothing until
// told to. Nothing is ever deleted on the instance; new views are created only
// by an explicit `push` (a scan just reports them), never block/model views
// (views/-/…); gitignored paths are skipped.
//
// Usage:
//   node tools/zesty-sync.mjs status          compare every file (writes nothing to the instance)
//   node tools/zesty-sync.mjs push <file…>    push these files; --force overrides a conflict
//   node tools/zesty-sync.mjs scan            push files modified since the last scan;
//                                             --allow-many lifts the MANY_FILES guard
//   node tools/zesty-sync.mjs init            re-baseline from the instance (drops pending changes)
//   node tools/zesty-sync.mjs hook            scan, as a Claude Code PostToolUse hook
//   --dry-run on push/scan reports without writing.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  readdirSync,
  openSync,
  closeSync,
  unlinkSync
} from "node:fs";
import { join, relative, resolve, extname, sep } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1");
const WEBENGINE = join(ROOT, "webengine");
const CONFIG_PATH = join(ROOT, "zesty.config.json");
const SETTINGS_PATH = join(ROOT, ".vscode", "settings.json");
const STATE_PATH = join(ROOT, ".zesty-sync.json");
const LOCK_PATH = join(ROOT, ".zesty-sync.lock");

const KINDS = ["views", "styles", "scripts"]; // webengine/<kind>/ and the config map's keys
const API = { views: "views", styles: "stylesheets", scripts: "scripts" };
const MANY_FILES = 15;
const CONCURRENCY = 4;

const argv = process.argv.slice(2);
const CMD = argv[0];
const FORCE = argv.includes("--force");
const DRY = argv.includes("--dry-run");
const ALLOW_MANY = argv.includes("--allow-many");
const FILE_ARGS = argv.slice(1).filter((a) => !a.startsWith("--"));

class SyncError extends Error {}

// ---------- setup ----------

function readJsonc(path) {
  const text = readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(text);
}

function loadToken() {
  if (process.env.ZESTY_TOKEN) return process.env.ZESTY_TOKEN;
  if (!existsSync(SETTINGS_PATH)) return "";
  return readJsonc(SETTINGS_PATH)["zesty.editor.token"] || "";
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  if (!config.instance_zuid) return null;
  config.instance ||= {};
  for (const kind of KINDS) config.instance[kind] ||= {};
  return config;
}

function loadState() {
  if (!existsSync(STATE_PATH)) return null;
  return JSON.parse(readFileSync(STATE_PATH, "utf8"));
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

const sha = (text) => createHash("sha256").update(text).digest("hex");

// ---------- API ----------

let TOKEN = "";
let BASE_URL = "";

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (res.status === 401) {
    throw new SyncError(
      "developer token rejected (expired?). Re-enter it with the extension's Sync to Instance."
    );
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new SyncError(`${method} ${path} → ${res.status} ${json.error || json.message || ""}`.trim());
  }
  return json.data;
}

// ---------- file ↔ instance mapping ----------

// The extension keys views by the instance fileName: a leading "/" when the
// name has an extension ("/components/hero.jsx"), none when it doesn't
// ("loader"). Styles and scripts are keyed by the bare name.
function locate(absPath, config, state) {
  const rel = relative(WEBENGINE, absPath).split(sep).join("/");
  if (rel.startsWith("..")) return null;
  const [kind, ...rest] = rel.split("/");
  if (!KINDS.includes(kind) || rest.length === 0) return null;
  const name = rest.join("/");
  const map = { ...state.created[kind], ...config.instance[kind] };
  const keys = kind === "views" ? [`/${name}`, name] : [name];
  const key = keys.find((k) => map[k]) ?? (kind === "views" && extname(name) ? `/${name}` : name);
  return { kind, name, key, entry: map[key], stateKey: `${kind}:${key}`, display: `${kind}/${name}` };
}

function localPathFor(kind, key) {
  return join(WEBENGINE, kind, key.replace(/^\//, ""));
}

function gitIgnored(absPaths) {
  if (absPaths.length === 0) return new Set();
  try {
    const out = execFileSync("git", ["check-ignore", "--stdin"], {
      cwd: ROOT,
      input: absPaths.map((p) => relative(ROOT, p)).join("\n"),
      encoding: "utf8"
    });
    return new Set(out.split("\n").filter(Boolean).map((p) => resolve(ROOT, p)));
  } catch (e) {
    if (e.status === 1) return new Set(); // nothing ignored
    throw e;
  }
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

function localFiles() {
  return KINDS.flatMap((kind) => walk(join(WEBENGINE, kind)));
}

async function fetchRemoteCode(kind, zuid) {
  const data = await api("GET", `${API[kind]}/${zuid}`);
  return data.code ?? "";
}

async function fetchAllRemote(config) {
  const byZuid = {};
  for (const kind of KINDS) {
    const list = await api("GET", API[kind]);
    for (const item of list) if (item.status === "dev") byZuid[item.ZUID] = item.code ?? "";
  }
  return byZuid;
}

// ---------- sync one file ----------

async function syncFile(absPath, ctx, { scanMode }) {
  const { config, state } = ctx;
  const loc = locate(absPath, config, state);
  if (!loc) return null;
  const out = (result, note = "") => ({ file: loc.display, result, note });

  if (!loc.entry) {
    if (loc.kind !== "views") return out("skipped", "not on the instance; only views are created");
    if (loc.name.startsWith("-/")) {
      return out("skipped", "block/model views come from Zesty: create the model, then sync down");
    }
    // Creating adds a public endpoint, so it is never a side effect of a scan.
    if (scanMode) return out("new", `not on the instance; create it with: node tools/zesty-sync.mjs push ${relative(ROOT, absPath)}`);
  }

  const code = readFileSync(absPath, "utf8");
  const local = sha(code);
  const base = state.base[loc.stateKey];

  if (!loc.entry) {
    if (DRY) return out("would-create");
    const type = extname(loc.name) ? "ajax-json" : "snippet"; // same rule as the extension
    const data = await api("POST", API.views, { filename: loc.key, type, code: code || " " });
    const entry = { zuid: data.ZUID, type: data.type, updatedAt: data.updatedAt, createdAt: data.createdAt };
    state.created.views[loc.key] = entry;
    config.instance.views[loc.key] = entry;
    ctx.configDirty = true;
    state.base[loc.stateKey] = local;
    return out("created", `${type} ${data.ZUID}`);
  }

  // Unchanged since both sides last agreed: nothing to send.
  if (scanMode && base === local) return out("unchanged");

  const remote = sha(await fetchRemoteCode(loc.kind, loc.entry.zuid));
  if (remote === local) {
    state.base[loc.stateKey] = local;
    return out("in-sync");
  }
  if (!FORCE && base && remote !== base) {
    return base === local
      ? out("remote-newer", "changed on the instance; local copy is stale (sync down)")
      : out("conflict", "changed both locally and on the instance; not pushed (push --force to overwrite)");
  }
  if (DRY) return out("would-push");

  const body =
    loc.kind === "views"
      ? { code: code || " " }
      : { filename: loc.key, code: code || " ", type: loc.entry.type };
  await api("PUT", `${API[loc.kind]}/${loc.entry.zuid}`, body);
  state.base[loc.stateKey] = local;
  return out("pushed", loc.entry.zuid);
}

async function syncAll(paths, ctx, opts) {
  const results = [];
  const queue = [...paths];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      try {
        const r = await syncFile(p, ctx, opts);
        if (r) results.push(r);
      } catch (e) {
        if (!(e instanceof SyncError) && e.code !== "ENOENT") throw e;
        results.push({ file: relative(WEBENGINE, p), result: "error", note: e.message });
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results.sort((a, b) => a.file.localeCompare(b.file));
}

// ---------- commands ----------

async function baseline(config) {
  const remote = await fetchAllRemote(config);
  const state = { lastScan: Date.now(), base: {}, created: { views: {}, styles: {}, scripts: {} } };
  for (const kind of KINDS) {
    for (const [key, entry] of Object.entries(config.instance[kind])) {
      if (entry.zuid in remote) state.base[`${kind}:${key}`] = sha(remote[entry.zuid]);
    }
  }
  return state;
}

async function scan(ctx) {
  const started = Date.now();
  const files = localFiles().filter((p) => statSync(p).mtimeMs > ctx.state.lastScan);
  const ignored = gitIgnored(files);
  const candidates = files.filter((p) => !ignored.has(p));

  // Only files whose content actually moved count toward the guard.
  const moved = candidates.filter((p) => {
    const loc = locate(p, ctx.config, ctx.state);
    return loc && ctx.state.base[loc.stateKey] !== sha(readFileSync(p, "utf8"));
  });
  if (moved.length > MANY_FILES && !ALLOW_MANY) {
    return {
      guard: moved.length,
      results: [],
      sample: moved.slice(0, 8).map((p) => relative(WEBENGINE, p))
    };
  }
  const results = await syncAll(moved, ctx, { scanMode: true });
  if (!DRY) ctx.state.lastScan = started;
  return { results };
}

async function status(ctx) {
  const remote = await fetchAllRemote(ctx.config);
  const rows = [];
  for (const kind of KINDS) {
    const map = { ...ctx.state.created[kind], ...ctx.config.instance[kind] };
    for (const [key, entry] of Object.entries(map)) {
      const path = localPathFor(kind, key);
      const display = `${kind}/${key.replace(/^\//, "")}`;
      if (!(entry.zuid in remote)) {
        rows.push([display, "not on instance", "mapped ZUID has no dev version"]);
        continue;
      }
      if (!existsSync(path)) {
        rows.push([display, "missing locally", ""]);
        continue;
      }
      const L = sha(readFileSync(path, "utf8"));
      const R = sha(remote[entry.zuid]);
      const B = ctx.state.base[`${kind}:${key}`];
      if (L === R) {
        ctx.state.base[`${kind}:${key}`] = L;
        continue;
      }
      if (!B) rows.push([display, "differs", "no baseline: direction unknown"]);
      else if (R === B) rows.push([display, "local change", "push"]);
      else if (L === B) rows.push([display, "instance change", "sync down"]);
      else rows.push([display, "CONFLICT", "changed on both sides"]);
    }
  }
  const all = localFiles();
  const ignored = gitIgnored(all);
  for (const p of all) {
    if (ignored.has(p)) continue;
    const loc = locate(p, ctx.config, ctx.state);
    if (loc && !loc.entry) rows.push([loc.display, "local only", loc.kind === "views" ? "would create" : "skipped"]);
  }
  return rows.sort((a, b) => a[0].localeCompare(b[0]));
}

function summarise(results) {
  const notable = results.filter((r) => !["unchanged", "in-sync"].includes(r.result));
  return notable.map((r) => `${r.result}: ${r.file}${r.note ? ` (${r.note})` : ""}`);
}

// One run at a time: parallel tool calls fire parallel hooks.
async function withLock(fn) {
  const deadline = Date.now() + 45_000;
  for (;;) {
    try {
      closeSync(openSync(LOCK_PATH, "wx"));
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      if (Date.now() - statSync(LOCK_PATH, { throwIfNoEntry: false })?.mtimeMs > 120_000) {
        unlinkSync(LOCK_PATH); // stale lock from a killed run
        continue;
      }
      if (Date.now() > deadline) throw new SyncError("another zesty-sync run is still holding the lock");
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  try {
    return await fn();
  } finally {
    try {
      unlinkSync(LOCK_PATH);
    } catch {}
  }
}

async function main() {
  const config = loadConfig();
  TOKEN = loadToken();
  if (!config || !TOKEN) {
    if (CMD === "hook") return; // not set up on this machine: stay silent
    throw new SyncError("needs zesty.config.json with instance_zuid and a developer token");
  }
  BASE_URL = `https://${config.instance_zuid}.api.zesty.io/v1/web`;

  await withLock(async () => {
    const ctx = { config, state: loadState(), configDirty: false };
    let fresh = false;
    if (!ctx.state || CMD === "init") {
      ctx.state = await baseline(config);
      fresh = true;
    }

    if (CMD === "init") {
      saveState(ctx.state);
      console.log(`Baselined ${Object.keys(ctx.state.base).length} files from the instance.`);
    } else if (CMD === "status") {
      const rows = await status(ctx);
      saveState(ctx.state);
      if (rows.length === 0) console.log("Everything matches the instance's dev versions.");
      for (const [file, what, note] of rows) console.log(`${what.padEnd(16)} ${file}${note ? `  — ${note}` : ""}`);
    } else if (CMD === "push") {
      if (FILE_ARGS.length === 0) throw new SyncError("push needs one or more files");
      const results = await syncAll(FILE_ARGS.map((f) => resolve(f)), ctx, { scanMode: false });
      if (!DRY) saveState(ctx.state);
      for (const r of results) console.log(`${r.result.padEnd(13)} ${r.file}${r.note ? `  — ${r.note}` : ""}`);
    } else if (CMD === "scan" || CMD === "hook") {
      const { results, guard, sample } = await scan(ctx);
      if (!DRY) saveState(ctx.state);
      const lines = guard
        ? [
            `${guard} files under webengine/ changed at once (e.g. ${sample.join(", ")}); nothing pushed. ` +
              `If they should go to the instance: node tools/zesty-sync.mjs scan --allow-many. ` +
              `To drop them: node tools/zesty-sync.mjs init.`
          ]
        : summarise(results);
      if (fresh && CMD === "scan") lines.unshift("(first run: baselined from the instance)");
      if (CMD === "hook") emitHook(lines, results);
      else console.log(lines.length ? lines.join("\n") : "Nothing to push.");
    } else {
      throw new SyncError(`unknown command "${CMD ?? ""}" (status | push | scan | init | hook)`);
    }

    if (ctx.configDirty) writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
  });
}

function emitHook(lines, results) {
  if (lines.length === 0) return;
  const pushed = results.filter((r) => r.result === "pushed" || r.result === "created").map((r) => r.file);
  const problems = lines.length - pushed.length;
  const user = [
    pushed.length ? `Synced to Zesty: ${pushed.join(", ")}` : "",
    problems ? `Zesty sync: ${problems} file(s) need attention` : ""
  ]
    .filter(Boolean)
    .join(" · ");
  process.stdout.write(
    JSON.stringify({
      systemMessage: user,
      hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `zesty-sync:\n${lines.join("\n")}` }
    })
  );
}

main().catch((e) => {
  if (CMD === "hook") {
    // Never break the tool call; tell Claude what happened instead.
    const msg = e instanceof SyncError ? e.message : e.stack;
    emitHook([`error: ${msg}`], []);
    process.exit(0);
  }
  console.error(`zesty-sync: ${e instanceof SyncError ? e.message : e.stack}`);
  process.exit(1);
});
