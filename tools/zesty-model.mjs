// Creates and edits Zesty content models from a JSON spec, so a block's fields
// are set up from the spec instead of clicked through in the Manager.
//
// Same setup as zesty-sync.mjs: zesty.config.json (instance ZUID) and the
// extension's developer token (.vscode/settings.json, or $ZESTY_TOKEN).
//
// Safety: every write command validates the whole spec before the first
// request and takes --dry-run (prints the exact payloads). Nothing is deleted
// or renamed: removing a model, field, option or sub-field stays a Manager
// action, since content already stored under it would go with it. Every write
// ends with `zesty-sync pull`, so files the change generated land locally.
//
// Usage:
//   node tools/zesty-model.mjs list
//   node tools/zesty-model.mjs show <model>                     spec JSON; round-trips into create
//   node tools/zesty-model.mjs create <spec.json>               model + fields, then pulls its view
//   node tools/zesty-model.mjs add-fields <model> <spec.json>   append fields; existing names skipped
//   node tools/zesty-model.mjs update-field <model> <field> <patch.json>
//   <model> is a name or a 6-… ZUID.
//
// Spec:
//   { "name": "church_connect_links", "label": "Church Connect Links", "type": "block",
//     "description": "", "fields": [ <field>, … ] }
// Field:
//   { "name": "items", "label": "Items", "datatype": "repeater",
//     "description"?, "required"?,
//     "options"?      dropdown / yes_no: { "value": "Label", … }
//     "limit"?        images / files (default 1)
//     "currency"?     currency (default "USD")
//     "subFields"?    repeater: fields of the flat types in SUB_DATATYPES
//     "relatedModel"?, "relatedField"?   one_to_one / one_to_many: names or ZUIDs
//     "settings"?     merged last, for anything not covered above }
// Patch (update-field): any of label, description, required, options, limit,
//   currency, settings, sort, subFields (matched by name: changed or appended).

import {
  UsageError,
  api,
  models,
  findModel,
  requireModel,
  fieldsOf,
  readJson as readSpec,
  pullToLocal,
  requireSetup,
  run
} from "./zesty-api.mjs";

const MODEL_TYPES = ["block", "dataset", "pageset", "templateset"];
const DATATYPES = [
  "text", "textarea", "wysiwyg_basic", "markdown", "images", "files", "link", "internal_link",
  "number", "currency", "date", "datetime", "yes_no", "dropdown", "color", "sort", "uuid",
  "one_to_one", "one_to_many", "repeater", "block_selector", "integration"
];
// Zesty's documented repeater sub-field types: no relations, no nesting.
const SUB_DATATYPES = [
  "text", "textarea", "wysiwyg_basic", "markdown", "images", "link", "number", "currency",
  "date", "datetime", "yes_no", "dropdown", "color", "sort", "uuid"
];
const RELATIONAL = ["one_to_one", "one_to_many"];
const AUTO_FIELDS = ["og_image"]; // the Manager adds it to every block model
// The Manager's Meta Image field, copied from a Manager-made block. The API
// doesn't add it, but it matters: a variant's screenshot URL lands in it, and
// that URL is the only place blocks_catalog_page can read a variant ZUID from.
const OG_IMAGE_FIELD = {
  name: "og_image",
  label: "Meta Image",
  datatype: "images",
  description:
    "This field allows you to set an open graph image via the SEO tab. An Open Graph (OG) image is\u00a0an image that appears on a social media post when a web page is shared.",
  required: false,
  sort: 9999,
  settings: { defaultValue: null, group_id: "", limit: 1, list: false }
};
const FIRST_SORT = 10000; // where the Manager starts user fields
const NAME = /^[a-z][a-z0-9_]*$/;

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const [CMD, ...ARGS] = argv.filter((a) => !a.startsWith("--"));

// ---------- spec → API payload ----------

// Settings the Manager writes for each type, so API-made fields match
// hand-made ones (repeaters are hidden from the item list; scalars shown).
function baseSettings(f) {
  if (f.datatype === "repeater") return { list: false };
  const s = { defaultValue: null, list: true };
  if (f.datatype === "dropdown") s.options = f.options;
  if (f.datatype === "yes_no") s.options = f.options ?? { 0: "No", 1: "Yes" };
  if (f.datatype === "images" || f.datatype === "files") s.limit = f.limit ?? 1;
  if (f.datatype === "currency") s.currency = f.currency ?? "USD";
  return s;
}

// Collects every problem in the spec instead of stopping at the first, so one
// dry run shows everything to fix.
function validateFields(fields, { where, sub = false, taken = new Set() }) {
  const errors = [];
  if (!Array.isArray(fields) || fields.length === 0) return [`${where}: needs a non-empty fields list`];
  const seen = new Set(taken);
  fields.forEach((f, i) => {
    const at = `${where}.${f?.name || `#${i}`}`;
    if (!f || typeof f !== "object") return errors.push(`${at}: not an object`);
    if (!NAME.test(f.name || "")) errors.push(`${at}: name must be snake_case (a-z, 0-9, _)`);
    if (seen.has(f.name)) errors.push(`${at}: duplicate name`);
    seen.add(f.name);
    if (!f.label) errors.push(`${at}: needs a label`);
    const allowed = sub ? SUB_DATATYPES : DATATYPES;
    if (!allowed.includes(f.datatype)) {
      errors.push(
        `${at}: datatype "${f.datatype}" not allowed${sub ? " in a repeater (no relations, no nesting)" : ""}`
      );
    }
    if (f.datatype === "dropdown") {
      const keys = Object.keys(f.options || {});
      if (keys.length === 0) errors.push(`${at}: dropdown needs options { value: label }`);
      if (keys.some((k) => !f.options[k])) errors.push(`${at}: every option needs a label`);
    }
    if (f.datatype === "repeater") {
      errors.push(...validateFields(f.subFields, { where: at, sub: true }));
    } else if (f.subFields) {
      errors.push(`${at}: subFields only apply to a repeater`);
    }
    if (RELATIONAL.includes(f.datatype) && !f.relatedModel) {
      errors.push(`${at}: ${f.datatype} needs relatedModel (and relatedField to display)`);
    }
  });
  return errors;
}

async function resolveRelation(f) {
  const model = await findModel(f.relatedModel);
  if (!model) throw new UsageError(`${f.name}: related model "${f.relatedModel}" not found`);
  let fieldZUID = null;
  if (f.relatedField) {
    const field = (await fieldsOf(model)).find(
      (x) => x.ZUID === f.relatedField || x.name === f.relatedField
    );
    if (!field) throw new UsageError(`${f.name}: "${model.name}" has no field "${f.relatedField}"`);
    fieldZUID = field.ZUID;
  }
  return { relatedModelZUID: model.ZUID, relatedFieldZUID: fieldZUID };
}

async function fieldPayload(f, sort, { sub = false } = {}) {
  const settings = { ...baseSettings(f), ...(f.settings || {}) };
  if (f.datatype === "repeater") {
    settings.subFields = await Promise.all(f.subFields.map((s, i) => fieldPayload(s, i, { sub: true })));
  }
  const payload = {
    name: f.name,
    label: f.label,
    datatype: f.datatype,
    description: f.description ?? "",
    required: Boolean(f.required),
    sort,
    settings
  };
  if (!sub && RELATIONAL.includes(f.datatype)) Object.assign(payload, await resolveRelation(f));
  return payload;
}

async function fieldPayloads(fields, startSort) {
  const out = [];
  for (const [i, f] of fields.entries()) out.push(await fieldPayload(f, startSort + i));
  return out;
}

// ---------- API payload → spec (show) ----------

const STRIP = { defaultValue: null, group_id: "" };

async function fieldSpec(f, { sub = false } = {}) {
  const spec = { name: f.name, label: f.label, datatype: f.datatype };
  if (f.description) spec.description = f.description;
  if (f.required) spec.required = true;
  const rest = { ...(f.settings || {}) };
  for (const [k, v] of Object.entries(STRIP)) if (rest[k] === v) delete rest[k];
  if (rest.list === (f.datatype !== "repeater")) delete rest.list;
  if (rest.options && Object.keys(rest.options).length === 0) delete rest.options;
  if (["dropdown", "yes_no"].includes(f.datatype) && rest.options) {
    spec.options = rest.options;
    delete rest.options;
  }
  if (["images", "files"].includes(f.datatype) && "limit" in rest) {
    if (rest.limit !== 1) spec.limit = rest.limit;
    delete rest.limit;
  }
  if (f.datatype === "currency" && rest.currency) {
    if (rest.currency !== "USD") spec.currency = rest.currency;
    delete rest.currency;
  }
  if (f.datatype === "repeater") {
    spec.subFields = await Promise.all((rest.subFields || []).map((s) => fieldSpec(s, { sub: true })));
    delete rest.subFields;
  }
  if (!sub && f.relatedModelZUID) {
    const model = await findModel(f.relatedModelZUID);
    spec.relatedModel = model?.name ?? f.relatedModelZUID;
    if (f.relatedFieldZUID && model) {
      const field = (await fieldsOf(model)).find((x) => x.ZUID === f.relatedFieldZUID);
      spec.relatedField = field?.name ?? f.relatedFieldZUID;
    }
  }
  if (Object.keys(rest).length) spec.settings = rest;
  return spec;
}

const bySort = (a, b) => a.sort - b.sort;

// ---------- block view ----------

// Zesty generates a view for a new block model (views/-/block/<name>.html).
// It can lag the model, so wait for it before pulling.
async function waitForModelView(model) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const views = await api("GET", "web/views");
    const view = views.find((v) => v.status === "dev" && v.contentModelZUID === model.ZUID);
    if (view) return view.fileName;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

// ---------- commands ----------

function printPlan(title, payloads) {
  console.log(title);
  for (const p of payloads) {
    const extra =
      p.datatype === "repeater"
        ? ` [${p.settings.subFields.map((s) => `${s.name}:${s.datatype}`).join(", ")}]`
        : p.datatype === "dropdown"
          ? ` {${Object.keys(p.settings.options).join(" | ")}}`
          : p.relatedModelZUID
            ? ` → ${p.relatedModelZUID}`
            : "";
    console.log(`  ${String(p.sort).padEnd(6)} ${p.name.padEnd(28)} ${p.datatype}${extra}`);
  }
}

// Gives a block model the Manager's og_image when it lacks one.
async function ensureAutoFields(model, existing) {
  if (model.type !== "block" || existing.some((f) => f.name === OG_IMAGE_FIELD.name)) return false;
  if (DRY) {
    console.log("Would add the Manager's Meta Image field (og_image, sort 9999).");
    return false;
  }
  const data = await api("POST", `content/models/${model.ZUID}/fields`, OG_IMAGE_FIELD);
  console.log(`Added the Manager's Meta Image field: og_image ${data.ZUID}`);
  return true;
}

async function addFields(model, fields, existing) {
  const taken = new Set(existing.map((f) => f.name));
  const errors = validateFields(fields, { where: model.name, taken });
  if (errors.length) throw new UsageError(`spec has ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  const start = Math.max(FIRST_SORT - 1, ...existing.map((f) => f.sort)) + 1;
  const payloads = await fieldPayloads(fields, start);
  printPlan(`${DRY ? "Would add" : "Adding"} ${payloads.length} field(s) to ${model.name} (${model.ZUID}):`, payloads);
  if (DRY) {
    console.log(JSON.stringify(payloads, null, 2));
    return;
  }
  const done = [];
  for (const p of payloads) {
    try {
      const data = await api("POST", `content/models/${model.ZUID}/fields`, p);
      done.push(`${p.name} ${data.ZUID}`);
    } catch (e) {
      const left = payloads.slice(done.length).map((x) => x.name);
      throw new UsageError(
        `${e.message}\nCreated before the failure: ${done.join(", ") || "none"}\nNot created: ${left.join(", ")}`
      );
    }
  }
  console.log(`Created: ${done.join(", ")}`);
}

async function cmdCreate(specPath) {
  const spec = readSpec(specPath);
  const errors = [];
  if (!NAME.test(spec.name || "")) errors.push("model name must be snake_case");
  if (!spec.label) errors.push("model needs a label");
  if (!MODEL_TYPES.includes(spec.type)) errors.push(`model type must be one of ${MODEL_TYPES.join(", ")}`);
  if (await findModel(spec.name)) errors.push(`a model named "${spec.name}" already exists (use add-fields)`);
  const taken = new Set(spec.type === "block" ? AUTO_FIELDS : []);
  errors.push(...validateFields(spec.fields, { where: spec.name || "model", taken }));
  if (errors.length) throw new UsageError(`spec has ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);

  const modelPayload = {
    name: spec.name,
    label: spec.label,
    type: spec.type,
    description: spec.description ?? "",
    listed: Boolean(spec.listed)
  };
  if (spec.parentZUID) modelPayload.parentZUID = spec.parentZUID;

  if (DRY) {
    console.log(`Would create ${spec.type} model ${spec.name} ("${spec.label}")`);
    if (spec.type === "block") console.log("Plus the Manager's Meta Image field (og_image, sort 9999).");
    console.log(JSON.stringify(modelPayload, null, 2));
    const payloads = await fieldPayloads(spec.fields, FIRST_SORT);
    printPlan("Then its fields:", payloads);
    console.log(JSON.stringify(payloads, null, 2));
    return;
  }

  const created = await api("POST", "content/models", modelPayload);
  const model = { ...modelPayload, ...created };
  await models({ fresh: true });
  console.log(`Created ${spec.type} model ${spec.name}: ${model.ZUID}`);
  await ensureAutoFields(model, await fieldsOf(model));
  await addFields(model, spec.fields, await fieldsOf(model));

  const view = await waitForModelView(model);
  console.log(view ? `Zesty generated its view: views${view}` : "No view for it on the instance yet.");
  pullToLocal();
}

async function cmdAddFields(modelRef, specPath) {
  const model = await requireModel(modelRef);
  const spec = readSpec(specPath);
  const fields = Array.isArray(spec) ? spec : spec.fields;
  const existing = await fieldsOf(model);
  const names = new Set(existing.map((f) => f.name));
  const skipped = (fields || []).filter((f) => names.has(f.name)).map((f) => f.name);
  if (skipped.length) console.log(`Already on ${model.name}, skipped: ${skipped.join(", ")}`);
  const fresh = (fields || []).filter((f) => !names.has(f.name) && !AUTO_FIELDS.includes(f.name));
  const added = await ensureAutoFields(model, existing);
  if (fresh.length === 0) {
    console.log("No spec fields to add.");
  } else {
    await addFields(model, fresh, existing);
  }
  if (!DRY && (added || fresh.length)) pullToLocal();
}

async function cmdUpdateField(modelRef, fieldRef, patchPath) {
  const model = await requireModel(modelRef);
  const field = (await fieldsOf(model)).find((f) => f.ZUID === fieldRef || f.name === fieldRef);
  if (!field) throw new UsageError(`${model.name} has no field "${fieldRef}"`);
  const patch = readSpec(patchPath);
  for (const k of ["name", "datatype"]) {
    if (k in patch && patch[k] !== field[k]) {
      throw new UsageError(`${k} can't be changed here: views and stored content reference it`);
    }
  }

  // Edit the field as a spec, then rebuild the full payload: the API replaces
  // settings wholesale, so a partial PUT would wipe options and sub-fields.
  const before = await fieldSpec(field);
  const after = structuredClone(before);
  for (const k of ["label", "description", "required", "limit", "currency"]) if (k in patch) after[k] = patch[k];
  if (patch.options) {
    const dropped = Object.entries(patch.options).filter(([, v]) => v === null);
    if (dropped.length) throw new UsageError("options can't be removed here: items may still hold them");
    after.options = { ...(before.options || {}), ...patch.options };
  }
  if (patch.settings) after.settings = { ...(before.settings || {}), ...patch.settings };
  if (patch.subFields) {
    const subs = [...(before.subFields || [])];
    for (const s of patch.subFields) {
      const i = subs.findIndex((x) => x.name === s.name);
      if (i === -1) subs.push(s);
      else {
        if (s.datatype && s.datatype !== subs[i].datatype) {
          throw new UsageError(`sub-field ${s.name}: datatype can't be changed`);
        }
        subs[i] = { ...subs[i], ...s, options: s.options ? { ...subs[i].options, ...s.options } : subs[i].options };
      }
    }
    after.subFields = subs;
  }

  const errors = validateFields([after], { where: model.name });
  if (errors.length) throw new UsageError(`result has ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  if ("sort" in patch && !Number.isInteger(patch.sort)) throw new UsageError("sort must be an integer");
  const sort = patch.sort ?? field.sort;
  const payload = await fieldPayload(after, sort);
  delete payload.datatype; // not updatable
  if (!RELATIONAL.includes(field.datatype)) {
    payload.relatedModelZUID = field.relatedModelZUID;
    payload.relatedFieldZUID = field.relatedFieldZUID;
  }

  if (JSON.stringify(before) === JSON.stringify(after) && sort === field.sort) return console.log("No change.");
  if (sort !== field.sort) console.log(`sort: ${field.sort} → ${sort}`);
  console.log(`${DRY ? "Would update" : "Updating"} ${model.name}.${field.name} (${field.ZUID})`);
  console.log("before:", JSON.stringify(before));
  console.log("after: ", JSON.stringify(after));
  if (DRY) return console.log(JSON.stringify(payload, null, 2));
  await api("PUT", `content/models/${model.ZUID}/fields/${field.ZUID}`, payload);
  console.log("Updated.");
  pullToLocal();
}

async function main() {
  requireSetup();
  if (CMD === "list") {
    for (const m of [...(await models())].sort((a, b) => (a.type + a.name).localeCompare(b.type + b.name))) {
      console.log(`${m.type.padEnd(12)} ${m.name.padEnd(40)} ${m.ZUID}  ${m.label}`);
    }
  } else if (CMD === "show") {
    const model = await requireModel(ARGS[0]);
    const fields = (await fieldsOf(model)).sort(bySort).filter((f) => !AUTO_FIELDS.includes(f.name));
    const spec = { name: model.name, label: model.label, type: model.type };
    if (model.description) spec.description = model.description;
    spec.fields = await Promise.all(fields.map((f) => fieldSpec(f)));
    console.log(JSON.stringify(spec, null, 2));
  } else if (CMD === "create") {
    await cmdCreate(ARGS[0]);
  } else if (CMD === "add-fields") {
    await cmdAddFields(ARGS[0], ARGS[1]);
  } else if (CMD === "update-field") {
    await cmdUpdateField(ARGS[0], ARGS[1], ARGS[2]);
  } else {
    throw new UsageError(`unknown command "${CMD ?? ""}" (list | show | create | add-fields | update-field)`);
  }
}

run("zesty-model", main);
