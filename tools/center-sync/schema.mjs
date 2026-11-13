// Models as files: read an instance's models into the same JSON spec the
// skill's zesty-model.mjs uses (show/create/add-fields), diff schema/ against
// a center, and apply the difference. Everything is matched by NAME (model
// name, field name, related model/field name, parent page model), because
// ZUIDs differ on every instance.
//
// Spec extras over zesty-model.mjs: `listed`, `parent` and each field's `sort`
// (so field order matches the main instance exactly). zesty-model.mjs ignores
// all three, so a schema file still works with `create` / `add-fields`.

import { mapLimit } from "./zesty.mjs";

export const RELATIONAL = ["one_to_one", "one_to_many"];
export const AUTO_FIELDS = ["og_image"]; // the Manager adds it to every block model
// Copied from zesty-model.mjs: the Manager's Meta Image field. The API never
// adds it, and blocks_catalog_page reads variant ZUIDs from it.
export const OG_IMAGE_FIELD = {
  name: "og_image",
  label: "Meta Image",
  datatype: "images",
  description:
    "This field allows you to set an open graph image via the SEO tab. An Open Graph (OG) image is an image that appears on a social media post when a web page is shared.",
  required: false,
  sort: 9999,
  settings: { defaultValue: null, group_id: "", limit: 1, list: false }
};
const FIRST_SORT = 10000;

// ---------- reading an instance ----------

export async function readInstance(c) {
  const models = (await c.api("GET", "content/models")) || [];
  const fields = await mapLimit(models, 6, (m) =>
    c.api("GET", `content/models/${m.ZUID}/fields?showDeleted=true`)
  );
  const state = {
    models,
    modelByName: new Map(models.map((m) => [m.name, m])),
    modelByZuid: new Map(models.map((m) => [m.ZUID, m])),
    fieldsOf: new Map(models.map((m, i) => [m.ZUID, fields[i] || []])), // deactivated included
    pageItemByModel: new Map(),
    modelByPageItem: new Map()
  };
  // A model nested under a page points at that page's item (7-…). Pages are
  // the single item of a templateset model, so they're named by that model.
  const pages = models.filter((m) => m.type === "templateset");
  const items = await mapLimit(pages, 6, (m) => c.api("GET", `content/models/${m.ZUID}/items?limit=5`));
  pages.forEach((m, i) => notePageItem(state, m.name, (items[i] || [])[0]?.meta?.ZUID));
  return state;
}

function notePageItem(state, modelName, itemZuid) {
  if (!itemZuid) return;
  state.pageItemByModel.set(modelName, itemZuid);
  state.modelByPageItem.set(itemZuid, modelName);
}

const isActive = (f) => !f.deletedAt;
export const activeFields = (state, m) => state.fieldsOf.get(m.ZUID).filter(isActive);

// ---------- instance → spec ----------

const STRIP = { defaultValue: null, group_id: "" };

function fieldSpec(state, f, { sub = false } = {}) {
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
    spec.subFields = (rest.subFields || []).map((s) => fieldSpec(state, s, { sub: true }));
    delete rest.subFields;
  }
  if (!sub && f.relatedModelZUID) {
    const model = state.modelByZuid.get(f.relatedModelZUID);
    spec.relatedModel = model?.name ?? `unresolved:${f.relatedModelZUID}`;
    if (f.relatedFieldZUID) {
      const field = model && state.fieldsOf.get(model.ZUID).find((x) => x.ZUID === f.relatedFieldZUID);
      spec.relatedField = field?.name ?? `unresolved:${f.relatedFieldZUID}`;
    }
  }
  if (Object.keys(rest).length) spec.settings = rest;
  if (!sub) spec.sort = f.sort;
  return spec;
}

function parentSpec(state, parentZUID) {
  if (!parentZUID || parentZUID === "0") return null;
  if (parentZUID.startsWith("6-")) {
    const m = state.modelByZuid.get(parentZUID);
    return m ? { model: m.name } : { unresolved: parentZUID };
  }
  const page = state.modelByPageItem.get(parentZUID);
  return page ? { page } : { unresolved: parentZUID };
}

export function modelSpec(state, m) {
  const spec = { name: m.name, label: m.label, type: m.type };
  if (m.description) spec.description = m.description;
  spec.listed = Boolean(m.listed);
  // A parent that no longer exists (a deleted model/page) behaves as no parent
  // and can't be recreated elsewhere, so it's left out; export warns about it.
  const parent = parentSpec(state, m.parentZUID);
  if (parent && !parent.unresolved) spec.parent = parent;
  spec.fields = activeFields(state, m)
    .filter((f) => !AUTO_FIELDS.includes(f.name))
    .sort((a, b) => a.sort - b.sort)
    .map((f) => fieldSpec(state, f));
  return spec;
}

// Refuse to write anything that looks like a credential: schema/ is committed
// (and this repo is public). test_page's integration field once held a
// Salesforce bearer token in its settings.
const SECRETISH = [/\bbearer\s+\S{12,}/i, /\beyJ[\w-]{10,}\.[\w-]{10,}/, /\bPTK-[\w-]{10,}/, /"[A-Za-z0-9+/_-]{40,}"/];
export function secretsIn(spec) {
  const text = JSON.stringify(spec);
  return SECRETISH.filter((re) => re.test(text)).map(String);
}

// ---------- spec → API payload ----------

function baseSettings(f) {
  if (f.datatype === "repeater") return { list: false };
  const s = { defaultValue: null, list: true };
  if (f.datatype === "dropdown") s.options = f.options;
  if (f.datatype === "yes_no") s.options = f.options ?? { 0: "No", 1: "Yes" };
  if (f.datatype === "images" || f.datatype === "files") s.limit = f.limit ?? 1;
  if (f.datatype === "currency") s.currency = f.currency ?? "USD";
  return s;
}

function relationOn(state, f) {
  const model = state.modelByName.get(f.relatedModel);
  if (!model) throw new Error(`${f.name}: related model "${f.relatedModel}" isn't on the instance`);
  let relatedFieldZUID = null;
  if (f.relatedField) {
    const field = activeFields(state, model).find((x) => x.name === f.relatedField);
    if (!field) throw new Error(`${f.name}: "${model.name}" has no field "${f.relatedField}"`);
    relatedFieldZUID = field.ZUID;
  }
  return { relatedModelZUID: model.ZUID, relatedFieldZUID };
}

function fieldPayload(state, f, { sub = false, sort } = {}) {
  const settings = { ...baseSettings(f), ...(f.settings || {}) };
  if (f.datatype === "repeater") {
    settings.subFields = (f.subFields || []).map((s, i) => fieldPayload(state, s, { sub: true, sort: i }));
  }
  const payload = {
    name: f.name,
    label: f.label,
    datatype: f.datatype,
    description: f.description ?? "",
    required: Boolean(f.required),
    sort: sort ?? f.sort,
    settings
  };
  if (!sub && RELATIONAL.includes(f.datatype)) Object.assign(payload, relationOn(state, f));
  return payload;
}

function parentZuidOn(state, parent) {
  if (!parent) return "0";
  if (parent.model) {
    const m = state.modelByName.get(parent.model);
    if (!m) throw new Error(`parent model "${parent.model}" isn't on the instance`);
    return m.ZUID;
  }
  if (parent.page) {
    const z = state.pageItemByModel.get(parent.page);
    if (!z) throw new Error(`parent page "${parent.page}" has no item on the instance`);
    return z;
  }
  throw new Error(`parent ${JSON.stringify(parent)} can't be resolved`);
}

// ---------- diff ----------

const canon = (v) =>
  JSON.stringify(v, (k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]]))
      : x
  );

function droppedOptions(before, after) {
  const keep = new Set(Object.keys(after.options || {}));
  return Object.keys(before.options || {}).filter((k) => !keep.has(k));
}

// Ops, each tagged with the gate that allows it:
//   additive  — create model, update model attrs, add/undelete/update field (every stage merge)
//   removals  — remove what schema/removed.json lists (run by hand, after production)
//   prune     — make a center exactly match schema/: delete extras, recreate type conflicts
//               (run by hand, for onboarding a center)
//   report    — never applied: conflicts and extras, shown for a person to decide
export function planSchema(specs, state, { removed = {}, exclude = [] } = {}) {
  const ops = [];
  const add = (op) => ops.push(op);
  const wanted = new Set(specs.map((s) => s.name));
  const skip = new Set(exclude);
  const removedFields = removed.fields || {};
  // A new model is the model plus every one of its fields.
  const createWithFields = (spec, gate) => {
    add({ gate, op: "create-model", model: spec.name, spec });
    if (spec.type === "block") add({ gate, op: "add-field", model: spec.name, field: OG_IMAGE_FIELD, raw: true });
    for (const f of spec.fields) add({ gate, op: "add-field", model: spec.name, field: f });
  };

  for (const spec of specs) {
    const m = state.modelByName.get(spec.name);
    if (!m) {
      createWithFields(spec, "additive");
      continue;
    }
    if (m.type !== spec.type) {
      add({ gate: "report", op: "conflict", model: spec.name, detail: `type is ${m.type}, schema says ${spec.type}` });
      add({ gate: "prune", op: "remove-model", model: spec.name, hard: true, reason: "type conflict" });
      createWithFields(spec, "prune");
      continue;
    }

    const cur = modelSpec(state, m);
    const changes = {};
    for (const k of ["label", "description", "listed"]) {
      if ((cur[k] ?? "") !== (spec[k] ?? "")) changes[k] = { from: cur[k], to: spec[k] };
    }
    if (canon(cur.parent ?? null) !== canon(spec.parent ?? null)) {
      changes.parent = { from: cur.parent ?? null, to: spec.parent ?? null };
    }
    if (Object.keys(changes).length) add({ gate: "additive", op: "update-model", model: spec.name, changes, spec });

    const all = state.fieldsOf.get(m.ZUID);
    const live = new Map(all.filter(isActive).map((f) => [f.name, f]));
    const dead = new Map(all.filter((f) => !isActive(f)).map((f) => [f.name, f]));

    if (spec.type === "block" && !live.has("og_image")) {
      add({ gate: "additive", op: "add-field", model: spec.name, field: OG_IMAGE_FIELD, raw: true });
    }

    for (const f of spec.fields) {
      const now = live.get(f.name);
      if (!now) {
        const gone = dead.get(f.name);
        if (gone && gone.datatype === f.datatype) {
          add({ gate: "additive", op: "undelete-field", model: spec.name, field: f, zuid: gone.ZUID });
        } else if (gone) {
          add({ gate: "report", op: "conflict", model: spec.name, field: f.name, detail: `a deactivated ${gone.datatype} field holds the name; schema says ${f.datatype}` });
          add({ gate: "prune", op: "remove-field", model: spec.name, field: f.name, zuid: gone.ZUID, hard: true, deactivated: true, reason: "name held by a deactivated field" });
          add({ gate: "prune", op: "add-field", model: spec.name, field: f });
        } else {
          add({ gate: "additive", op: "add-field", model: spec.name, field: f });
        }
        continue;
      }
      if (now.datatype !== f.datatype) {
        add({ gate: "report", op: "conflict", model: spec.name, field: f.name, detail: `datatype is ${now.datatype}, schema says ${f.datatype}` });
        add({ gate: "prune", op: "remove-field", model: spec.name, field: f.name, zuid: now.ZUID, hard: true, reason: "datatype conflict" });
        add({ gate: "prune", op: "add-field", model: spec.name, field: f });
        continue;
      }
      const before = fieldSpec(state, now);
      if (canon(before) !== canon(f)) {
        const lost = droppedOptions(before, f);
        add({ gate: "additive", op: "update-field", model: spec.name, field: f, zuid: now.ZUID, before, lostOptions: lost });
      }
    }

    const named = new Set([...spec.fields.map((f) => f.name), ...AUTO_FIELDS]);
    for (const f of live.values()) {
      if (named.has(f.name)) continue;
      if ((removedFields[spec.name] || []).includes(f.name)) {
        add({ gate: "removals", op: "remove-field", model: spec.name, field: f.name, zuid: f.ZUID, hard: false, reason: "listed in removed.json" });
      } else {
        add({ gate: "report", op: "extra-field", model: spec.name, field: f.name, detail: `${f.datatype}, not in schema` });
        add({ gate: "prune", op: "remove-field", model: spec.name, field: f.name, zuid: f.ZUID, hard: true, reason: "not in schema" });
      }
    }
  }

  for (const m of state.models) {
    if (wanted.has(m.name) || skip.has(m.name)) continue;
    if ((removed.models || []).includes(m.name)) {
      add({ gate: "removals", op: "remove-model", model: m.name, reason: "listed in removed.json" });
    } else {
      add({ gate: "report", op: "extra-model", model: m.name, detail: `${m.type}, not in schema` });
      add({ gate: "prune", op: "remove-model", model: m.name, hard: true, reason: "not in schema" });
    }
  }
  return ops;
}

// ---------- apply ----------

const waitFor = async (fn, tries = 8) => {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
};

// Applies the ops whose gate is in `gates`, in dependency order:
// deletes → new models → model attrs (parents) → plain fields → relation fields → updates.
export async function applySchema(c, state, ops, { gates, dry, log }) {
  const run = ops.filter((o) => gates.includes(o.gate) && o.gate !== "report");
  // A prune pass shadows the additive op for the same field/model.
  const errors = [];
  const step = async (label, fn) => {
    if (dry) return log(`  [dry-run] ${label}`);
    try {
      await fn();
      log(`  ✓ ${label}`);
    } catch (e) {
      errors.push(`${label}: ${e.message}`);
      log(`  ✗ ${label}: ${e.message}`);
    }
  };
  const of = (name) => state.modelByName.get(name);

  // 1. field deletes (before model deletes, so relations to a doomed model go first)
  for (const o of run.filter((o) => o.op === "remove-field")) {
    const m = of(o.model);
    await step(`${o.hard ? "delete" : "deactivate"} field ${o.model}.${o.field} (${o.reason})`, async () => {
      if (!o.deactivated) await c.api("DELETE", `content/models/${m.ZUID}/fields/${o.zuid}`);
      if (o.hard) await c.api("DELETE", `content/models/${m.ZUID}/fields/${o.zuid}?hardDelete=true`);
      const list = state.fieldsOf.get(m.ZUID);
      const i = list.findIndex((f) => f.ZUID === o.zuid);
      if (i !== -1) {
        if (o.hard) list.splice(i, 1);
        else list[i] = { ...list[i], deletedAt: new Date().toISOString() };
      }
    });
  }

  // 2. model deletes
  for (const o of run.filter((o) => o.op === "remove-model")) {
    const m = of(o.model);
    await step(`delete model ${o.model} (${o.reason})`, async () => {
      const inbound = state.models
        .filter((x) => x.ZUID !== m.ZUID)
        .flatMap((x) => activeFields(state, x).filter((f) => f.relatedModelZUID === m.ZUID).map((f) => `${x.name}.${f.name}`));
      if (inbound.length) throw new Error(`still related to by ${inbound.join(", ")}`);
      await c.api("DELETE", `content/models/${m.ZUID}`);
      state.models = state.models.filter((x) => x.ZUID !== m.ZUID);
      state.modelByName.delete(m.name);
      state.modelByZuid.delete(m.ZUID);
    });
  }

  // 3. new models (fields come later, once every model exists for relations)
  const created = run.filter((o) => o.op === "create-model");
  for (const o of created) {
    const s = o.spec;
    await step(`create ${s.type} model ${s.name}`, async () => {
      const payload = { name: s.name, label: s.label, type: s.type, description: s.description ?? "", listed: Boolean(s.listed) };
      const data = await c.api("POST", "content/models", payload);
      const m = { ...payload, ...data, parentZUID: "0" };
      state.models.push(m);
      state.modelByName.set(m.name, m);
      state.modelByZuid.set(m.ZUID, m);
      state.fieldsOf.set(m.ZUID, []);
    });
  }
  // A new single-page model gets its page item from Zesty; parents may need it.
  for (const o of created.filter((o) => o.spec.type === "templateset")) {
    const m = of(o.model);
    if (!m || dry) continue;
    const z = await waitFor(async () => (await c.api("GET", `content/models/${m.ZUID}/items?limit=1`))?.[0]?.meta?.ZUID);
    if (z) notePageItem(state, m.name, z);
    else log(`  ! ${m.name}: no page item appeared; models nested under it will fail`);
  }

  // 4. model attributes (label/description/listed/parent), including parents of new models
  const attrOps = [
    ...run.filter((o) => o.op === "update-model"),
    ...created.filter((o) => o.spec.parent).map((o) => ({ op: "update-model", model: o.model, spec: o.spec, changes: { parent: { to: o.spec.parent } } }))
  ];
  for (const o of attrOps) {
    const m = of(o.model);
    const what = Object.entries(o.changes).map(([k, v]) => `${k} → ${JSON.stringify(v.to)}`).join(", ");
    await step(`update model ${o.model}: ${what}`, async () => {
      if (!m) throw new Error("model not on the instance");
      const s = o.spec;
      const payload = {
        name: m.name,
        type: m.type,
        label: s.label,
        description: s.description ?? "",
        listed: Boolean(s.listed),
        parentZUID: parentZuidOn(state, s.parent ?? null)
      };
      await c.api("PUT", `content/models/${m.ZUID}`, payload);
      Object.assign(m, payload);
    });
  }

  // 5. fields: undeletes, then plain adds, then relation adds (their targets exist now)
  for (const o of run.filter((o) => o.op === "undelete-field")) {
    const m = of(o.model);
    await step(`restore deactivated field ${o.model}.${o.field.name}`, async () => {
      await c.api("PUT", `content/models/${m.ZUID}/fields/${o.zuid}?action=undelete`, {});
      const list = state.fieldsOf.get(m.ZUID);
      const f = list.find((x) => x.ZUID === o.zuid);
      if (f) delete f.deletedAt;
    });
    // bring it in line with the schema after restoring
    o.after = { op: "update-field", model: o.model, field: o.field, zuid: o.zuid };
  }
  const adds = run.filter((o) => o.op === "add-field");
  const plain = adds.filter((o) => !RELATIONAL.includes(o.field.datatype));
  const rel = adds.filter((o) => RELATIONAL.includes(o.field.datatype));
  for (const o of [...plain, ...rel]) {
    const m = of(o.model);
    await step(`add field ${o.model}.${o.field.name} (${o.field.datatype})`, async () => {
      if (!m) throw new Error("model not on the instance");
      const payload = o.raw ? o.field : fieldPayload(state, o.field, { sort: o.field.sort ?? FIRST_SORT });
      const data = await c.api("POST", `content/models/${m.ZUID}/fields`, payload);
      state.fieldsOf.get(m.ZUID).push({ ...payload, ZUID: data.ZUID });
    });
  }

  // 6. updates (label, description, required, options, settings, sub-fields, relation, sort)
  const updates = [...run.filter((o) => o.op === "update-field"), ...run.filter((o) => o.after).map((o) => o.after)];
  for (const o of updates) {
    const m = of(o.model);
    const note = o.lostOptions?.length ? ` (options ${o.lostOptions.map((k) => JSON.stringify(k)).join(", ")} dropped)` : "";
    await step(`update field ${o.model}.${o.field.name}${note}`, async () => {
      const payload = fieldPayload(state, o.field);
      delete payload.datatype; // not updatable
      if (!RELATIONAL.includes(o.field.datatype)) Object.assign(payload, { relatedModelZUID: null, relatedFieldZUID: null });
      await c.api("PUT", `content/models/${m.ZUID}/fields/${o.zuid}`, payload);
    });
  }
  return { errors, applied: dry ? 0 : run.length - errors.length, planned: run.length };
}

// ---------- summaries ----------

export function describeOp(o) {
  const at = o.field ? `${o.model}.${typeof o.field === "string" ? o.field : o.field.name}` : o.model;
  switch (o.op) {
    case "create-model":
      return `create ${o.spec.type} model **${o.model}** (${o.spec.fields.length} fields${o.spec.parent ? `, under ${JSON.stringify(o.spec.parent)}` : ""})`;
    case "update-model":
      return `update model **${o.model}**: ${Object.entries(o.changes).map(([k, v]) => `${k} ${JSON.stringify(v.from ?? null)} → ${JSON.stringify(v.to ?? null)}`).join("; ")}`;
    case "add-field":
      return `add field **${at}** (${o.field.datatype})`;
    case "undelete-field":
      return `restore deactivated field **${at}**`;
    case "update-field": {
      const diff = Object.keys({ ...o.before, ...o.field }).filter((k) => canon(o.before?.[k]) !== canon(o.field[k]));
      return `update field **${at}**: ${diff.join(", ")}${o.lostOptions?.length ? ` ⚠ drops options ${o.lostOptions.map((k) => JSON.stringify(k)).join(", ")}` : ""}`;
    }
    case "remove-field":
      return `${o.hard ? "delete" : "deactivate"} field **${at}** (${o.reason})`;
    case "remove-model":
      return `delete model **${o.model}** with its items and views (${o.reason})`;
    default:
      return `**${at}**: ${o.detail}`;
  }
}
