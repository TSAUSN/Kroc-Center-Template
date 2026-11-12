// Builds a Freestyle page from a JSON spec: the page item (created once, found
// again by its path) and its layout, the two view files WebEngine renders a
// Freestyle page from — views/z/pvl/<item>.json (the Manager's tree) and
// .zhtml (the block calls). See ../reference/freestyle-pages.md.
//
// Every block is checked first: the model must be a block model and the
// variant must exist on it (by 7-… ZUID or by name). Then the item is created
// if no item of the model has the path, the two layout files are written in the
// Manager's format and pushed, and the page is fetched to check that each
// block's section rendered, in order. A layout is rewritten whole on every
// build. Nothing is deleted, and an existing item's fields are not changed.
//
// The page view must call autolayout(auto); a bare autolayout() ignores the
// layout. The tool warns when it doesn't.
//
// Usage:
//   node .claude/skills/zesty/scripts/zesty-page.mjs build <page.json> [--dry-run]
//   node .claude/skills/zesty/scripts/zesty-page.mjs show <path | 7-item-zuid>
//
// page.json:
//   { "model": "informational_pages", "path": "careers", "name": "Careers",
//     "data": { "page_name": "Careers", "page_content": "<p>…</p>" },   (used only when creating)
//     "blocks": [ ["hero", "Careers Hero"], ["card_grid", "7-849a8ae2c0-v0kj18"], … ] }

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ROOT,
  UsageError,
  api,
  models,
  requireModel,
  readJson,
  pullToLocal,
  INSTANCE_ZUID,
  authHeaders,
  requireSetup,
  run
} from "./zesty-api.mjs";

const DRY = process.argv.includes("--dry-run");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const PVL = join(ROOT, "webengine", "views", "z", "pvl");
const SYNC = join(dirname(fileURLToPath(import.meta.url)), "zesty-sync.mjs");

const itemsOf = (model) => api("GET", `content/models/${model.ZUID}/items?limit=500`);
const nameOf = (item) => item.web?.metaTitle || "";

async function devHost() {
  const res = await fetch(`https://accounts.api.zesty.io/v1/instances/${INSTANCE_ZUID}`, { headers: authHeaders() });
  const hash = (await res.json()).data?.randomHashID;
  if (!hash) throw new UsageError("could not read the instance's dev host");
  return `${hash}-dev.webengine.zesty.io`;
}

// [model, variant] -> { model, variant ZUID, name } — checked against the instance.
async function resolveBlocks(list) {
  if (!Array.isArray(list) || list.length === 0) throw new UsageError("page.json needs a non-empty blocks list");
  const out = [];
  const cache = {};
  for (const [i, entry] of list.entries()) {
    const [modelRef, ref] = Array.isArray(entry) ? entry : [entry.model, entry.variant];
    const model = await requireModel(modelRef);
    if (model.type !== "block") throw new UsageError(`blocks[${i}]: ${model.name} is a ${model.type}, not a block`);
    const items = (cache[model.ZUID] ??= await itemsOf(model));
    const hits = items.filter((it) => it.meta.ZUID === ref || nameOf(it) === ref);
    if (hits.length !== 1) {
      throw new UsageError(`blocks[${i}]: ${model.name} has ${hits.length ? "several variants" : "no variant"} "${ref}"`);
    }
    out.push({ model, zuid: hits[0].meta.ZUID, name: nameOf(hits[0]) });
  }
  return out;
}

// The Manager's tree: one root column, children keyed content:block:<model>:<pos>:<n>.
function layoutFiles(blocks) {
  const children = {};
  const lines = [];
  blocks.forEach((b, pos) => {
    const call = `{{block('/-/block/${b.model.name}.html?variant=${b.zuid}')}}`;
    const fullName = `content:block:${b.model.ZUID}:${pos}:${1 + Math.floor(Math.random() * 99)}`;
    children[fullName] = {
      html: call,
      content: call,
      model: b.model.ZUID,
      name: b.model.label,
      position: pos,
      fullName,
      type: "block",
      primarytype: "content",
      newLoc: "layout:root:column:0",
      oldLoc: "bank"
    };
    lines.push(`\t${call}`);
  });
  const tree = {
    "layout:root:column:0": {
      name: "layout:root:column:0",
      html: "<div className={styles.pvlRoot}>*</div>",
      children
    }
  };
  return { json: JSON.stringify(tree), zhtml: `<div className={styles.pvlRoot}>\n${lines.join("\n")}\n</div>` };
}

async function cmdBuild(path) {
  const spec = readJson(path);
  for (const k of ["model", "path", "blocks"]) if (!spec[k]) throw new UsageError(`page.json needs "${k}"`);
  const pathPart = String(spec.path).replace(/^\/+|\/+$/g, "");
  const model = await requireModel(spec.model);
  if (model.type === "block" || model.type === "dataset") throw new UsageError(`${model.name} is a ${model.type}, not a page model`);
  const blocks = await resolveBlocks(spec.blocks);

  const view = join(ROOT, "webengine", "views", model.name);
  if (existsSync(view) && !/autolayout\(\s*auto\s*\)/.test(readFileSync(view, "utf8"))) {
    console.log(`⚠ views/${model.name} doesn't call autolayout(auto): the layout won't render until it does.`);
  }

  let item = (await itemsOf(model)).find((it) => it.web?.pathPart === pathPart);
  const host = await devHost();
  if (!item) {
    const probe = await fetch(`https://${host}/${pathPart}/`).catch(() => null);
    if (probe && probe.status !== 404) throw new UsageError(`/${pathPart}/ already answers ${probe.status} on dev; pick another path`);
  }

  console.log(`${item ? "Page exists" : "Would create page"}: /${pathPart}/ (${model.name}${item ? `, ${item.meta.ZUID}` : ""})`);
  blocks.forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)}. ${b.model.name.padEnd(28)} ${b.zuid}  ${b.name}`));
  if (DRY) return;

  if (!item) {
    const name = spec.name || pathPart;
    const created = await api("POST", `content/models/${model.ZUID}/items`, {
      data: spec.data || {},
      web: { pathPart, metaTitle: name, metaLinkText: name, parentZUID: "0", canonicalTagMode: 1, sitemapPriority: -1 },
      meta: { listed: true, langID: 1 }
    });
    item = { meta: { ZUID: created.ZUID } };
    console.log(`Created page item ${created.ZUID}`);
  }

  const zuid = item.meta.ZUID;
  const files = layoutFiles(blocks);
  const base = join(PVL, zuid);
  writeFileSync(`${base}.json`, files.json);
  writeFileSync(`${base}.zhtml`, files.zhtml);
  console.log(execFileSync("node", [SYNC, "push", `${base}.json`, `${base}.zhtml`], { cwd: ROOT, encoding: "utf8" }).trim());
  pullToLocal();
  await verify(host, pathPart, blocks);
}

// Each block view mounts <section id="kroc-…-<variant zuid>">; all must appear, in order.
async function verify(host, pathPart, blocks) {
  const url = `https://${host}/${pathPart}/`;
  const res = await fetch(`${url}?_t=${Date.now()}`);
  const html = await res.text();
  let at = 0;
  const problems = [];
  for (const b of blocks) {
    const i = html.indexOf(`-${b.zuid}"`, at);
    if (i === -1) problems.push(`${b.model.name} ${b.zuid} not rendered (or out of order)`);
    else at = i;
  }
  if (!html.includes("pvl-container")) problems.push("no pvl-container: the layout isn't being used");
  console.log(`page ${res.status}: ${url}`);
  console.log(problems.length ? `⚠ ${problems.join("\n⚠ ")}` : `  all ${blocks.length} blocks rendered, in order`);
}

async function cmdShow(ref) {
  if (!ref) throw new UsageError("show needs a path or a 7-… item ZUID");
  let zuid = /^7-/.test(ref) ? ref : null;
  if (!zuid) {
    // Find the page item by its path across the page models.
    const want = `/${ref.replace(/^\/+|\/+$/g, "")}/`;
    for (const m of (await models()).filter((m) => m.type === "pageset" || m.type === "templateset")) {
      const hit = (await itemsOf(m)).find((it) => it.web?.path === want);
      if (hit) {
        zuid = hit.meta.ZUID;
        break;
      }
    }
  }
  const file = join(PVL, `${zuid}.zhtml`);
  if (!zuid || !existsSync(file)) throw new UsageError(`no local layout for ${ref} (run zesty-sync pull?)`);
  console.log(`views/z/pvl/${zuid}.zhtml`);
  for (const m of readFileSync(file, "utf8").matchAll(/block\('\/-\/block\/([a-z0-9_]+)\.html\?variant=(7-[0-9a-z-]+)'\)/g)) {
    console.log(`  ${m[1].padEnd(28)} ${m[2]}`);
  }
}

run("zesty-page", async () => {
  requireSetup();
  const [cmd, a] = args;
  if (cmd === "build") return cmdBuild(a);
  if (cmd === "show") return cmdShow(a);
  throw new UsageError("usage: zesty-page.mjs build <page.json> [--dry-run] | show <path | 7-item-zuid>");
});
