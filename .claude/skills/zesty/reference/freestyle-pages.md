# Freestyle pages (page visual layout) — building one through the API

First done on 2026-11-09 with **Rentals** (`/rentals/`, item `7-cabfa2bbfc-lznvn7`). Japheth asked whether a Freestyle page could be built programmatically, using the homepage as the example. It can.

## How Freestyle is stored

A Freestyle page's layout is **two view files named after the page item's ZUID**, both type `ajax-json`. `zesty-sync.mjs` syncs them like any other view.

| File | What it is |
|---|---|
| `views/z/pvl/<7-item-zuid>.json` | The Manager's editable tree. `layout:root:column:0` holds `children`, keyed `content:block:<6-model-zuid>:<position>:<random>`, each `{html, content, model, name, position, fullName, type:"block", primarytype:"content", newLoc:"layout:root:column:0", oldLoc:"bank"}`. `html` and `content` are the block call. |
| `views/z/pvl/<7-item-zuid>.zhtml` | The compiled layout that WebEngine renders: `<div className={styles.pvlRoot}>` with one `{{block('/-/block/<model>.html?variant=<7-zuid>')}}` per line, in order. |

`views/z/layouts/layouts.json` defines the Manager's row and column presets (2 columns etc.). Every KROC page so far is a single root column, and blocks own their own grids.

**The page view must call `{{ this.autolayout(auto) }}`.** That renders the `.zhtml` inside `<div class="pvl-container">`. A bare `{{ this.autolayout() }}` ignored the layout and printed the item's fields as `pal-*` markup (found on `informational_pages`; fixed 2026-11-09).

## Recipe

**Use `scripts/zesty-page.mjs build <page.json>`** (2026-11-09; built Careers). It does steps 2–4 below: resolves every `[model, variant name or ZUID]`, creates the item if no item of the model has that path, writes and pushes both layout files, then checks every block rendered in order. `--dry-run` prints the plan; `show <path>` lists a page's layout. Record each page in `KROC-draft/page-builds.md`: every design section, with each missing one and the reason.

The manual steps, for reference:

1. **Variants first:** every block the page needs, with the design's copy (`zesty-variant.mjs create`).
2. **The page item:** `POST content/models/<page-model>/items` with `data` (the required fields), `web {pathPart, metaTitle, metaLinkText, parentZUID:"0", canonicalTagMode:1, sitemapPriority:-1}`, and `meta {listed:true, langID:1}`.
   - Check the path is free first (a GET returns 404).
   - `zesty-variant.mjs` only makes block items, so a one-off script using `zesty-api.mjs`'s `api()` + `pullToLocal()` did this.
3. **The layout:** write both `z/pvl/<item>.json` and `.zhtml` in the shapes above, then `zesty-sync.mjs push` both. A scan never creates files.
4. **Verify:** fetch the page and check every block's section id (`kroc-<block>-<7-zuid>`) appears, in order, inside `pvl-container`.

## Gotchas

- **A block call to a variant that no longer exists fails the whole page with HTTP 400**, not just that block. On 2026-11-09 the homepage was 400 because its layout still named the deleted Family Play "(copy)" variant `7-dce2dae3a3-j1khws`. When a variant is deleted, remove it from every `z/pvl/*.zhtml` (and `.json`).
- An API-made page item has `version: null` until it is saved in the Manager. Dev renders it anyway; the live domain needs a publish.
- **Unverified:** that the Manager's Layout editor opens an API-written `.json` cleanly and shows its blocks. Open the page once in the Manager to check before relying on it.
