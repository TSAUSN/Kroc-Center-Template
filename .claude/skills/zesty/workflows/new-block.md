# Build a new block

The user names a block from the tickets ("proceed to Block: Church Kroc Kids"). Paths below: impl repo = `Kroc-Center-Template` (cwd), design repo = `../KROC-draft`.

## 1. Research — where the block comes from

- **Ticket + catalog row:** `KROC-draft/informational-pages-block-tickets.md` (`### Block: <Name>`) and `informational-pages-blocks.md` (catalog table). Ticket IDs: `KROC-draft/superhuman/block-ticket-ids.csv`.
- **Design, both surfaces** — they are separate designs and both are followed:
  - desktop `KROC-draft/KROC prototype/pages-new.jsx` (+ `shared.jsx`, `blocks.jsx`, `kroc.css`)
  - mobile `KROC-draft/KROC prototype/mobile/m-pages-new.jsx` (+ `m-shared.jsx`, `kroc-mobile.css`)
  - grep a distinctive string from the ticket (a heading, a pill label) to find the section.
- **Provenance:** comments in the prototype cite Figma threads (`💬1871730857`); `KROC-draft/figma-comments-*/` holds the digests. A field exists only if the design, a comment, a ticket or a meeting note asks for it. **Check where a comment is pinned before trusting its label:** digests summarise, and they can misfile. T16's "icon centered above the title" was filed under "value cards", but its comment ID (`1871731526`, also the source ID in `KROC-draft/figma-comments-2026-09-03-ticket-ids.csv`) is Erin's B5 pin on Job Listings. `figma-comments-*/figma-sync.md` records pin offsets per section.
- **Generalisation check:** `node .claude/skills/zesty/scripts/zesty-model.mjs list` and `show <model>` on look-alikes; the catalog's "merge candidates" notes. If an existing model covers it, the block is a **variant** of that model (maybe plus a presence-driven optional field) — e.g. Rentals Intro → `intro_band`, Church Groups + Careers Values → `card_grid`. Verify a suggested merge target actually fits before taking it (`featured_cards` 7.20 was named in the catalog but is a reference-based class/event block).
- If scope is a real choice (own block vs general block, naming), ask the user with a recommendation. Otherwise proceed.

## 2. Spec

- Map every piece of design copy to a field. Sub-headings with content in them ("Troops · 4–5 PM") are fields.
- Names: snake_case, consistent with sibling blocks (`heading`, `body`, `cta_label`/`cta_link`, `<thing>_heading`). Labels are user-facing ("CTA Label").
- Types: Single Line `text`, Multi Line `textarea`, `wysiwyg_basic`, External URL `link`, `images` (Media), `dropdown` (options `{value: Label}`), `repeater` (`subFields`), `sort`, `yes_no`.
- No `sort_order` / Columns / Background / Width unless asked — column count follows item count; colour comes from the design.
- Repeater constraints (no relations, no nesting) → flatten.
- Icons are **Media** (`images`), like every icon field on the instance.

## 3. Model

```bash
node .claude/skills/zesty/scripts/zesty-model.mjs create spec.json --dry-run   # read the plan
node .claude/skills/zesty/scripts/zesty-model.mjs create spec.json             # creates model + og_image + fields, waits for the view, pulls it
```

See [../templates/model-spec.json](../templates/model-spec.json). For an existing model: `add-fields` / `update-field` (patch merges options and sub-fields; `sort` reorders).

## 4. Component + block view

Conventions: [../reference/component-conventions.md](../reference/component-conventions.md). Order matters:

1. Write `webengine/views/components/<name>.jsx` (header comment: block, variants, provenance, every deviation from the design and why).
2. `node .claude/skills/zesty/scripts/zesty-sync.mjs push webengine/views/components/<name>.jsx` — creates it on the instance.
3. Replace the generated placeholder in `webengine/views/-/block/<model>.html` (template: [../templates/block-view.html](../templates/block-view.html)). The hook pushes it.
4. Add `<script type="text/babel" data-presets="react" src="/components/<name>.jsx"></script>` to `webengine/views/loader` after its dependencies (shared helpers load early; church/card blocks sit after `churchministries.jsx`).
5. `npm run format` then `npm run build:css` (the hook pushes `styles.html`).

## 5. Test

```bash
node .claude/skills/zesty/scripts/ssr-check.cjs <Component> webengine/views/components/<name>.jsx cases.json
```

Cases: the design content, each optional part missing, blank rows, quotes + newlines in multi-line text, a schemeless link (`kroc.org/x` → `https://`), nothing filled (renders nothing). Read the summaries; use `--html` to inspect markup. The script preloads every component the loader lists before yours (same global scope as the browser), so add the loader entry before testing a component that depends on another block's helper. `classes: N/N compiled` must hold, and any "double open-brace" lines it lists must be intentional Parsley calls (missing → `npm run build:css`). Effects (media lookups) don't run here — stub `React.useState/useEffect` in a one-off harness if the post-fetch state needs checking.

## 6. Variant (content)

```bash
node .claude/skills/zesty/scripts/zesty-media.mjs upload icon.svg              # if the design needs images; note the 3-… ZUIDs
node .claude/skills/zesty/scripts/zesty-variant.mjs create variant.json --dry-run
node .claude/skills/zesty/scripts/zesty-variant.mjs create variant.json
```

Variant file: [../templates/variant.json](../templates/variant.json); use the design's copy, leave unknown links empty. The tool validates against the model, stamps og_image, keeps the item listed, pulls, and prints the preview URL + status.

## 7. Verify on the instance

- Preview `https://<hash>-dev.webengine.zesty.io/-/block/<model>.html?variant=<7-zuid>` → 200, and the rendered `data` carries the content (curl + grep the `const data` block).
- Catalog resolution: `/-/gql/<model>.json` items must each have `og_image` containing `variant=<zuid>` (what `blocks_catalog_page` reads; "N unresolved" means one doesn't).
- `node .claude/skills/zesty/scripts/zesty-sync.mjs status` → only `styles/tailwind.css` local-only.

## 8. Docs + tracker

[../reference/docs-and-tracker.md](../reference/docs-and-tracker.md). Leave ticket **status** to the user; write Notes + Solution.

## 9. Report

Lead with what shipped and the preview URL; list deviations from the ticket/design with reasons; say what's left for the user (status, Manager-only steps). No file-sync list is needed — the hook syncs.
