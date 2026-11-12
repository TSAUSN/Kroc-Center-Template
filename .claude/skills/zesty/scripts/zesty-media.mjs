// Lists and uploads files in the instance's media library, so a variant's
// Media fields can be filled from the API (zesty-variant.mjs takes the 3-…
// ZUIDs this prints).
//
// Same setup as the other tools (zesty-api.mjs). Uploads go to the
// instance's first bin, top-level group, through the media-storage service,
// which registers the file record itself (files under 32MB). A file whose name
// is already in the bin is refused rather than duplicated. Nothing is deleted.
//
// Usage:
//   node .claude/skills/zesty/scripts/zesty-media.mjs list
//   node .claude/skills/zesty/scripts/zesty-media.mjs upload <file…>      --dry-run to only check

import { readFileSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { UsageError, authHeaders, requireSetup, run, models, api } from "./zesty-api.mjs";

const MANAGER = "https://media-manager.api.zesty.io";
const STORAGE = "https://media-storage.api.zesty.io";
const MAX_BYTES = 32 * 1024 * 1024;
const TYPES = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf"
};

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const [CMD, ...ARGS] = argv.filter((a) => !a.startsWith("--"));

async function get(url) {
  const res = await fetch(url, { headers: authHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new UsageError(`GET ${url} → ${res.status} ${json.message || json.error || ""}`.trim());
  return json.data;
}

// The site bins listing rejects developer tokens, so find the bin through a
// file the instance already references (any media field value on any item).
async function findBin() {
  for (const m of await models()) {
    const items = (await api("GET", `content/models/${m.ZUID}/items?limit=20`)) || [];
    for (const it of items) {
      for (const v of Object.values(it.data || {})) {
        const zuid = typeof v === "string" && /^3-[0-9a-z]+-[0-9a-z]+$/.test(v) ? v : null;
        if (!zuid) continue;
        const file = (await get(`${MANAGER}/file/${zuid}`))[0];
        const bin = (await get(`${MANAGER}/bin/${file.bin_id}`))[0];
        return { ...bin, createdBy: file.created_by };
      }
    }
  }
  throw new UsageError("couldn't find the media bin: no item references a media file yet");
}

async function cmdList() {
  const bin = await findBin();
  const files = await get(`${MANAGER}/bin/${bin.id}/files`);
  for (const f of files) console.log(`${f.id}  ${f.filename}  ${f.url}`);
}

async function cmdUpload(paths) {
  if (paths.length === 0) throw new UsageError("upload needs one or more files");
  const bin = await findBin();
  const existing = new Set((await get(`${MANAGER}/bin/${bin.id}/files`)).map((f) => f.filename));
  const errors = [];
  for (const p of paths) {
    const type = TYPES[extname(p).toLowerCase()];
    if (!type) errors.push(`${p}: unsupported type (${Object.keys(TYPES).join(" ")})`);
    else if (statSync(p).size >= MAX_BYTES) errors.push(`${p}: 32MB or larger needs the signed-URL upload`);
    if (existing.has(basename(p))) errors.push(`${p}: "${basename(p)}" is already in the bin`);
  }
  if (errors.length) throw new UsageError(`${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  if (DRY) return console.log(`Would upload ${paths.length} file(s) to bin ${bin.name} (${bin.id}).`);

  for (const p of paths) {
    const form = new FormData();
    form.append("bin_id", bin.id);
    form.append("group_id", bin.id); // the bin's top-level group shares its ID
    form.append("user_id", bin.createdBy);
    form.append("file", new Blob([readFileSync(p)], { type: TYPES[extname(p).toLowerCase()] }), basename(p));
    const res = await fetch(`${STORAGE}/upload/${bin.storage_driver}/${bin.storage_name}`, {
      method: "POST",
      headers: authHeaders(),
      body: form
    });
    const json = await res.json().catch(() => ({}));
    const file = Array.isArray(json.data) ? json.data[0] : json.data;
    if (!res.ok || !file?.id) {
      throw new UsageError(`${basename(p)}: upload → ${res.status} ${json.message || json.error || ""}`.trim());
    }
    console.log(`${file.id}  ${file.filename}  ${file.url}`);
  }
}

async function main() {
  requireSetup();
  if (CMD === "list") await cmdList();
  else if (CMD === "upload") await cmdUpload(ARGS);
  else throw new UsageError(`unknown command "${CMD ?? ""}" (list | upload)`);
}

run("zesty-media", main);
