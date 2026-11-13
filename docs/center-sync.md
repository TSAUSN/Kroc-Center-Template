# Center sync — one template repo, many center instances

This is Path A from the 11-12 architecture call
(`KROC-draft/meetings/11-12 gh architecture discussion/scaling-options.md`, §3 and §12).
**Kroc** (`8-80c0bba6b8-lhkcc7`) is the **main** instance, where models are
designed. Every instance listed in [`centers.json`](../centers.json) receives
the same **models** and **code** from this repo. Content (pages, block
variants, globals, `z/pvl` layouts) is **not** synced: every center keeps its
own.

Status: tested end to end against one test center, KROC National
(`8-cec38bc5e1-nkc8tg`), on 2026-11-13. Create, update and delete all pass
(§6).

## 1. What lives where

| | Source of truth | Reaches centers through |
| --- | --- | --- |
| Models + fields | `schema/models/<name>.json` (exported from main) | the model step at the **stage** merge (additive only) |
| Removed models / fields | `schema/removed.json` | the **manual** `schema-removals` run, after production |
| Code (`webengine/views`, `styles/main.less`, `scripts/main.js`) | `webengine/` | saved to dev at the **stage** merge, published at the **production** merge |
| Which centers, what not to sync | `centers.json` (`schemaExclude`, `codeExclude`) | — |

Everything is matched **by name**: model name, field name, related model and
field, a parent page by its model, and a view by its file name. ZUIDs differ
on every instance, so none are stored. (`zesty.config.json` is Kroc's own
file-to-ZUID map and is gitignored; the sync doesn't use it.)

Never synced (`codeExclude`):
- `views/z/**`: page layouts named after Kroc's own page items
- `views/tractionrec/**`: written per center by the TractionRec sync
- `views/_runner/**`, `test_page`, `custom-endpoints/test.json`: scratch
- `desktop_design.html`, `mobile_design.html`: prototype references
- `styles/tailwind.css`: build output, already inlined into `components/styles.html`

The `test_page` model is left out of `schema/` as well, because its
integration field once held a Salesforce token. The export refuses any model
that looks like it contains a credential, because this repo is public.

## 2. The flow

```mermaid
sequenceDiagram
  participant Dev
  participant Main as Main instance (Kroc)
  participant GH as GitHub
  participant C as Each center
  Dev->>Main: create / change the model (zesty-model.mjs)
  Dev->>GH: branch: schema/models/<name>.json + view + code
  Dev->>Main: preview at 6wz46m14-<branch>
  Dev->>GH: PR into stage
  GH-->>Dev: preview comment: model + code changes per center
  Dev->>GH: merge to stage
  GH->>C: 1. add models / fields  2. save code to dev
  Dev->>GH: merge stage → production
  GH->>C: publish the changed code
  Dev->>GH: (removals only) run "schema-removals" by hand
  GH->>C: deactivate fields / delete models in removed.json
```

**Branch previews:** `<center-hash>-<branch>.webengine.zesty.io` works on any
center that has the models and is linked to this repo (developer settings
`gh_username = TSAUSN`, `gh_repository = Kroc-Center-Template`). A branch that
**adds** a model previews only on the main instance until it's merged to stage.

## 3. Day to day

**New or changed model**
1. Make the change on the main instance with the `zesty` skill's
   `zesty-model.mjs` (`create`, `add-fields`, `update-field`).
2. Export **only that model**: `node tools/center-sync/cli.mjs export <model>`.
   Exporting everything would also pick up other branches' unfinished fields,
   because models aren't branched.
3. Commit the schema file together with the code that uses it.

**Code only:** commit as usual. The PR preview lists what each center will get.

**Removing a field or model:** do it in this order. The live sites must not
lose something the live code still reads.
1. Remove its use from the code, and remove it from the main instance and from
   `schema/` (delete the file for a model, the field entry for a field).
2. List it in `schema/removed.json` in the same PR. The preview shows it as
   "waiting for the manual run".
3. Merge to stage, then to production.
4. Run the **Center sync** workflow by hand with task `schema-removals`. Run it
   with *dry run* first, then for real.
5. Clear the entry from `removed.json`.

A deleted plain file (component, endpoint) is removed from every center by the
production merge. A deleted model view goes when its model is removed.

## 4. What the model step will and won't do

| Change | At the stage merge | Otherwise |
| --- | --- | --- |
| New model, new field, label / description / required / options / settings / sub-fields / relation / sort | applied | — |
| Dropped dropdown option | applied, flagged ⚠ in the preview | — |
| Field or model gone from `schema/` | reported only | `removed.json` + manual run |
| Datatype or model-type change, a center-only field or model | reported under "Needs a person" | change by hand, or `--prune` (below) |

`--prune` (CLI only) makes one center match `schema/` exactly. It deletes
fields and models the schema doesn't have, and recreates type conflicts. Use it
for onboarding a center, never as a routine step: it deletes content.

## 5. Commands

```bash
# main instance → schema/   (token: $ZESTY_TOKEN_MAIN or .vscode/settings.json)
node tools/center-sync/cli.mjs export [model…]

# what CI runs (center tokens: env vars named by each center's tokenEnv)
node tools/center-sync/cli.mjs deploy --branch stage|production [--center id] [--since <sha> | --full] [--dry-run] [--report out.md]

# by hand
node tools/center-sync/cli.mjs schema [--center id] [--removals] [--prune] [--dry-run]
```

Workflows: `.github/workflows/center-sync-preview.yml` posts the preview
comment on PRs into stage/production. `.github/workflows/center-sync.yml` runs
on stage/production pushes and by hand (`schema-one-center`,
`schema-removals`, `stage-full`, `production-full`; dry run is on by default).

## 6. Adding a center

1. Add it to `centers.json` with a `tokenEnv` name, and add a repo secret of
   that name holding the instance's developer token.
2. `schema --center <id> --prune --dry-run`, read the output, then run it
   without `--dry-run`.
3. Run the `stage-full` task (dry run first), then `production-full`.
4. Link the instance to this repo in its developer settings
   (`gh_username`, `gh_repository`).
5. Fill its content, starting with **Globals**: see the findings below.

## 7. Findings from the test (2026-11-13)

- **Creating a view through the API publishes it immediately.** A new file
  would go live at the stage merge. The sync creates it blank and then saves
  the real code as v2, so live stays blank until production publishes v2.
- **A single-page model created through the API gets no page item.** The
  Manager creates one, the API doesn't (`blocks_catalog_page`,
  `categories_page` on National have none). That page doesn't exist on the
  center until someone creates it, and nothing can be nested under it.
- **Empty Globals break the preview.** On a fresh center, `{{ globals.social_handles }}`
  in `components/shared.jsx` errors with "field doesn't exist on the globals
  content model" while the repeater is empty. Preview renders show the error
  and live renders hide it. Fill Globals, or make the read empty-safe.
- **WebEngine caches renders.** Right after a sync the dev preview can serve
  the old template for a few minutes.
- **Kroc-only IDs in code:** `loader` lists the Blocks Catalog item ZUID, but
  also matches by path, so it still works on centers. The four unbuilt block
  placeholders (`custom_forms`, `custom_navigation`, `external_embed`,
  `featured_classes`) link to Kroc's Manager. The sync never copies a
  placeholder, so each center keeps its own.
- **The skill's auto-push hook** still writes edits straight to Kroc's dev
  version. In this flow Kroc is the main instance, so that's fine for Kroc,
  but centers only change through GitHub.
