#!/usr/bin/env node
// End-to-end test of the center sync against a real main + center pair.
//
// Plays both sides with temporary zz_e2e_* models: the developer changing
// models on the MAIN instance, and center editors creating content (block
// variants, dataset rows) on the CENTER. After every step it syncs main →
// center and checks the result, including what happened to the center's own
// content, which is never copied (variants are content). Cleans up after
// itself, also at the start in case a previous run died half way.
//
//   node tools/center-sync/e2e.mjs [--center national] [--verbose] [--keep]
//
// Tokens as for cli.mjs: $ZESTY_TOKEN_MAIN (or .vscode/settings.json) and the
// center's tokenEnv. Touches only models named zz_e2e_*.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { client } from "./zesty.mjs";
import { readInstance, modelSpec, planSchema, assessImpact, applySchema, describeOp, canon } from "./schema.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const config = JSON.parse(readFileSync(join(ROOT, "centers.json"), "utf8"));
const argv = process.argv.slice(2);
const VERBOSE = argv.includes("--verbose");
const KEEP = argv.includes("--keep");
const centerId = argv.includes("--center") ? argv[argv.indexOf("--center") + 1] : config.centers[0].id;
const centerCfg = config.centers.find((c) => c.id === centerId);

function mainToken() {
  if (process.env.ZESTY_TOKEN_MAIN) return process.env.ZESTY_TOKEN_MAIN;
  const raw = readFileSync(join(ROOT, ".vscode", "settings.json"), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(raw)["zesty.editor.token"];
}
const main = client({ id: "main", zuid: config.main.zuid, token: mainToken() });
const center = client({ id: centerId, zuid: centerCfg.zuid, token: process.env[centerCfg.tokenEnv] });

// ---------- the models under test ----------

const P = "zz_e2e_";
const N = { tag: `${P}tag`, tag2: `${P}tag2`, card: `${P}card`, page: `${P}page` };
const ALL = new Set(Object.values(N));
const clone = (x) => structuredClone(x);

const tag = {
  name: N.tag, label: "E2E Tag", type: "dataset", listed: true,
  fields: [
    { name: "name", label: "Name", datatype: "text", sort: 10000 },
    { name: "color", label: "Color", datatype: "dropdown", options: { red: "Red", blue: "Blue" }, sort: 10001 }
  ]
};
const tag2 = {
  name: N.tag2, label: "E2E Tag 2", type: "dataset", listed: true,
  fields: [{ name: "title", label: "Title", datatype: "text", sort: 10000 }]
};
const card = {
  name: N.card, label: "E2E Card", type: "block", description: "temporary: center-sync e2e", listed: false,
  fields: [
    { name: "heading", label: "Heading", datatype: "text", sort: 10000 },
    { name: "body", label: "Body", datatype: "textarea", sort: 10001 },
    { name: "style", label: "Style", datatype: "dropdown", options: { a: "A", b: "B" }, sort: 10002 },
    {
      name: "items", label: "Items", datatype: "repeater", sort: 10003,
      subFields: [
        { name: "label", label: "Label", datatype: "text" },
        { name: "tone", label: "Tone", datatype: "dropdown", options: { x: "X", y: "Y" } },
        { name: "icon", label: "Icon", datatype: "images" }
      ]
    },
    { name: "tag", label: "Tag", datatype: "one_to_one", relatedModel: N.tag, relatedField: "name", sort: 10004 },
    { name: "stories", label: "Stories", datatype: "one_to_many", relatedModel: "stories", relatedField: "title", sort: 10005 },
    { name: "photos", label: "Photos", datatype: "images", limit: 3, sort: 10006 },
    { name: "show", label: "Show", datatype: "yes_no", sort: 10007 },
    { name: "count", label: "Count", datatype: "number", sort: 10008 }
  ]
};
const page = {
  name: N.page, label: "E2E Page", type: "pageset", listed: true, parent: { page: "stories_page" },
  fields: [{ name: "title", label: "Title", datatype: "text", sort: 10000 }]
};
const fieldOf = (spec, name) => spec.fields.find((f) => f.name === name);

// ---------- helpers ----------

const results = [];
let step = "";
function check(ok, what, detail = "") {
  results.push({ step, ok, what });
  console.log(`  ${ok ? "PASS" : "FAIL"} ${what}${!ok && detail ? ` — ${detail}` : ""}`);
}
const log = (s) => VERBOSE && console.log(`    ${s}`);

// The developer's side: make main's zz_e2e_* models look like `specs`.
async function onMain(specs, { removed = {}, gates = ["additive"] } = {}) {
  const st = await readInstance(main);
  const ops = planSchema(specs, st, { removed, only: ALL });
  const res = await applySchema(main, st, ops, { gates, dry: false, log, allowContentLoss: true });
  if (res.errors.length) throw new Error(`main: ${res.errors.join("; ")}`);
}

// What a commit would carry: the export of main's zz_e2e_* models.
async function exported() {
  const st = await readInstance(main);
  return [...ALL].filter((n) => st.modelByName.has(n)).map((n) => modelSpec(st, st.modelByName.get(n)));
}

// The sync: plan (with impact) and optionally apply to the center.
async function sync({ specs, removed = {}, gates = ["additive"], allowContentLoss = false, apply = true } = {}) {
  specs ??= await exported();
  const st = await readInstance(center);
  const ops = await assessImpact(center, st, planSchema(specs, st, { removed, only: ALL }));
  for (const o of ops) log(`[${o.gate}] ${describeOp(o).replace(/\*\*/g, "")}`);
  const res = apply ? await applySchema(center, st, ops, { gates, dry: false, log, allowContentLoss }) : { errors: [] };
  return { ops, errors: res.errors };
}

const find = (ops, op, model, field) =>
  ops.find((o) => o.op === op && o.model === model && (!field || (typeof o.field === "string" ? o.field : o.field?.name) === field));

async function sameOnBoth(names) {
  const [a, b] = await Promise.all([readInstance(main), readInstance(center)]);
  const diffs = names.filter((n) => {
    const ma = a.modelByName.get(n);
    const mb = b.modelByName.get(n);
    if (!ma || !mb) return Boolean(ma) !== Boolean(mb);
    return canon(modelSpec(a, ma)) !== canon(modelSpec(b, mb));
  });
  return { ok: diffs.length === 0, diffs, a, b };
}

const modelZuid = async (c, name) => (await c.api("GET", "content/models")).find((m) => m.name === name)?.ZUID;
const fieldsOn = async (c, name, deleted = false) =>
  (await c.api("GET", `content/models/${await modelZuid(c, name)}/fields${deleted ? "?showDeleted=true" : ""}`)) || [];

async function createItem(c, model, title, data) {
  const mz = await modelZuid(c, model);
  const created = await c.api("POST", `content/models/${mz}/items`, {
    data,
    web: { metaTitle: title, canonicalTagMode: 1, sitemapPriority: -1 },
    meta: { listed: true }
  });
  return created.ZUID;
}
const itemData = async (c, model, zuid) => (await c.api("GET", `content/models/${await modelZuid(c, model)}/items/${zuid}`))?.data || {};

// Render on the center's dev preview. WebEngine can serve a stale template for
// a while after a save, so wait until the response carries `marker` (a string
// only the current template prints) — or the error page, which hides it.
async function render(path, marker) {
  const acct = await fetch(`https://accounts.api.zesty.io/v1/instances/${center.zuid}`, {
    headers: { Authorization: `Bearer ${process.env[centerCfg.tokenEnv]}` }
  }).then((r) => r.json());
  let out;
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`https://${acct.data.randomHashID}-dev.webengine.zesty.io${path}${path.includes("?") ? "&" : "?"}_e2e=${Date.now()}`);
    const body = await res.text();
    out = { status: res.status, body, parsleyError: /WebEngine Error|Parsley[^<]{0,40}Error/i.test(body) };
    if (out.parsleyError || !marker || body.includes(marker)) return out;
    await new Promise((r) => setTimeout(r, 10000));
  }
  return { ...out, stale: true };
}

// Remove every zz_e2e_* model: relations first (card), then the rest.
async function cleanup(c) {
  for (const name of [N.card, N.page, N.tag2, N.tag]) {
    const z = await modelZuid(c, name);
    if (z) await c.api("DELETE", `content/models/${z}`);
  }
}

// ---------- the steps ----------

async function run() {
  console.log(`center-sync e2e: main ${config.main.zuid} → ${centerId} ${centerCfg.zuid}\n`);
  await cleanup(center);
  await cleanup(main);

  // S1 — CREATE: models relating to a model created in the same run and to an
  // existing one; repeater with dropdown + image sub-fields; options, yes/no,
  // number, multi-image; a pageset nested under a page.
  step = "S1 create";
  console.log(`${step}`);
  await onMain([tag, card, page]);
  let r = await sync();
  check(r.errors.length === 0, "applies without errors", r.errors.join("; "));
  check(["create-model"].every(() => [N.tag, N.card, N.page].every((n) => find(r.ops, "create-model", n))), "plans 3 new models");
  let both = await sameOnBoth([...ALL]);
  check(both.ok, "center models match main exactly", both.diffs.join(", "));
  {
    const b = both.b;
    const cardF = b.fieldsOf.get(b.modelByName.get(N.card).ZUID);
    check(cardF.find((f) => f.name === "tag")?.relatedModelZUID === b.modelByName.get(N.tag).ZUID, "relation to a same-run model points at the center's own model");
    check(cardF.find((f) => f.name === "stories")?.relatedModelZUID === b.modelByName.get("stories").ZUID, "relation to an existing model points at the center's stories");
    check(b.modelByName.get(N.page).parentZUID === b.pageItemByModel.get("stories_page"), "nested pageset sits under the center's own stories page");
  }

  // S2 — center editors make content on the center (never synced).
  step = "S2 center content";
  console.log(`\n${step}`);
  const tagItem = await createItem(center, N.tag, "Blue tag", { name: "Blue tag", color: "blue" });
  const varA = await createItem(center, N.card, "Variant A", {
    heading: "Center heading A", body: "Center body A", style: "b",
    items: [{ label: "Row 1", tone: "y", icon: null }], tag: tagItem, show: 1, count: 3
  });
  const varB = await createItem(center, N.card, "Variant B", { heading: "Center heading B", show: 0 });
  check(Boolean(tagItem && varA && varB), "a dataset row and two block variants exist on the center only");
  const viewZ = (await center.api("GET", "web/views?status=dev")).find((v) => v.fileName === `/-/block/${N.card}.html`)?.ZUID;
  await center.api("PUT", `web/views/${viewZ}`, { code: `<div class="e2e" data-t="t1">{{this.heading}} | {{this.body}} | {{this.style}}</div>` });
  let page1 = await render(`/-/block/${N.card}.html?variant=${varA}`, 'data-t="t1"');
  check(page1.status === 200 && page1.body.includes("Center heading A"), "variant A renders on the center", `HTTP ${page1.status}${page1.stale ? ", template still stale" : ""}`);
  const mainItems = await main.api("GET", `content/models/${await modelZuid(main, N.card)}/items`);
  check((mainItems || []).length === 0, "main has no variants: nothing was copied back or forth");

  // S3 — UPDATE, non-destructive: relabel, reorder, add field, add option,
  // repeater sub-field add + relabel, relation display field, model attrs, parent move.
  step = "S3 update";
  console.log(`\n${step}`);
  const card3 = clone(card);
  fieldOf(card3, "heading").label = "Heading (renamed)";
  fieldOf(card3, "heading").sort = 10001;
  fieldOf(card3, "body").sort = 10000;
  fieldOf(card3, "style").options.c = "C";
  fieldOf(card3, "items").subFields[0].label = "Row label";
  fieldOf(card3, "items").subFields.push({ name: "note", label: "Note", datatype: "text" });
  fieldOf(card3, "stories").relatedField = "author";
  card3.description = "temporary: center-sync e2e (updated)";
  card3.fields.push({ name: "cta_label", label: "CTA Label", datatype: "text", sort: 10009 });
  card3.fields.push({ name: "links", label: "Links", datatype: "repeater", sort: 10010, subFields: [{ name: "url", label: "URL", datatype: "text" }] });
  const page3 = { ...clone(page), label: "E2E Page (moved)", parent: { page: "events_page" } };
  const tag3 = { ...clone(tag), listed: false };
  await onMain([tag3, card3, page3]);
  r = await sync();
  check(r.errors.length === 0, "applies without errors", r.errors.join("; "));
  for (const [op, model, field] of [
    ["update-field", N.card, "heading"], ["update-field", N.card, "body"], ["update-field", N.card, "style"],
    ["update-field", N.card, "items"], ["update-field", N.card, "stories"], ["add-field", N.card, "cta_label"],
    ["update-model", N.card], ["update-model", N.page]
  ]) check(Boolean(find(r.ops, op, model, field)), `plans ${op} ${model.replace(P, "")}${field ? `.${field}` : ""}`);
  // `listed` can't be changed through the API (not even on main), so the
  // e2e changes it on the center directly to see it reported, not applied.
  {
    const st = await readInstance(center);
    const ops = planSchema([{ ...tag3, listed: true }, (await exported()).find((s) => s.name === N.card), page3].filter(Boolean), st, { only: ALL });
    const listedOp = ops.find((o) => o.op === "conflict" && o.model === N.tag);
    // main kept listed=true (API ignores the change), so compare against a spec saying false
    const ops2 = planSchema([{ ...tag3 }], st, { only: new Set([N.tag]) });
    check(!listedOp && /listed is true, schema says false/.test(ops2.find((o) => o.op === "conflict")?.detail || ""), "a listed change is reported for the Manager, never attempted");
  }
  check(/2 existing item/.test(find(r.ops, "add-field", N.card, "cta_label")?.impact?.note || ""), "preview says the 2 center variants start with the new field empty");
  both = await sameOnBoth([...ALL]);
  check(both.ok, "center models match main exactly", both.diffs.join(", "));
  check(both.b.modelByName.get(N.page).parentZUID === both.b.pageItemByModel.get("events_page"), "pageset moved under the center's events page");
  const a3 = await itemData(center, N.card, varA);
  check(a3.heading === "Center heading A" && a3.style === "b" && a3.items?.[0]?.tone === "y", "variant A's content survived the update");
  // V1: a template reading the new, empty field on an old variant
  await center.api("PUT", `web/views/${viewZ}`, { code: `<div class="e2e" data-t="t2">{{this.heading}} [{{this.cta_label}}]</div>` });
  page1 = await render(`/-/block/${N.card}.html?variant=${varA}`, 'data-t="t2"');
  check(
    page1.status === 200 && !page1.parsleyError && !page1.stale,
    "old variant renders when the template reads a new empty field",
    `HTTP ${page1.status}${page1.parsleyError ? ", Parsley error" : ""}${page1.stale ? ", template still stale" : ""}`
  );
  // A new REPEATER read raw on an old variant (Globals' empty social_handles
  // errored this way on National's preview). Recorded as a finding.
  await center.api("PUT", `web/views/${viewZ}`, { code: `<div class="e2e" data-t="t3">{{this.heading}} [{{this.links}}]</div>` });
  page1 = await render(`/-/block/${N.card}.html?variant=${varA}`, 'data-t="t3"');
  const rawRepeaterBreaks = page1.parsleyError || page1.status !== 200;
  console.log(`  INFO reading a new empty repeater raw on an old variant: ${rawRepeaterBreaks ? `BREAKS the preview (HTTP ${page1.status}, Parsley error)` : "renders fine"}`);
  // …and the guarded form templates should use
  await center.api("PUT", `web/views/${viewZ}`, { code: `<div class="e2e" data-t="t4">{{this.heading}} {{if {this.links} }}[links]{{end-if}}</div>` });
  page1 = await render(`/-/block/${N.card}.html?variant=${varA}`, 'data-t="t4"');
  check(page1.status === 200 && !page1.parsleyError && !page1.stale, "a guarded read of a new empty repeater renders on an old variant", `HTTP ${page1.status}${page1.parsleyError ? ", Parsley error" : ""}${page1.stale ? ", stale" : ""}`);

  // S4 — UPDATE, flagged: drop an option a variant holds, make a field required
  // that a variant leaves empty, retarget a relation a variant uses.
  step = "S4 flagged update";
  console.log(`\n${step}`);
  const card4 = clone(card3);
  delete fieldOf(card4, "style").options.b;
  fieldOf(card4, "count").required = true;
  Object.assign(fieldOf(card4, "tag"), { relatedModel: N.tag2, relatedField: "title" });
  await onMain([tag3, tag2, card4, page3]);
  r = await sync();
  check(r.errors.length === 0, "applies without errors", r.errors.join("; "));
  check(/1 item\(s\) hold a dropped option/.test(find(r.ops, "update-field", N.card, "style")?.impact?.note || ""), "preview flags the variant holding the dropped option");
  check(/1 item\(s\) are empty/.test(find(r.ops, "update-field", N.card, "count")?.impact?.note || ""), "preview flags the variant left empty by the new required field");
  check(/link to zz_e2e_tag items/.test(find(r.ops, "update-field", N.card, "tag")?.impact?.note || ""), "preview flags the variant linking to the old relation target");
  both = await sameOnBoth([...ALL]);
  check(both.ok, "center models match main exactly", both.diffs.join(", "));

  // S5 — TYPE CHANGE: reported, never applied by a stage merge; prune refuses
  // to destroy the variant's value unless told to.
  step = "S5 datatype change";
  console.log(`\n${step}`);
  const card5 = clone(card4);
  fieldOf(card5, "body").datatype = "wysiwyg_basic";
  await onMain([tag3, tag2, card5, page3], { gates: ["additive", "prune"] });
  r = await sync();
  const conflict = find(r.ops, "conflict", N.card, "body");
  check(Boolean(conflict), "stage merge reports the type change under 'needs a person'");
  check(/1 item\(s\) hold a value here/.test(conflict?.impact?.note || ""), "…and says one variant holds data in it");
  check((await fieldsOn(center, N.card)).find((f) => f.name === "body")?.datatype === "textarea", "stage merge left the center's field (and its data) alone");
  r = await sync({ gates: ["additive", "prune"] });
  check(r.errors.some((e) => /refusing/.test(e)), "prune refuses to hard-delete a field holding variant data");
  r = await sync({ gates: ["additive", "prune"], allowContentLoss: true });
  check(r.errors.length === 0, "prune --allow-content-loss recreates the field", r.errors.join("; "));
  both = await sameOnBoth([...ALL]);
  check(both.ok, "center models match main exactly", both.diffs.join(", "));

  // S6 — DELETE a field holding data: stage merge leaves it; the removals run
  // deactivates it (restorable), it doesn't hard-delete.
  step = "S6 remove field";
  console.log(`\n${step}`);
  const card6 = clone(card5);
  card6.fields = card6.fields.filter((f) => f.name !== "heading");
  const removedHeading = { fields: { [N.card]: ["heading"] } };
  await onMain([tag3, tag2, card6, page3], { removed: removedHeading, gates: ["additive", "removals"] });
  r = await sync({ removed: removedHeading });
  check(Boolean(find(r.ops, "remove-field", N.card, "heading")), "stage merge lists the removal as waiting");
  check((await fieldsOn(center, N.card)).some((f) => f.name === "heading"), "…and doesn't remove it");
  r = await sync({ removed: removedHeading, gates: ["additive", "removals"] });
  check(r.errors.length === 0, "removals run deactivates it", r.errors.join("; "));
  check(/2 item\(s\) hold a value here — hidden \(restorable\)/.test(find(r.ops, "remove-field", N.card, "heading")?.impact?.note || ""), "…saying 2 variants' values are hidden, not lost");
  check(!(await fieldsOn(center, N.card)).some((f) => f.name === "heading"), "field is no longer active on the center");

  // S7 — RE-ADD the same field: the center restores its deactivated field,
  // and the variant's old value comes back.
  step = "S7 re-add field";
  console.log(`\n${step}`);
  await onMain([tag3, tag2, card5, page3]);
  r = await sync();
  check(Boolean(find(r.ops, "undelete-field", N.card, "heading")), "plans a restore, not a new field");
  check(r.errors.length === 0, "applies without errors", r.errors.join("; "));
  check((await itemData(center, N.card, varA)).heading === "Center heading A", "variant A's heading value is back");
  both = await sameOnBoth([...ALL]);
  check(both.ok, "center models match main exactly", both.diffs.join(", "));

  // S8 — DELETE a relation target: refused while a relation still points at it;
  // fine once the relation field goes in the same removal.
  step = "S8 remove relation target";
  console.log(`\n${step}`);
  const specsNoTag2 = (await exported()).filter((s) => s.name !== N.tag2);
  r = await sync({ specs: specsNoTag2, removed: { models: [N.tag2] }, gates: ["additive", "removals"] });
  check(r.errors.some((e) => /still related to by zz_e2e_card\.tag/.test(e)), "refused: zz_e2e_card.tag still points at it");
  const card8 = clone(card5);
  card8.fields = card8.fields.filter((f) => f.name !== "tag");
  const removed8 = { fields: { [N.card]: ["tag"] }, models: [N.tag2] };
  await onMain([tag3, card8, page3], { removed: removed8, gates: ["additive", "removals"] });
  r = await sync({ removed: removed8, gates: ["additive", "removals"] });
  check(r.errors.length === 0, "relation field + target model removed together", r.errors.join("; "));
  check(!(await modelZuid(center, N.tag2)), "target model is gone from the center");

  // S9 — DELETE models that hold center content: refused without the flag.
  step = "S9 remove models with content";
  console.log(`\n${step}`);
  const removed9 = { models: [N.tag, N.card, N.page] };
  await onMain([], { removed: removed9, gates: ["removals"] });
  r = await sync({ specs: [], removed: removed9, gates: ["removals"] });
  check(r.errors.some((e) => /zz_e2e_card.*refusing: 2 item/.test(e)), "refuses to delete the block model with 2 center variants");
  check(r.errors.some((e) => /zz_e2e_tag .*refusing: 1 item/.test(e)), "refuses to delete the dataset with 1 center row");
  check(!(await modelZuid(center, N.page)), "deletes the empty pageset");
  r = await sync({ specs: [], removed: removed9, gates: ["removals"], allowContentLoss: true });
  check(r.errors.length === 0, "--allow-content-loss deletes them", r.errors.join("; "));
  check(!(await modelZuid(center, N.card)) && !(await modelZuid(center, N.tag)), "no zz_e2e_* models left on the center");
}

try {
  await run();
} catch (e) {
  check(false, `crashed in ${step}`, e.stack);
} finally {
  if (!KEEP) {
    await cleanup(center).catch((e) => console.log(`cleanup center: ${e.message}`));
    await cleanup(main).catch((e) => console.log(`cleanup main: ${e.message}`));
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — FAILED: ${failed.map((f) => `[${f.step}] ${f.what}`).join("; ")}` : ""}`);
  process.exitCode = failed.length ? 1 : 0;
}
