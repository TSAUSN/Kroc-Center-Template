# AGENTS.md — KROC Zesty WebEngine

Working notes for anyone (human or agent) editing this repo. The `webengine/`
folder is a two-way sync with Zesty instance `8-80c0bba6b8-lhkcc7`; the approved
design lives in the **KROC prototype** folder (`../KROC draft/KROC prototype/`,
see its `index.html` + `shared.jsx`/`blocks.jsx` + `kroc.css`), and the content
architecture is `architecture-proposal-v3.md` in that folder's `uploads/`.
Styling/token docs live in [README.md](README.md) — this file covers the app
architecture, Parsley data patterns, and per-file notes.

---

## 1. Architecture — React app shell on WebEngine

The site renders client-side with React, mirroring the prototype's structure.
WebEngine/Parsley supplies server-rendered data and the page body; React owns
the DOM.

**The loader** (`webengine/views/loader`, a snippet injected into `<body>` —
the instance `<head>` is not editable) is the analog of the prototype's
`index.html`:

1. `{{ include /components/styles.html }}` — compiled Tailwind, inlined
   (Zesty's `/site.css` pipeline mangles Tailwind v4 output; see README)
2. `{{ include /components/icons.html }}` — SVG sprite (`#i-*` symbols,
   currentColor, sized via `h-*/w-*`)
3. `<template id="kroc-current-view">{{ current_view }}</template>` — the
   server-rendered page body, inert until adopted
4. `<div id="root">`
5. React 18 UMD + ReactDOM + Babel standalone (CDN, production builds)
6. `<script type="text/babel" src="/components/*.jsx">` — components, in
   dependency order (**shared.jsx must load first**; top-level declarations
   are shared across Babel scripts)
7. An inline Babel script defining `CurrentView` + `App` + `createRoot`

**App tree:** `<App/>` = wrapper div → (`<SiteAlert/>` parked, page-mounted
for now) → `<SiteHeader/>` → `<CurrentView/>` → `<SiteFooter/>`.

**CurrentView (the bridge):** on mount it adopts the `<template>`'s DOM nodes
into `<main>`, then re-creates every script tag found in the page body so
block code executes (adopted/inert scripts never run). Scripts typed
`text/babel` are compiled at that moment with
`Babel.transform(code, { presets: ["react"] })` — Babel's page-load scan is
long over — which is what lets block views mount React inline. Script tags
typed `application/json` are skipped (inert data). Each revival is wrapped in
try/catch so one broken block can't kill the rest.

**Components** are `.jsx` files under `webengine/views/components/`, served as
Zesty custom file views at `/components/*.jsx`. They are **views**, so Parsley
processes them — see the hard rules. Loaded via `<script src>` (not Parsley
includes) so browsers cache them across page views.

**Trade-off accepted:** everything paints after Babel compiles (client-side
rendering, blocks last). When performance matters, the upgrade path is a
`build:js` step (like `build:css`) precompiling `components/*.jsx` to plain
`.js`, and block views calling plain-JS mount helpers — removes Babel
standalone entirely without changing the authoring model.

---

## 2. Hard rules

- **Never write a double-open-curly sequence** in any Parsley-processed file
  (all views, including `.jsx` and `.json` custom files) outside intentional
  Parsley calls — Parsley parses `{{` everywhere, *including comments*. In
  JSX this means: no `style={{...}}` (build the object in a variable first),
  no inline double-brace expressions; conditional classes go through the
  `cx()` helper as plain strings (which also keeps Tailwind's scanner
  working). Spaces *inside* braces (`{{ this.qa }}`) are fine; split braces
  (`{ {`) are not.
- **JS formatters split `{{` into `{ {`** (and raw Parsley outside strings is
  invalid JS, so Prettier can't even parse these files). `.vscode/settings.json`
  disables format-on-save for `javascriptreact` — don't remove that. Format
  with **`npm run format`** instead (`format:check` for CI-style dry run):
  `tools/format-views.mjs` masks every `{{...}}` call, runs ESLint's `curly`
  fix (expands one-liner ifs/loops to braced blocks) + Prettier
  (printWidth 100, `trailingComma: "none"` — a trailing comma next to
  `_arraycomma` would emit `,,`), then restores the Parsley verbatim. It
  covers `components/*.jsx` plus the `text/babel` script bodies in `loader`,
  `homepage`, and `views/-/block/*.html`, and refuses to write a file if the
  Parsley calls don't round-trip byte-identical. Run it before syncing.
- **`views/-/block/` is WebEngine-managed.** Never create or delete files
  there; only edit the scaffolds Zesty generates. Deleting a synced file
  locally doesn't remove it from the instance — remote copies resurrect on
  sync; delete instance-side via the Manager Code App.
- **Run `npm run build:css` whenever markup classes change**, and sync the
  regenerated `components/styles.html` along with the code change. Tailwind
  purges: a class not present in a scanned file has no CSS. (Scan globs:
  `webengine/views/**/*` and `webengine/scripts` — see `src/tailwind.css`.)
- All Babel script tags carry `type="text/babel" data-presets="react"`.
- IDE errors on Parsley lines in `.jsx`/`.json` files are pre-render noise
  (the TS/JSON linters can't know Parsley) — ignore them; verify with the
  `{{`-grep instead: the only `{{` in a file should be intentional calls.

---

## 3. Parsley data access (verified on this instance)

The official docs are unreliable here — these patterns are stage-tested.

**Bang operator** `{{!this.field}}` — suppresses per-call errors (documented
in "Common Parsley Errors"). Stage/preview prints Parsley errors into the
output; inside a JS string that breaks the whole script. Rule: **bang every
field call that lands in a JS/JSON payload**, then handle empties in JS
(`.trim() || fallback`). Leave structural calls (`toJson()`,
`current_view`) un-banged so real breakage stays visible.

**Globals (single-item model)** — direct calls work:
`"{{!globals.site_name}}".trim()`, media via `{{globals.logo.getImage()}}`.
Always `.trim()` (content has stray whitespace).

**Dataset (multi-item model)** — direct `model.field` renders EMPTY. Loop:

```
[
  {{each model as x}}
  {{x.toJson()}}
  {{x._arraycomma}}
  {{end-each}}
]
```

`toJson()` = JSON-escaped item (safe for WYSIWYG quotes/newlines; includes
`zuid` + meta). `_arraycomma` = comma between items, none after the last.

**Repeater field** (rows stored as JSON on the item) — embed RAW; the
documented `api.json.get({field})` loop does NOT work on this instance:
`[].concat({{this.rows}})` in JS, or wrap as `[{{this.rows}}]` + `.flat()`
so an empty field still parses. In a JSON endpoint use the field directly as
a value.

**Media**: single media fields resolve via `.getImage(w,h,fit|crop)` /
`.getMediaURL()` / `.getImageTitle()`. **Media sub-fields inside repeaters
store bare ZUIDs that cannot be resolved** — use a Media field with
*multiple images enabled* instead, then:

```
{{each media.{this.images} as img}}
{ src: "{{img.image.getImage(1600)}}", alt: "{{img.image.getImageTitle()}}" },
{{end-each}}
null
```

(trailing `null` + `.filter(Boolean)` absorbs the loop's trailing comma).

**One-to-many (relational)** — stores a CSV of zuids. Resolve with:

```
{{each stories as s where FIND_IN_SET(s.zuid, '{this.featured_stories}')}}
{ item: {{s.toJson()}}, thumb: "{{!s.story_image_thumbnail.getImage(800)}}", url: "{{s.getUrl()}}" },
{{end-each}}
```

The loop returns **dataset order** — restore curation order client-side by
sorting against the raw CSV (`zuids` passed alongside). Mix per-field calls
(`getImage`, `getUrl`) with `toJson()` in the same loop body.

**Block views** — the block item is `this` (`this.block_name`, `this.zuid`,
`this.toJson()`); dataset-style `blockmodel.field` calls render empty there.

**Whole-item transport** — when a block has WYSIWYG/multiline fields, ship
the item as `const data = {{this.toJson()}};` (JSON-escaped end to end) and
overlay resolved media on top (`data.image = "{{!this.image.getImage(1200)}}"`),
since `toJson()` leaves media as ZUIDs.

**Escaping caveat** — any field value placed inside a hand-built `"..."` JS
string breaks on a double quote. `toJson()` is the safe transport; hand-built
strings are acceptable for short plain-text fields only.

---

## 4. Mount patterns

**Block mount** (canonical — every implemented block view looks like this):

```html
<section class="mx-4 mt-9" id="kroc-<block>-{{this.zuid}}"></section>

<script type="text/babel" data-presets="react">
(() => {
  const data = { ... Parsley fills ... };
  ReactDOM.createRoot(document.getElementById("kroc-<block>-{{this.zuid}}")).render(
    <BlockComponent data={data} />
  );
})();
</script>
```

The zuid-suffixed id keeps multiple instances of a block independent; the
IIFE prevents duplicate top-level `const` collisions (Babel scripts share one
global scope).

**Page mount** (for components without a block, e.g. the site alert on the
homepage): a container element + the same inline Babel mount in the page
view, alongside `{{ this.autolayout(auto) }}`. Components own their data
(their Parsley lives in their own `.jsx`), so pages stay thin.

---

## 5. Current structure

```
src/tailwind.css          Tailwind v4 token source (see README for the 3-tier system)
tools/inline-css.mjs      inlines compiled CSS into components/styles.html
tools/format-views.mjs    Parsley-safe formatter (npm run format — see §2)
webengine/
  views/
    loader                app shell (see §1)
    homepage              autolayout + page-mounted <SiteAlert/>
    components/
      styles.html         AUTO-GENERATED by build:css — never hand-edit
      icons.html          SVG sprite: pin chev search menu close arrowur home grid
                          book cal mail phone warn info emerg fb x li ig yt +
                          mega icons (water dumbbell users palette music ball
                          heart sun gift ticket trophy star)
      shared.jsx          loads FIRST: SITE_NAME, PAGE_ZUID, SOCIAL_LINKS (globals
                          social_handles repeater + icon map), CURRENT_PATH, cx(),
                          isActive(), Icon, SocialLinks
      alert.jsx           SiteAlert/AlertBar — [global_site_alert_banner] dataset;
                          variants warning|info|danger|navy|dark; start/end window;
                          per-session dismiss (sessionStorage by zuid)
      header.jsx          SiteHeader — nav + mega menus (Classes/Events, static
                          sets for now), drawer w/ accordions, logo/facility from
                          globals; CTAs + utility bar hardcoded pending
                          header_cta_1/2 + [custom_navigation]
      footer.jsx          SiteFooter — Connect band (globals hero/logo), newsletter
                          vendor-form callout (newsletter_signup_url), SA mission
                          (fallback text; schema field pending), quick pills ←
                          footer_links, affiliates ← territory_links, meta line
      faqs.jsx            FaqList accordion (block: faqs)
      people.jsx          PeopleBlock — layouts cards | featured (block: people)
      donation.jsx        DonationBlock — variants red|navy(|dark dormant)
      gallery.jsx         ImageGallery — mosaic (7-tile cap) | grid | carousel +
                          GalleryLightbox (click-to-zoom, keyboard nav)
      facility.jsx        FacilitySection — photo carousel side + content; status
                          open|closed_seasonal|closed_maintenance; hours table or
                          closure notice
      introband.jsx       IntroBand — photo-right (white split card) | no-photo
                          (red/navy band)
      cards.jsx           shared cards: StoryCard (+ krocFormatDate); ClassCard/
                          EventCard/OppCard/CategoryCard land here later
      featuredstories.jsx FeaturedStories — grid 3-up | carousel, curation order
                          restored from one-to-many CSV
    custom-endpoints/     scratch JSON endpoints for testing Parsley patterns
    -/block/              WebEngine-managed scaffolds (see §2)
```

**Block views implemented:** `faqs`, `people`, `donation_block`,
`image_gallery`, `facility_section`, `intro_band`, `featured_stories`.
**Still placeholder:** `external_embed`, `featured_classes`,
`featured_pages`, `featured_volunteer_opportunities`, `custom_forms`,
`custom_navigation`. **Models not yet created** (v3): `featured_events`,
`featured_programs`, `map_block`, `rate_cards`, `job_postings`,
`[event_categories]` taxonomy.

**Featured-block build order** (dependency analysis vs v3): Stories ✅ →
Volunteer Opps (needs excerpt field) → Programs (needs block model) →
Classes (needs PricePoints X3 + session dates + marketing_description on
[classes]) → Events (needs model + [events] fields + event_categories) →
Pages (independent; big own schema per SCHEMA-9).

---

## 6. Known gaps / pending

- Header CTAs + utility bar + nav hardcoded — awaiting `header_cta_1/2`
  globals (SCHEMA-3) and the `[custom_navigation]` model (SCHEMA-1/2);
  mega-menu content static until `[program_categories]` loop is re-verified
  and `[event_categories]` exists.
- Footer mission text uses a hardcoded fallback — v3 puts the field on
  `[connect_block]`.
- `globals.donation_link` referenced by the donation block but not yet in
  the schema (bang-guarded).
- People block headshots: repeater media sub-field = bare ZUIDs (unresolvable)
  — same problem the gallery hit; needs a schema rethink when it matters.
- Long-text fields in hand-built JS strings need a Parsley escape modifier
  eventually (or migrate those payloads to toJson transport).
- Content URLs entered without protocol (`facebook.com`) resolve relative to
  the site — fix content or normalize in JS.
- CSS served stale = broken layout: if new elements render unstyled, the
  instance's `styles.html` wasn't re-synced after a build.
