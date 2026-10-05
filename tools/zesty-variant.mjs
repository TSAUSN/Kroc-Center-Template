// Creates and edits block variants from a JSON file. A variant is a content
// item of the block model: its name is the item's web.metaTitle, its content
// the item's data. A block needs one before it has content to render.
//
// Same setup as zesty-model.mjs (tools/zesty-api.mjs). Every value is checked
// against the model's fields before the first request — unknown fields,
// unknown repeater keys, dropdown values that aren't options, wrong types —
// and written in the shape the Manager stores (yes_no 0/1, currency as a
// string, images and relations as comma-joined ZUIDs, repeaters as arrays of
// row objects). Nothing is published: dev renders the latest saved version.
// og_image is stamped with the screenshot URL the Manager would write: the
// API never requests a screenshot, and that URL is the only place
// blocks_catalog_page can read a variant's ZUID from. The Manager replaces it
// with a real screenshot the first time the variant is saved there.
// Nothing is deleted. Every write ends with `zesty-sync pull` and prints the
// variant's preview URL.
//
// Usage:
//   node tools/zesty-variant.mjs list <model>
//   node tools/zesty-variant.mjs show <model> <variant>             variant = 7-… ZUID or its name
//   node tools/zesty-variant.mjs create <variant.json>
//   node tools/zesty-variant.mjs update <model> <variant> <patch.json>
//   --dry-run on create/update prints the payload without sending it.
//
// variant.json: { "model": "church_kids", "name": "Church Kroc Kids", "data": { <field>: <value>, … } }
// patch.json:   { "name"?: "New name", "data"?: { <field>: <value>, … } }   (fields merge; a repeater is replaced whole)

import {
  UsageError,
  api,
  requireModel,
  fieldsOf,
  readJson,
  pullToLocal,
  INSTANCE_ZUID,
  authHeaders,
  requireSetup,
  run
} from "./zesty-api.mjs";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const [CMD, ...ARGS] = argv.filter((a) => !a.startsWith("--"));

// Written only by stampScreenshot (below) or the Manager's screenshot
// service, never from a variant file.
const MANAGED_FIELDS = ["og_image"];
const STRINGS = ["text", "textarea", "wysiwyg_basic", "markdown", "link", "color", "date", "datetime", "uuid", "internal_link"];
const ZUID_LISTS = { images: "3-", files: "3-", one_to_one: "7-", one_to_many: "7-" };

// ---------- values ----------

// Returns [value in stored shape, error|null].
function coerce(field, value, at, subFields) {
  if (value === null || value === "") return [null, null];
  const t = field.datatype;
  if (STRINGS.includes(t)) {
    return typeof value === "string" ? [value, null] : [null, `${at}: ${t} needs a string`];
  }
  if (t === "number" || t === "sort") {
    const n = Number(value);
    return Number.isFinite(n) ? [n, null] : [null, `${at}: ${t} needs a number`];
  }
  if (t === "currency") {
    return Number.isFinite(Number(value)) ? [String(value), null] : [null, `${at}: currency needs a number`];
  }
  if (t === "yes_no") {
    if ([true, 1, "1"].includes(value)) return [1, null];
    if ([false, 0, "0"].includes(value)) return [0, null];
    return [null, `${at}: yes_no needs true/false`];
  }
  if (t === "dropdown") {
    const options = Object.keys(field.settings?.options || {});
    return options.includes(String(value))
      ? [String(value), null]
      : [null, `${at}: "${value}" is not an option (${options.join(" | ")})`];
  }
  if (t in ZUID_LISTS) {
    const list = Array.isArray(value) ? value : String(value).split(",");
    const zuids = list.map((z) => String(z).trim()).filter(Boolean);
    const bad = zuids.filter((z) => !z.startsWith(ZUID_LISTS[t]));
    if (bad.length) return [null, `${at}: ${t} takes ${ZUID_LISTS[t]}… ZUIDs, got ${bad.join(", ")}`];
    if (t === "one_to_one" && zuids.length > 1) return [null, `${at}: one_to_one takes a single ZUID`];
    return [zuids.join(","), null];
  }
  if (t === "repeater") {
    if (!Array.isArray(value)) return [null, `${at}: repeater needs an array of rows`];
    const errors = [];
    const rows = value.map((row, i) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        errors.push(`${at}[${i}]: a row must be an object`);
        return {};
      }
      const out = {};
      for (const [k, v] of Object.entries(row)) {
        const sub = subFields.find((s) => s.name === k);
        if (!sub) {
          errors.push(`${at}[${i}].${k}: no such sub-field (${subFields.map((s) => s.name).join(", ")})`);
          continue;
        }
        const [cv, err] = coerce(sub, v, `${at}[${i}].${k}`, []);
        if (err) errors.push(err);
        else out[k] = cv;
      }
      return out;
    });
    return errors.length ? [null, errors.join("\n  ")] : [rows, null];
  }
  return [null, `${at}: writing ${t} fields isn't supported here`];
}

function buildData(model, fields, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new UsageError("data must be an object");
  const errors = [];
  const out = {};
  for (const [name, value] of Object.entries(data)) {
    const field = fields.find((f) => f.name === name);
    if (!field) {
      errors.push(`${name}: ${model.name} has no such field`);
    } else if (MANAGED_FIELDS.includes(name)) {
      errors.push(`${name}: filled by Zesty's screenshot service, not by hand`);
    } else {
      const [v, err] = coerce(field, value, name, field.settings?.subFields || []);
      if (err) errors.push(...err.split("\n  "));
      else out[name] = v;
    }
  }
  if (errors.length) throw new UsageError(`data has ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  return out;
}

// ---------- variants ----------

const itemsOf = async (model) => (await api("GET", `content/models/${model.ZUID}/items`)) || [];
const nameOf = (item) => item.web?.metaTitle || "(unnamed)";

async function findVariant(model, ref) {
  const items = await itemsOf(model);
  const hits = items.filter((it) => it.meta.ZUID === ref || nameOf(it) === ref);
  if (hits.length === 0) throw new UsageError(`${model.name} has no variant "${ref}"`);
  if (hits.length > 1) throw new UsageError(`${hits.length} variants of ${model.name} are named "${ref}"; use the ZUID`);
  return hits[0];
}

// The dev WebEngine host is "<randomHashID>-dev.webengine.zesty.io".
let previewHost;
async function previewUrl(model, zuid) {
  if (previewHost === undefined) {
    try {
      const res = await fetch(`https://accounts.api.zesty.io/v1/instances/${INSTANCE_ZUID}`, {
        headers: authHeaders()
      });
      const hash = (await res.json()).data?.randomHashID;
      previewHost = hash ? `${hash}-dev.webengine.zesty.io` : null;
    } catch {
      previewHost = null;
    }
  }
  return previewHost && `https://${previewHost}/-/block/${model.name}.html?variant=${zuid}`;
}

// Same shape as the Manager's: <host>!-!block!<name>.html!variant=<zuid>&version=<n>…
// The PNG may not exist yet; only the variant= part is read by the catalog.
async function screenshotUrl(model, item) {
  await previewUrl(model, item.meta.ZUID);
  if (!previewHost) return null;
  return (
    "https://storage.googleapis.com/zesty-prod-instance-screenshots/" +
    `${previewHost}!-!block!${model.name}.html!variant=${item.meta.ZUID}` +
    `&version=${item.meta.version}&_bypassError=true&preview=global_1280_720.png`
  );
}

// What every Manager-made variant carries (all 31 on the instance, checked
// 2026-10-05). A PUT that omits `listed` UNLISTS the item, and an unlisted
// variant drops out of /-/gql/ and fails to render (`this.zuid` → "field does
// not exist"), so both are sent on every write.
const MANAGER_META = { listed: true };
const MANAGER_WEB = { canonicalTagMode: 1, sitemapPriority: -1 };

// Returns what a write must restore to match the Manager's variants.
function drift(item) {
  const out = [];
  if (!item.data.og_image) out.push("og_image (stamped)");
  if (item.meta.listed !== MANAGER_META.listed) out.push("listed");
  if (item.web.sitemapPriority !== MANAGER_WEB.sitemapPriority) out.push("sitemapPriority");
  return out;
}

// PUT replaces the version wholesale: send every stored field, patched. Fills
// an empty og_image on the way.
async function putItem(model, item, data, name) {
  const full = { ...item.data, ...data };
  if (!full.og_image) full.og_image = await screenshotUrl(model, item);
  await api("PUT", `content/models/${model.ZUID}/items/${item.meta.ZUID}`, {
    data: full,
    meta: { masterZUID: item.meta.masterZUID, ...MANAGER_META },
    web: { ...MANAGER_WEB, metaTitle: name, metaLinkText: item.web.metaLinkText }
  });
}

const getItem = (model, zuid) => api("GET", `content/models/${model.ZUID}/items/${zuid}`);

async function report(model, zuid) {
  const item = (await itemsOf(model)).find((it) => it.meta.ZUID === zuid);
  const og = item?.data?.og_image || "";
  const issues = item ? drift(item) : ["not found"];
  console.log(
    `  version ${item?.meta.version ?? "?"}; og_image ${og.includes(`variant=${zuid}`) ? "carries this ZUID" : "MISSING this ZUID"}; ` +
      (issues.length ? `⚠ still off: ${issues.join(", ")}` : "listed like a Manager variant")
  );
  const url = await previewUrl(model, zuid);
  if (!url) return;
  const res = await fetch(url).catch(() => null);
  console.log(`  preview ${res ? res.status : "unreachable"}: ${url}`);
}

// ---------- commands ----------

async function cmdList(modelRef) {
  const model = await requireModel(modelRef);
  const items = await itemsOf(model);
  if (items.length === 0) return console.log(`${model.name} has no variants yet.`);
  for (const it of items) console.log(`${it.meta.ZUID}  v${String(it.meta.version).padEnd(3)} ${nameOf(it)}`);
}

async function cmdShow(modelRef, ref) {
  const model = await requireModel(modelRef);
  const item = await findVariant(model, ref);
  const data = { ...item.data };
  for (const f of MANAGED_FIELDS) delete data[f];
  console.log(JSON.stringify({ model: model.name, name: nameOf(item), zuid: item.meta.ZUID, data }, null, 2));
}

async function cmdCreate(path) {
  const spec = readJson(path);
  if (!spec.model) throw new UsageError("variant.json needs a model");
  if (!spec.name) throw new UsageError("variant.json needs a name (shown in the Manager's variant list)");
  const model = await requireModel(spec.model);
  if (model.type !== "block") throw new UsageError(`${model.name} is a ${model.type}, not a block`);
  if ((await itemsOf(model)).some((it) => nameOf(it) === spec.name)) {
    throw new UsageError(`${model.name} already has a variant named "${spec.name}" (use update)`);
  }
  const data = buildData(model, await fieldsOf(model), spec.data);
  const payload = { data, web: { ...MANAGER_WEB, metaTitle: spec.name }, meta: { ...MANAGER_META } };
  if (DRY) {
    console.log(`Would create variant "${spec.name}" of ${model.name}:`);
    return console.log(JSON.stringify(payload, null, 2));
  }
  const created = await api("POST", `content/models/${model.ZUID}/items`, payload);
  console.log(`Created variant "${spec.name}" of ${model.name}: ${created.ZUID}`);
  await putItem(model, await getItem(model, created.ZUID), {}, spec.name);
  await report(model, created.ZUID);
  pullToLocal();
}

async function cmdUpdate(modelRef, ref, path) {
  const model = await requireModel(modelRef);
  const item = await findVariant(model, ref);
  const patch = readJson(path);
  const changes = buildData(model, await fieldsOf(model), patch.data || {});
  const name = patch.name || nameOf(item);
  const changed = Object.keys(changes).filter((k) => JSON.stringify(item.data[k] ?? null) !== JSON.stringify(changes[k]));
  changed.push(...drift(item));
  if (changed.length === 0 && name === nameOf(item)) return console.log("No change.");

  console.log(`${DRY ? "Would update" : "Updating"} "${nameOf(item)}" (${item.meta.ZUID}): ${changed.join(", ") || "name only"}`);
  if (DRY) return console.log(JSON.stringify({ ...item.data, ...changes }, null, 2));
  await putItem(model, item, changes, name);
  console.log("Updated.");
  await report(model, item.meta.ZUID);
  pullToLocal();
}

async function main() {
  requireSetup();
  if (CMD === "list") await cmdList(ARGS[0]);
  else if (CMD === "show") await cmdShow(ARGS[0], ARGS[1]);
  else if (CMD === "create") await cmdCreate(ARGS[0]);
  else if (CMD === "update") await cmdUpdate(ARGS[0], ARGS[1], ARGS[2]);
  else throw new UsageError(`unknown command "${CMD ?? ""}" (list | show | create | update)`);
}

run("zesty-variant", main);
