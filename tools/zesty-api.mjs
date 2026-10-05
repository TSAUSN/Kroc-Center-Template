// Shared setup for the Zesty API tools (zesty-model.mjs, zesty-variant.mjs):
// the instance ZUID from zesty.config.json and the VS Code extension's
// developer token (.vscode/settings.json "zesty.editor.token", or
// $ZESTY_TOKEN), plus the model lookups and the instance → local pull every
// API write ends with.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

export const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1");
const CONFIG_PATH = join(ROOT, "zesty.config.json");
const SETTINGS_PATH = join(ROOT, ".vscode", "settings.json");

export class UsageError extends Error {}

function readJsonc(path) {
  return JSON.parse(
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/,(\s*[}\]])/g, "$1")
  );
}

const config = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, "utf8")) : {};
const TOKEN =
  process.env.ZESTY_TOKEN ||
  (existsSync(SETTINGS_PATH) ? readJsonc(SETTINGS_PATH)["zesty.editor.token"] : "");
const API = `https://${config.instance_zuid}.api.zesty.io/v1`;
export const INSTANCE_ZUID = config.instance_zuid;
// For the hosts api() doesn't cover (accounts.api.zesty.io).
export const authHeaders = () => ({ Authorization: `Bearer ${TOKEN}` });

export function requireSetup() {
  if (!config.instance_zuid || !TOKEN) {
    throw new UsageError("needs zesty.config.json with instance_zuid and a developer token");
  }
}

export async function api(method, path, body) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (res.status === 401) throw new UsageError("developer token rejected (expired?)");
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new UsageError(`${method} ${path} → ${res.status} ${json.error || json.message || ""}`.trim());
  }
  return json.data;
}

let modelsCache;
export async function models({ fresh = false } = {}) {
  if (fresh) modelsCache = undefined;
  return (modelsCache ??= await api("GET", "content/models"));
}

export async function findModel(ref) {
  return (await models()).find((m) => m.ZUID === ref || m.name === ref);
}

export async function requireModel(ref) {
  const m = await findModel(ref);
  if (!m) throw new UsageError(`no model "${ref}" on the instance`);
  return m;
}

export const fieldsOf = (model) => api("GET", `content/models/${model.ZUID}/fields`);

export function readJson(path) {
  if (!path) throw new UsageError("missing spec file");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new UsageError(`${path}: ${e.message}`);
  }
}

// Every API write is followed by an instance → local pull, so files the change
// generated or altered land locally (and get mapped for zesty-sync).
export function pullToLocal() {
  console.log("Pulling instance changes to local (zesty-sync pull):");
  try {
    const out = execFileSync("node", [join(ROOT, "tools", "zesty-sync.mjs"), "pull"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    console.log(out.trim().replace(/^/gm, "  "));
  } catch (e) {
    console.log(`  pull failed: ${(e.stderr || e.message).trim()}\n  run: node tools/zesty-sync.mjs pull`);
  }
}

// Shared entry point: run, and print a UsageError without a stack.
export function run(tool, main) {
  main().catch((e) => {
    console.error(`${tool}: ${e instanceof UsageError ? e.message : e.stack}`);
    process.exit(1);
  });
}
