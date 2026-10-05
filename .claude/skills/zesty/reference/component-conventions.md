# Block view + component conventions

`AGENTS.md` (repo root) is the full rulebook — §2 hard rules, §3 Parsley data access, the component map and each block's field contract. This is the checklist distilled from building the blocks so far; read the closest sibling component (`churchkids.jsx`, `cardgrid.jsx`, `churchministries.jsx`) before writing a new one.

## Parsley

- Parsley parses `{{` **everywhere**, comments included. Never write a double open-brace except as an intentional call.
- Block view data: `const item = {{this.toJson()}};` then `item.<field>` — safe for quotes and newlines. Hand-built `"{{!this.x}}"` strings break on a `"` or newline; don't use them for anything an editor types.
- Repeaters: `[{{ this.<repeater> }}]` (raw rows), then `[].concat(v || []).flat().filter(Boolean)` in the component — the wrapper keeps an empty field parseable.
- Section element: `<section class="mx-4 mt-7 lg:mt-12" id="kroc-<slug>-{{this.zuid}}"></section>`, mounted with `ReactDOM.createRoot(...).render(<Component data={data} />)`.
- IDE errors on Parsley lines are noise.

## Component

- One global function per file, `function BlockName(props)`, reading `props.data`. Helpers from earlier loader scripts: `cx` (classnames), `Icon` (`<Icon id="#i-name" />` sprite in `components/icons.html`), `krocExternalUrl` (adds a missing `https://`, in `catalog.jsx`), `krocSortRows` (sorts only when every row has `sort_order`, in `featuredpages.jsx`), `useKrocMediaUrls` (in `cardgrid.jsx`).
- Header comment: block + variants, where it appears, provenance of non-obvious fields, every deviation from the design and the reason. Match the density of sibling files.
- **Presence-driven:** every optional part renders only when filled, wrappers included (no empty flex rows, no margins left behind); a two-column layout collapses to full width when one side is empty; render nothing when nothing is filled. `trim()` every text value.
- Desktop and mobile are separate designs: mobile is the base, `lg:` the desktop. When an element moves between surfaces (CTA top-right vs bottom), render it twice with `hidden lg:inline-flex` / `lg:hidden` so only one reaches the accessibility tree.
- Use exact pixel values from the designs (`text-[13px]`, `px-[22px]`); tokens where they exist (`text-content`, `text-content-muted` = #575757, `bg-surface`, `bg-surface-muted` = area #EFEFEF, `rounded-card` 20px, `text-heading-md` 34px, `text-heading-sm` 28px, `btn btn-secondary btn-sm`). Ignore the linter's "canonical class" suggestions.
- **Contrast:** brand red #EF3E42 fails AA for small text on white (3.86:1) → use `text-brand-red-300` #C5000E (6.21:1) and say so in the header and report. navy-150 #61769C passes on pure white only.
- Tailwind v4: utilities beat `@layer components` (`btn-block lg:w-auto` works). Arbitrary values fine (`bg-[linear-gradient(...)]`).
- Media sub-fields: resolve with `useKrocMediaUrls`; an unresolved image leaves its slot empty, never a broken `<img>`.
- Links: `href={url || undefined}` so an empty link renders without `href`.

## After writing

`npm run format` (Parsley-safe), `npm run build:css` whenever classes change, then `ssr-check.cjs`.
