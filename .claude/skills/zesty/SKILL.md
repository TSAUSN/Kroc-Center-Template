---
name: zesty
description: Working on the KROC Zesty.io instance from this repo — syncing webengine/ files with the instance, creating or changing content models and fields, creating block variants (content items), uploading media, and building a new block end to end (research → model → component → variant → verify → docs). Use whenever a task touches the Zesty instance, a block, a model, a variant, or the KROC block tickets.
---

# Zesty workflow (KROC)

The skill's scripts live in [scripts/](scripts/) and always run **from the Kroc-Center-Template root** (they find it themselves, so the working directory only matters for relative file arguments):

```bash
Z=.claude/skills/zesty/scripts      # shorthand used below
node $Z/zesty-sync.mjs status
```

They share one setup (`scripts/zesty-api.mjs`): the instance ZUID from `zesty.config.json` and the VS Code extension's developer token in `.vscode/settings.json` (`zesty.editor.token`), or `$ZESTY_TOKEN`. Both files are gitignored — never print, log or commit the token. **First time on a machine (or the hook isn't firing): [reference/setup.md](reference/setup.md).**

## Scripts

| Script | Commands | What it's for |
|---|---|---|
| `zesty-sync.mjs` | `status` · `pull` · `push <file…>` · `scan` · `init` · `hook` | webengine/ ↔ instance. The PostToolUse hook runs `hook` after every Edit/Write/Bash and pushes changed files. |
| `zesty-model.mjs` | `list` · `show <model>` · `create <spec.json>` · `add-fields <model> <spec.json>` · `update-field <model> <field> <patch.json>` · `delete <model> --confirm=<name>` · `delete-field <model> <field> --confirm=<name> [--hard]` | Models + fields from a JSON spec; guarded deletes. |
| `zesty-variant.mjs` | `list <model>` · `show <model> <variant>` · `create <variant.json>` · `update <model> <variant> <patch.json>` | Block variants (content items). |
| `zesty-media.mjs` | `list` · `upload <file…>` · `title <3-zuid> "<title>"` | Media library; prints the `3-…` ZUIDs variants take. |
| `zesty-page.mjs` | `build <page.json>` · `show <path \| 7-item-zuid>` | Freestyle pages: creates the page item (once, found again by path), writes + pushes its `z/pvl` layout from an ordered block-variant list, verifies the render. |
| `ssr-check.cjs` | `<Component> <file.jsx> <cases.json> [--html]` | Server-render a component per case + check its classes are compiled. |
| `zesty-api.mjs` | — | Shared setup imported by model/variant/media. |

Every write command takes `--dry-run`. **Always dry-run first**, read the output, then run for real.

## Rules that are not optional

1. **Every API write is followed by `node $Z/zesty-sync.mjs pull`** so files the change generated land locally. The model/variant tools do it themselves; anything else (curl, one-off scripts) must run it by hand.
2. **Scans never create files.** A new component needs an explicit `node $Z/zesty-sync.mjs push webengine/views/components/<name>.jsx`. Push it **before** adding it to `loader` — the hook pushes the loader immediately, and a loader pointing at a missing script breaks the dev site.
3. **Block views (`views/-/block/<name>.html`) only come from creating the model.** Never create one locally.
4. **Delete only what the user named, and never rename.** Model and field deletes go through `zesty-model.mjs delete` / `delete-field`. Dry-run first and show the user the item count. The tool needs `--confirm=<exact name>` and refuses while another model still relates to the target, so delete the referencing model first. A model delete removes its items, fields and views permanently; a field delete only deactivates the field unless `--hard`. Options, sub-fields, views and media are still Manager actions. Endpoints are in [reference/api-facts.md](reference/api-facts.md).
5. **Spec only fields someone asked for** — trace each to the design, a Figma comment, a ticket or a meeting note, not to a standard that merely lists it.
6. **Prefer generalising**: before a new model, check whether an existing one (or a variant of it) covers the design. A variant is a content item sharing the model's schema; design differences should be driven by which fields are filled (presence-driven), not by new models or style switches.
7. **Repeaters can't hold relations (One-to-One/Many, Internal Link) or another repeater.** Flatten (e.g. Multi Line Text, one item per line).
8. The auto-mode classifier blocks editing `.claude/settings*.json` and some destructive API calls — don't work around it; tell the user what to do (the hook setup in [reference/setup.md](reference/setup.md) is a paste for the user, not an edit for Claude).

## Workflows

- **Build a new block** (the usual task — "proceed to Block: X"): follow [workflows/new-block.md](workflows/new-block.md).
- **Add or change fields on an existing block**: `show` → write the spec/patch → `--dry-run` → run → update the component + block view → re-run the variant check. Field order: `update-field … {"sort": N}`.
- **Content only**: `zesty-variant.mjs create|update`, images first via `zesty-media.mjs upload`.
- **After any manual change in the Manager or a teammate's push**: `zesty-sync.mjs pull`, then `status`.

## Reference (read when needed)

- [reference/setup.md](reference/setup.md) — one-time setup: instance config + token, gitignore entries, **the auto-sync hook**, test modules, and how to check it all works.
- [reference/api-facts.md](reference/api-facts.md) — Zesty API behaviour learned the hard way: payload shapes, stored value formats, the unlisting trap, og_image/screenshots, media upload, preview URLs.
- [reference/freestyle-pages.md](reference/freestyle-pages.md) — building a Freestyle page through the API: the `z/pvl/<item>.json` + `.zhtml` layout files, `autolayout(auto)`, the recipe (first used for Rentals).
- [reference/component-conventions.md](reference/component-conventions.md) — how KROC block views + components are written (Parsley-in-JSX, repeaters, media, contrast, desktop vs mobile).
- [reference/docs-and-tracker.md](reference/docs-and-tracker.md) — which docs and tracker fields to update when a block ships.
- [templates/](templates/) — model spec, variant file, block view.

## Keeping this skill current

This skill is the workflow's memory. When a run teaches something new — an API quirk, a convention the user corrects, a step that was missing — **update the relevant file here in the same session**, and keep `AGENTS.md` (repo-wide facts) consistent with it. Keep SKILL.md short; put detail in `reference/` or `workflows/`. Script changes go in `scripts/` — keep each script's usage comment and the table above in step.
