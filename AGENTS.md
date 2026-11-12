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
- **Syncing with the instance** (`.claude/skills/zesty/scripts/zesty-*.mjs`, 2026-10-05; setup in that skill). The VS Code
  extension uploads only on an editor save, so files written by scripts, git
  or an agent never reached the instance. `zesty-sync.mjs` closes that: a
  Claude Code PostToolUse hook runs it after every edit and command, pushing
  each changed `webengine/` file after a three-way check against the last
  agreed content (`.zesty-sync.json`). A file changed on both sides is a
  conflict and isn't pushed; >15 files at once (a branch switch) pushes
  nothing; gitignored paths are skipped. **A scan never creates a file** —
  a new component needs `node .claude/skills/zesty/scripts/zesty-sync.mjs push <file>`, and block
  views only come from creating the model. `pull` brings instance changes
  down without overwriting an unpushed edit. **Every API write must be
  followed by a pull**; the model and variant tools do it themselves.
- **Models and variants via the API.** `zesty-model.mjs` validates a whole
  spec before the first request (no relations or nesting inside a repeater,
  dropdowns need options), takes `--dry-run`, and never deletes or renames.
  Its settings round-trip all 45 live models identically, and it adds the
  Manager's `og_image` field to blocks, which the API alone doesn't.
  `zesty-variant.mjs` writes a variant's data in the shape the Manager
  stores (yes_no 0/1, currency string, images/relations comma-joined ZUIDs,
  repeaters as row arrays), names it via `web.metaTitle`, and doesn't
  publish: dev renders the latest saved version. **An API-made variant gets
  no screenshot** (the Manager requests it on save), and `og_image` is the
  only place `blocks_catalog_page` reads a variant ZUID from — so the tool
  stamps `og_image` with the Manager's URL shape (`…!variant=<zuid>&version=…`);
  the Manager overwrites it with a real screenshot on the first save there.
  ⚠ **An item PUT that omits `meta.listed` UNLISTS the item**, and an unlisted
  variant vanishes from `/-/gql/` and fails to render (`{{!this.zuid}}` →
  "field does not exist"). The tool sends `listed: true` +
  `sitemapPriority: -1` (what all 31 Manager-made variants carry) on every
  write. The catalog labels a variant by `block_name`, else `meta_title`.
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

**Parsley parses comments.** A `{{...}}` sequence inside a `//` or `<!-- -->`
comment in any view is evaluated like real markup. Writing the literal text
`{{if}}` in a JS comment in `loader` errored **every page on the instance**
("WebEngine Error: Parsley {{if}}", 2026-09-18) — the loader is a site-wide
snippet, so one bad comment takes the whole site down. Stage/preview shows the
error page; production suppresses it, which makes this worse, not better.
`?_bypassError=true` renders past it and is how the source was found. Never
spell a Parsley tag inside a comment — describe it in prose.

**Repeater field** (rows stored as JSON on the item) — embed RAW; the
documented `api.json.get({field})` loop does NOT work on this instance:
`[].concat({{this.rows}})` in JS, or wrap as `[{{this.rows}}]` + `.flat()`
so an empty field still parses. In a JSON endpoint use the field directly as
a value.

**Repeater sub-field types** (Zesty docs, "How to Create a Repeater Content
Field", checked 2026-09-08): Single Line Text, Multi Line Text, WYSIWYG,
Markdown, Media, External URL, Number, Currency, Date, Date & Time, Boolean,
Dropdown, Color, Sort order, UUID. **Relational types are not allowed inside a
repeater** — no One-to-One, One-to-Many or Internal Link — and a repeater
cannot nest another repeater. So a repeater row can only link out via an
absolute External URL, and anything "per row, many" (shifts, prices, roles)
has to flatten to text or move to the model the row describes. The manager
shows sub-field API IDs namespaced (`shifts.label`, `featured_pages.page_title`)
but the **JSON keys are the bare suffix** (`label`, `page_title`) — verified
on `featured_pages`. Date / Date & Time values arrive as `"YYYY-MM-DD"` /
`"YYYY-MM-DD HH:MM:SS"` strings — parse them by hand
(`featuredvolunteers.jsx`): `new Date("2026-06-01")` is UTC midnight and
prints as the previous day in US timezones.

**Media**: single media fields resolve via `.getImage(w,h,fit|crop)` /
`.getMediaURL()` / `.getImageTitle()`. **Media sub-fields inside repeaters
store bare ZUIDs** — and since Parsley cannot loop a repeater, they cannot be
resolved *in place*. They CAN be resolved in a second pass: `media.{csv}`
takes a plain CSV of media ZUIDs, so read the ZUIDs out of the repeater JSON
client-side and hand them to an endpoint (`custom-endpoints/media.json`, used
by `featuredpages.jsx`). Verified on the dev instance 2026-09-03:

- `{{each media.{get_var.zuids} as m}}` + **`m.image.getImage(400)`** resolves.
  The `.image` sub-accessor is required — plain `m.getImage()` returns `""`.
- `m.image.getZUID()`, `m.image.zuid` and bare `m.image` all return the ZUID,
  so a result can be mapped back to the row it came from. Do map it: response
  order is not guaranteed and unset sub-fields come back `null`, so positional
  matching pairs the wrong image with the wrong row.
- `media.{this.<repeater>}` does **not** work — raw repeater JSON is not a CSV.

For a plain list of images with no per-row pairing, a Media field with
*multiple images enabled* is still simpler:

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

**Fetched JSON — `api.json.get`** (verified 2026-09-30 → 10-02 on
`/test-page/`, which runs each case live). Parsley **does** make outbound HTTP
calls: `{{each api.json.get(https://kroc.zesty.dev/tractionrec/courses.json) as c}}`
fetches any URL, external domains included. This is how pages read the
Traction Rec files under `views/tractionrec/` (paths and shapes:
`../kroc-tractionrec-sync/AGENTS.md`).

- It needs a **full URL** (a relative one gives `error:call:1`) and must sit
  inside an `each`. A missing URL gives one empty pass, with no error.
- **It reads one level deep only.** `{{c.Name}}` works. A dotted read
  (`{{c.TREX1__Course_Option__r.Name}}`) or printing an object **crashes the
  whole page**, an array prints as `Array`, and `{{each c.obj}}` loops zero
  times. Nested Traction Rec fields are read in JavaScript instead.
- `where` and `limit` are **silently ignored** on a fetched loop; filter with
  an inner `{{if {c.TREX1__Program__c} == (a31a…)}}`. `FIND_IN_SET` there is
  always true.
- ⚠ **Hyphen trap:** in an `{{if}}`, a value in parentheses that contains a
  hyphen is not compared: `== (cat-sports)` matched *every* row and
  `== (7-feeac0fae9-28d0cs)` matched none. Salesforce ids (no hyphen) are safe
  in parentheses; **quote Zesty ZUIDs**: `== '7-…'`.
- Inside a fetched loop, an outer loop's alias is gone, and `c.getUrl()` there
  silently returns the *current* page's URL; read what you need first.
  `this.*` survives. A loop alias *does* interpolate into the URL
  (`…/courses/{c.tractionrec_id}.json`), but that's one fetch per row: 71 s
  for 119 courses. Read a parent's children file
  (`…/programs/{this.tractionrec_id}/courses.json`) instead.
- `{{ include /path.json }}` inlines a file as **raw text** (a payload for
  JS), not markup. Path interpolation works for `{this.*}` / `{get_var.*}`,
  not loop aliases.
- Debugging: the stage domain `https://6wz46m14-dev.webengine.zesty.io`
  renders **unpublished drafts**; a Parsley crash there is an HTTP 500 with no
  message. `/test-page/`'s code blocks are editable and run through
  `npm run runner` in the sync repo.

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
.claude/skills/zesty/     the Zesty workflow as a Claude Code skill — rules, setup (hook),
                          new-block procedure, API facts, conventions — and its scripts;
                          keep it current. Run scripts from the repo root:
  scripts/zesty-sync.mjs    webengine/ ↔ instance: status | pull | push | scan | hook
  scripts/zesty-model.mjs   models + fields from a JSON spec: list | show | create | add-fields | update-field
  scripts/zesty-variant.mjs block variants (content items): list | show | create | update
  scripts/zesty-media.mjs   media library: list | upload (prints the 3-… ZUIDs variants take)
  scripts/zesty-api.mjs     shared setup for model/variant/media (token, model lookups, pull)
  scripts/ssr-check.cjs     server-render a component per case + check its classes compiled
webengine/
  views/
    loader                app shell (see §1)
    homepage              autolayout + page-mounted <SiteAlert/>
    components/
      styles.html         AUTO-GENERATED by build:css — never hand-edit
      icons.html          SVG sprite: pin chev search menu close arrowur home grid
                          book cal mail phone warn info emerg fb x li ig yt +
                          mega icons (water dumbbell users palette music ball
                          heart sun gift ticket trophy star) + check + play.
                          i-li / i-yt punch their counters as evenodd HOLES,
                          not hardcoded white fills — a white fill is invisible
                          when the glyph itself is white (hero social row)
      shared.jsx          loads FIRST: SITE_NAME, PAGE_ZUID, SOCIAL_LINKS (globals
                          social_handles repeater + icon map), CURRENT_PATH, cx(),
                          isActive(), Icon, SocialLinks, CheckList (shared
                          check list — tone ondark|red|default-green, 1|2
                          columns; colour is a prop, never a content field: it
                          varies between blocks, never within one; 7
                          instances across 4 pages per blocks-doc F5). Uses
                          multi-column flow, NOT grid-cols-2: a grid shares row
                          heights across columns, so one wrapped item punches a
                          hole beside it and the checks lose their rhythm.
                          Items therefore read DOWN col 1 then col 2
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
                          (red/navy band, `alignment` left|center) | white
                          card. Variants include "Careers Open Positions"
      cards.jsx           shared cards: StoryCard (+ krocFormatDate), OppCard,
                          TierCard (membership/rate row — name + note left,
                          price + period right; items-center per quick-win A1),
                          PassCard (centred Day Pass card — bold audience +
                          label, 64px price, ages, own CTA);
                          ClassCard/EventCard/CategoryCard land here later
      featuredstories.jsx FeaturedStories — grid 3-up | carousel, curation order
                          restored from one-to-many CSV
      featuredpages.jsx   FeaturedPages — compact chips | grid cards from the
                          `featured_pages` repeater; owns krocSortRows.
                          Repeater media still falls back to placeholders —
                          the two-pass resolver lives in cardgrid.jsx
                          (useKrocMediaUrls); krocExternalUrl is in catalog.jsx
      membershipbenefits.jsx MembershipBenefitsBand — navy band + 2 CTAs +
                          CheckList column (block: membership_benefits_band).
                          Background is NOT a field — see the header comment
      membershipdata.jsx  Traction Rec memberships for the two blocks below:
                          krocTrMembershipIndex (the inlined
                          membership_types.json by Id), krocTrMembershipPrice
                          (which hop holds the price), krocTrMembershipAges
                          (incl. family household rules), krocTrMembershipName
      membershiptiers.jsx MembershipTiers — 3-up TierCard grid + section head +
                          fine print (block: membership_tiers). Rows with a
                          tractionrec_id read Traction Rec; prices via krocMoney
      daypassintro.jsx    DayPassIntroBand — green band + WYSIWYG body via
                          .kroc-prose repainted on-dark (block:
                          day_pass_intro_band)
      daypasspasses.jsx   DayPassPasses — 2-up PassCard grid, max 960 (block:
                          day_pass_passes). Rows with a tractionrec_id read
                          Traction Rec
      aboutvision.jsx     AboutVision — 5fr/7fr photo-LEFT card + red CheckList
                          (block: about_vision)
      aboutjoankrocstory.jsx AboutJoanKrocStory — photo band under a fixed
                          navy->ink scrim: 2-line heading, WYSIWYG body flowed
                          through CSS multi-column, YouTube embed (block:
                          about_joan_kroc_story). Owns krocYouTubeId
      aboutimpact.jsx     AboutImpact — 5fr/7fr stat card (photo + bottom-
                          weighted scrim + big number) beside a white narrative
                          card with Donate CTA + SocialLinks row (block:
                          about_impact)
      hero.jsx            HeroBlock — the ONE reusable hero (block: hero).
                          media image|video|color; presence-driven badge chip,
                          social row and CTA row; <picture> swaps the mobile
                          asset when artwork_mode=pre-designed; click-to-play
                          YouTube. Owns krocHeroToken (dropdown normaliser)
      churchconnect.jsx   ChurchConnectLinks — coloured link bars, label left +
                          arrow-up-right right (block: church_connect_links).
                          ONE `style` field (primary|secondary|tertiary) drives
                          colour, size AND column count; not featured_pages
                          compact, which is a centred icon chip
      churchministries.jsx ChurchMinistries — Weekly Ministries list (7fr) +
                          navy Prayer Request card (5fr) in ONE grid (block:
                          church_ministries; absorbed church_prayer_card).
                          Prayer half presence-driven. Two layouts sharing
                          markup: When inline-right vs own line; Prayer head
                          above the card vs inside it
      churchkids.jsx      ChurchKids — K.R.O.C. Kids card: eyebrow, heading,
                          CTA, body, troop pills (7fr) beside tinted award
                          boxes (5fr) (block: church_kids). Either half
                          presence-driven; CTA top-right on desktop, bottom
                          on mobile (rendered twice, display:none-toggled)
      cardgrid.jsx        CardGrid — white cards under an optional heading
                          (block: card_grid; variants "Church Groups",
                          "Careers Values"). Icon/Photo → media face (band
                          over a 19px title), else plain face (28px title +
                          pills). Columns follow the card count. Owns
                          useKrocMediaUrls, the two-pass repeater media
                          resolver (custom-endpoints/media.json)
      careersbenefits.jsx CareersBenefits — "Our Benefits" white card: heading +
                          green 2-column CheckList + optional YouTube
                          testimonial framed like about_joan_kroc_story's
                          (block: careers_benefits; reuses krocYouTubeId)
      careersjobs.jsx     CareersJobs — one white card per department: optional
                          Media icon centred above the name, location, role
                          links parsed from "Title | link" lines (block:
                          careers_jobs; krocParseRoles; reuses useKrocMediaUrls)
      careersapply.jsx    CareersApply — How to Apply card (heading + WYSIWYG)
                          (7fr) + red Text to Apply card (5fr) in ONE grid
                          (block: careers_apply; absorbed careers_text_apply).
                          Owns KrocSmsCard, which [hours_alerts] can reuse
      catalog.jsx         Catalog CORE, loaded first of the catalog files: shared
                          formatting (dates, money, days, times, krocExternalUrl,
                          krocMoney, krocPick, krocZuid, krocIconFor — other
                          blocks call these by name, so they stay here),
                          CatalogIcon, CatalogHero, Breadcrumbs. Split 2026-10-05
      catalogdata.jsx     Traction Rec data layer for the catalog pages: reads
                          /tractionrec/ files (krocTrGet, cached per path), the
                          inline rows a page view includes (krocTrInline),
                          row -> card adapters (krocTr*ToCard), availability
                          rules, CatalogCrumbs (parents from TR ids),
                          KROC_HIDDEN_CLASS_PAGES + krocTrClassGate (below)
      catalogcards.jsx    ProgramCard, ClassCard, ClassList (one band per day
                          combination, e.g. "Monday & Wednesday"), CourseRow
      catalogsections.jsx Category / Program / Course listings — complete row
                          set inlined by the page, client-side search + paging
      catalogdetail.jsx   CourseDetail, ClassDetail, ClassGate
      classfinder.jsx     the /categories-page/ finder: joins the four tier files
      membershipfamilyplay.jsx MembershipFamilyPlay + ComparisonTable — white
                          card: checklist + 3-col Standard-vs-Family-Play table
                          + serif accent line + centred CTA (block:
                          membership_family_play_comparison)
      featuredvolunteers.jsx FeaturedVolunteerOpps — 3-up | 4-up OppCard grid;
                          one-to-many → [volunteer_opportunities] resolved with
                          FIND_IN_SET in the block view (item toJson + hero
                          getImage + getUrl), curation order restored from the
                          CSV; date-only dateline (krocOppDateline). Loads after
                          featuredpages.jsx (krocExternalUrl)
    blocks_catalog_page   internal block preview, no reload and nothing
                          hardcoded. Block list = /-/gql/ minus /-/instant/;
                          variants = /-/gql/<block>.json (ZUID scraped from
                          og_image, deduped). Changing a dropdown pushes
                          history and AJAX-fetches custom-endpoints/blocks.json,
                          then revives the returned <script type="text/babel">
                          tags the way the loader's CurrentView does — verified
                          end-to-end in a browser 2026-09-18
    custom-endpoints/     scratch JSON endpoints for testing Parsley patterns
      blocks.json         despite the name, emits a block's RAW HTML (not JSON)
                          for ?block=&?variant= — JSON-escaping a block view's
                          quotes/newlines/<script> bodies needs an escaper
                          Parsley lacks; fetch().text() ignores content type
    -/block/              WebEngine-managed scaffolds (see §2)
    tractionrec/          GENERATED by kroc-tractionrec-sync, gitignored. Plural,
                          REST-style: <tier>.json (e.g. courses.json), per-record
                          <tier>/<id>.json, children <parentTier>/<id>/<childTier>.json
                          (programs/<id>/courses.json). Never hand-edit; the next
                          sync overwrites it (see that repo's docs/)
    _runner/              scratch view for /test-page/'s live Parsley runner,
                          gitignored; holds drafts only
```

**Block views implemented:** `faqs`, `people`, `donation_block`,
`image_gallery`, `facility_section`, `intro_band`, `featured_stories`,
`featured_pages`, `featured_volunteer_opportunities`, `membership_benefits_band`,
`membership_tiers`, `membership_family_play_comparison`, `day_pass_intro_band`, `day_pass_passes`, `about_vision`,
`about_joan_kroc_story`, `about_impact`, `hero`, `church_connect_links`,
`church_ministries`, `church_kids`, `card_grid`, `careers_benefits`, `careers_jobs`, `careers_apply`.
`[featured_volunteer_opportunities]` (block fields assumed:
`block_name`, `block_title`, `view_all_link`, `display_mode`, one-to-many
`featured_opportunities` → `[volunteer_opportunities]`; confirm the built
block API IDs in the Code App and align the block view if they differ).
`[volunteer_opportunities]` as built 2026-06-16: `opportunity_title`,
`hero_image` (single Media), `excerpt`*, `start_date`* / `end_date` (Date &
Time), `about_this_opportunity`* (WYSIWYG), `shifts` repeater {`label`,
`time`}, `role_requirements` (WYSIWYG), `required_trainings` repeater
{`training_name`} — no URL sub-field, so trainings cannot render as links
yet — `location`, `register_link`, `redirect_url` (not in v5), `contact_name`
/ `contact_phone` / `contact_email`. The `volunteer_opportunities` page view
is still an autolayout stub.
`[membership_benefits_band]` as specced 2026-09-10 (blocks-doc §3.1):
`block_name` (admin label, not rendered), `eyebrow`, `title`*, `body`
(WYSIWYG → `toJson()` + dangerouslySetInnerHTML), `checklist_items` repeater
{`item`, `sort_order`}, `checklist_columns` (Dropdown `1`/`2`),
`primary_cta_label` / `primary_cta_url` / `secondary_cta_label` /
`secondary_cta_url` (External URL). **No Background or Ink field** — the only
palette request on record (Figma `25:6`, 2026-06-22, ticket BLK-1) is against
`[intro_band]`, and palette ownership is still open (FC4/FC29), so navy is
hardcoded. Fixed CTA pairs rather than v5 §19's CTAs repeater: the design has
exactly two and a repeater max cannot be enforced. Confirm the built API IDs
in the Code App.
`[membership_tiers]` as specced 2026-09-10 (blocks-doc §3.1): `block_name`,
`eyebrow`, `heading`, `fine_print` (Multi Line Text), `tiers` repeater
{`tier_name`, `age_note`, `price` (Currency), `period`, `sort_order`}. No
per-tier CTA and no `Highlighted?` — v5 §21 `[rate_cards]` modelled both, but
Figma `Card · Membership` 424:531 is documented as having no button and no
eyebrow. No Display Mode (the Comparison Table half is `[membership_family_play]`)
and no Columns field (nothing asks for one; 3-up is hardcoded). **Prices come
from Traction Rec since 2026-10-08** — see "Membership blocks read Traction Rec"
below; `tiers.tractionrec_id` was added then.
`[membership_family_play_comparison]` as built 2026-09-14 (blocks-doc §3.1,
where the model is called `[membership_family_play]` — **the Zesty ref ID is the
longer one**): `block_name`, `eyebrow`, `title`*, `body` (WYSIWYG),
`checklist_items` repeater {`item`, `sort_order`}, `column_heading_1/2/3`,
`comparison_rows` repeater {`benefit`, `standard_plan`, `family_play`,
`sort_order`}, `footnote_line`, `cta_label`, `cta_url`. Comparison values are
text, never Currency — the real content is prose ("$5/child (drop-in)",
"Included", "—"). One checklist repeater, not the catalog's "Checklist A +
Checklist B": CheckList already balances two columns. Headings are three
discrete fields because a repeater cannot nest and the table is fixed at three
columns. The footnote uses `font-serif` → **Adobe Jenson Pro is not in the repo**,
so it falls back to Georgia until the .ttf is added (font-face stub in
src/tailwind.css).
`[day_pass_intro_band]` as built 2026-09-16 (blocks-doc §3.2, catalog name
`[daypass_intro_band]` — **the Zesty ref ID has the underscore**): `block_name`,
`title`*, `body` (WYSIWYG), `primary_cta_label` / `primary_cta_url` /
`secondary_cta_label` / `secondary_cta_url`. No eyebrow (design has none), no
Background field (one background, nothing asks for a control — same call as
`[membership_benefits_band]`). **The catalog's "green palette value pending" is
resolved:** the band is `bg-success` = `--color-brand-green` #12825F, which is
what the prototype's `--kroc-success` already was. The pending green was the
expanded palette's #8DC63F, which fails AA on white at 2.04:1. #12825F is
4.79:1 with PURE white — but only 4.31:1 with the prototype's 92% white, so
this band uses `text-content-ondark`, not an rgba. Any future green-backed
block needs the same care; navy ones have 11.59:1 of headroom.
`[day_pass_passes]` as built 2026-09-17 (blocks-doc §3.2, catalog name
`[daypass_passes]` — **Zesty ref ID is `day_pass_passes`**): `block_name` +
`passes` repeater {`audience`, `label`, `price` (Currency), `ages`,
`cta_label`, `cta_link`, `sort_order`, `tractionrec_id` (2026-10-08)}. ⚠ The
sub-field is `cta_link`; the component read `cta_url` until 2026-10-08, so every
pass button linked to `#` before then. Two fields only — no heading, the design
runs straight from the green band into the cards. Audience and Label are split
because the card renders them at different weights ("**Youth** Day Pass"). CTA
is per-row so Youth/Adult can point at different purchase flows. Grid is 2-up
in a 960px box (verified: 468/468 + 24px gap); a third pass wraps to 2+1.
`[about_vision]` as built 2026-09-17 (blocks-doc §3.3): `block_name`, `image`
(Media), `title`*, `body` (WYSIWYG), `checklist_items` repeater {`item`,
`sort_order`}. **No "Check Colour" field** though the catalog lists one — red is
pinned in the template, on the same reasoning as the dropped Background fields:
the colour varies between blocks (red here, green on Family Play / Careers) and
never within one. Layout is the MIRROR of IntroBand's photo variant — 5fr/7fr
photo-LEFT, not 7fr/5fr photo-right (verified 41.7%/58.3%); without an image it
collapses to one column. The 4:5 image crops to cover, since the column height
is set by the copy, so a 4:5 source loses top and bottom on short copy.
`[about_joan_kroc_story]` as built 2026-09-18 (blocks-doc §3.3, catalog name
`[about_joan_kroc]` — **Zesty ref ID carries `_story`**; model
`6-8cb9d0c7cd-r6833m`): `background_image` (Media), `title`*,
`title_emphasis`, `body` (WYSIWYG), `video_url` (External URL). Five fields,
no repeater. **No "Scrim" boolean** though the catalog lists one — it has no
requester (the word appears only in our own field list and in a Figma note
about the grey placeholder fill) and it is not an option: white type sits
directly on a photo, so scrim-off is unreadable. **Title is two text fields,
not the catalog's WYSIWYG** — the design's heading is structurally two lines
with the second at weight 500, so two fields say that and nothing more.
**Body is ONE WYSIWYG in CSS multi-column**, not two authored columns: a
2-paragraph body lands one per column (the source's two col-md-6 divs) and
other counts still balance. Video is its own field rather than an iframe
pasted into the WYSIWYG, which sidesteps open question F4; `krocYouTubeId`
accepts watch / youtu.be / embed / shorts / bare-id, including the apex site's
double-slash `embed//`. **Desktop and mobile are separate designs**, both
followed: 34px + 15.5px + 48x56 padding + emphasis on its own line above `lg`;
22px + 14.5px + 22px padding + emphasis inline below it. Scrim is the design's
navy 82% -> ink 88% (compiles to `#002056d1` / `#1c1b1fe0`); measured on the
render over a near-white photo — the worst case — body ink is 7.65:1 and the
heading 9.31:1, so unlike the green Day Pass band this one has AA headroom.
⚠ **X9/F9:** ticket 2444 moves this content to `[national_content]`, since the
copy is identical on all 26 sites and drifts ("accomplished **here**" = San
Diego, "26 Kroc Centers", "$1.5 billion"). Built per-page because X9 changes
where the record lives, not the field shape — the swap is a source change in
the block view. Video hosting is **no longer pending**: T10 (Erin, 2026-09-03)
settled it as YouTube for video with audio, native upload for silent b-roll.
`[about_impact]` as built 2026-09-21 (blocks-doc §3.3; model
`6-96e7a4898e-mjdk87`): `section_title`, `stat_image` (Media), `stat_value`,
`stat_caption`, `heading`*, `body` (WYSIWYG), `cta_label`, `cta_link`
(External URL). ⚠ **Ref IDs are `section_title` and `cta_link`**, not the
`title` / `cta_url` used elsewhere in this set. **Section Title is a field the
catalog's list omits** — the design puts a SectionHead above both cards on
both surfaces, and `[featured_pages]` / `[people]` already carry a `title` for
that. **No "Show Social Row" boolean** though the catalog lists one: no
requester, and the row renders from `globals.social_handles` (the footer's
source), so a center without handles shows nothing anyway. `cta_link` falls
back to `globals.donation_link`, the same pattern `donation_block.html`
already uses, so the Classy URL is typed once. Stat value and caption are real
text, never a baked graphic — the reference site's "1 in 3" is a JPEG, which
the catalog flags on `[donate_impact]`. Scrim is black 25% -> 70% and
deliberately **bottom-weighted**, because the stat is anchored to the card
foot: measured over a pure-white photo (worst case) the caption reads 5.94:1
and the number 8.19:1, while the card's light top carries no text. Desktop and
mobile are separate designs, both followed: 5fr/7fr + 54px stat + 28px heading
+ 40x44 padding above `lg`; stacked + 46px + 19px + 22px below. Section-head
leading is spelled out (1.2 / 1.25) because the type token pairs 34px with a
48px line box where the design pairs it with 42.5px — worth knowing that
`[featured_pages]` and `[people]` use the bare token and so sit ~5px looser
than the design. ⚠ **"Remove Impact" in `meeting_notes.md` does NOT kill this
block** — the minutes scope that decision to the HOMEPAGE ("exclude the our
impact section from the final homepage layout"); the About Us section is still
in v4/v5 §39 and both Figma syncs. Merge candidate with `[donate_impact]`
(Stat Value + Stat Caption + Body only); a social-row toggle earns its place
if that merge happens.
`[hero]` as built 2026-09-22 (v5 **V3 `[hero_block]`**, blocks library §7.24;
model `6-a6dea4f6cd-2q94f9` — **Zesty ref ID is `hero`**): `eyebrow`,
`heading`*, `subheading` (Multi Line), `badge_icon` (**Media**, not a glyph
name), `badge_text`, `primary_cta_label` / `primary_cta_link` /
`secondary_cta_label` / `secondary_cta_link`, `show_social_links` (Boolean),
`media` / `background_color` / `artwork_mode` / `alignment` / `height` (all
Dropdown), `hero_image_desktop` / `hero_image_mobile` (Media), `video_url`.
Replaces the **16 heroes** the prototype hand-drew (15 inline + 1 already on a
`HeroBlock` component); ticket 2446 closed `[rentals_hero]` into this.

**There is no display-style variant, by design.** A Zesty variant is a content
item, so every variant shares this schema — the layout therefore keys off
WHICH FIELDS ARE FILLED: `badge_icon`/`badge_text` -> the chip, either CTA
label -> the button row, `show_social_links` -> the circle row. The Rentals
"Save the Arts" art-deco treatment was the only thing that would have needed a
real variant flag and was **deliberately dropped** (2026-09-22) so Rentals
renders as a plain centred image hero.

One chip, two shapes: a 48px tile when only `badge_icon` is set (the catalog
pages' category icon) and a pill once `badge_text` exists (the tag page's
"#youth", minus the prototype's monospace). **`badge_icon` is a Media field**,
matching `[featured_pages]`, which already resolves its icon from an uploaded
asset — so the artwork must be light-on-transparent, since an uploaded image
cannot inherit currentColor the way a sprite glyph does.

**Deviations from the V3 table:** CTAs are a fixed pair, not a `max 2`
repeater (Zesty cannot enforce a max, and every block here uses
`primary_*`/`secondary_*`); `height` is a Dropdown `compact|standard|tall`
rather than `Number default 340`, because the 16 heroes cluster into exactly
three sizes and both surfaces already have named ones (`.m-hero.short` 260 /
`.tall` 560) — compact 260/280, standard 340 then 3:1, tall 560/440; no
Thumbnail field (nothing consumes one, and Zesty generates `og_image`); no
Focal Point (requested at Phoenix 2026-08-21 but no hero design uses it).

**No X8 Ink control — the unsafe colours are simply absent instead.** Measured
against the 17px subheading at AA: navy 13.36, dark 14.63, red-300 5.37,
green 4.79 (with PURE white ink — the prototype's 92% drops green to 4.31 and
fails, the same trap as the Day Pass band). Excluded: **brand red #ef3e42 at
3.48** — note the prototype's own HeroBlock *defaults* to it — plus danger
3.85 and amber 1.86. `red` therefore maps to the darker `#c5000e`. The
expanded palette X8 measures (purple / blue / dark-magenta) is **not in
src/tailwind.css**, so it was never an option here.

Dropdown values: the GraphQL schema types every dropdown as `String` and there
is no way to read the option list from `/-/gql/`, so `krocHeroToken` lowercases
and hyphenates whatever arrives ("Pre Designed" / "pre_designed" ->
"pre-designed") and every lookup falls back to a safe default. If a dropdown's
stored values turn out to differ, fix them in the manager rather than adding
aliases here.

`artwork_mode` is implemented with `<picture>` + a `(max-width: 1023px)`
source, so `pre-designed` genuinely swaps the file (verified: mobile fetches
the mobile asset, desktop the desktop one) rather than scaling one. ⚠ **A
`srcset` is comma-delimited, so a `data:` URI can never go in one** — that is a
test-harness limit, not a live one; Zesty media URLs
(`…media.zestyio.com/x.jpg?width=900&fit=bounds`) carry no commas.
`media: video` renders the poster plus a play affordance and swaps in the
YouTube iframe on click, reusing `krocYouTubeId`.
`[church_connect_links]` as built 2026-09-28 (blocks-doc §3.5; model
`6-d4c6d8d798-09gg19`): `heading` + `items` repeater {`label`, `link`
(External URL), `style` (Dropdown), `sort_order`}. **Not `[featured_pages]`
compact** though v4 filed it as the candidate — that mode draws a centred 42px
icon chip on a white card, while these are full-bleed colour bars with no icon
and no card. **One `style` field, not the catalog's separate Colour + Size:**
the design uses only 3 of the 6 combinations those allow, and the tints are
bound to the size (navy-200 never appears small, navy-150 never large), so the
pair is one hierarchy — `primary` large red, `secondary` large navy, `tertiary`
small navy-light. Style also sets the column count (large 2-up, small 3-up,
both 1-up on mobile), so there is no Columns field; and no Icon field, since
every bar carries the same `#i-arrowur`. ⚠ **The catalog's "Internal Link or
External URL" is not constructible** — a repeater cannot hold a relational
sub-field — so links are External URL only and `krocExternalUrl` supplies a
missing protocol. ⚠ **Colour deviates from the design once:** the large red bar
is drawn `--kroc-red` #EF3E42, which carries white 16px text at **3.86:1 and
fails AA** (16px is not "large text"), so `primary` renders red-300 #C5000E =
6.21:1 — the same substitution `[hero]` makes. `tertiary`'s navy-150 passes at
**4.59:1 with nothing to spare**, so its label must stay PURE white; an rgba
tint drops it under 4.5, the way the Day Pass green band nearly failed.
⚠ **Repeater sub-field IDs are unverified** — `/-/gql/` types a repeater as
`String` and the only content item is empty, so `label` / `link` / `style` /
`sort_order` are as specced, not as read. Confirm in the Code App.

`[church_ministries]` as built 2026-09-29 (blocks-doc §3.5; model
`6-d6d5d5b7bf-1zcv11`): `ministries_heading`, `ministries` repeater
{`title`, `when`, `description`, `sort_order`}, `prayer_request_heading`,
`prayer_request_body` (Multi Line Text), `prayer_request_cta_label`,
`prayer_request_cta_link` (External URL). **One block for what the catalog
filed as two** — `[church_prayer_card]` was merged in (ticket 2453): desktop
draws both halves in ONE `7fr 5fr` grid and mobile stacks them as two
differently-structured sections, so two placed blocks could express neither.
That is also why the catalog's "two blocks in a row" platform question never
needed a Freestyle ruling (v5 §793 amended). Field names carry their half
explicitly rather than a generic Heading/Aside pair. **The Prayer half is
presence-driven** — its heading or body opens the grid; either half alone runs
full width. `Width` and `Background` went with the merge. **Desktop and mobile
are separate designs, both followed:** When sits inline-right, baseline-aligned,
on desktop and on its own line under the title on mobile; the Prayer heading is
a section head ABOVE the navy card on desktop and an h2 INSIDE it on mobile —
rendered twice, both copies `display:none`-toggled so only one reaches the
accessibility tree. `when` is text because the values are recurrences ("3rd
Sunday · 4–6:30 PM") no Date type can hold. ⚠ **When deviates from the design's
colour:** `--kroc-red` #EF3E42 on white is 3.86:1 and fails AA at 13px (11.5px
on mobile), so it renders red-300 #C5000E = 6.21:1 — the third block to need
that substitution. Descriptions use `text-content-muted`, which IS the design's
#575757 (7.23:1). The prayer body ships via `toJson()`, not a hand-built string:
it is Multi Line Text, so it can carry quotes and newlines. ⚠ **Repeater
sub-field IDs are unverified** — the model has no content item yet.

`[church_kids]` as built 2026-10-05 (blocks-doc §3.5, ticket 2454; model
`6-88aff6e990-2b59gd`, the first created with `zesty-model.mjs`, so it
has no auto `og_image` field — the Manager adds that, the API doesn't):
`eyebrow`, `heading`, `body` (Multi Line Text), `cta_label`, `cta_link`
(External URL), `troops_heading`, `troops` repeater {`label`},
`awards_heading`, `awards` repeater {`title`, `description` (Multi Line Text),
`tone` (dropdown `red` | `amber`)}. Pills and tinted boxes are why this is a
block, not Page Content. **Two sub-heading fields the ticket omitted** —
"Troops · 4–5 PM" and "Award Ceremonies" are in the design, and the time is
content. `heading`, not the ticket's Title, matching the other Church blocks.
No `sort_order` on either repeater: nobody asked for one. **Tone:** `red` =
brand-red-50 #FFEBEB, `amber` = the design's #FFF6E8 (a brand-amber tint, no
token); empty/unknown alternates red, amber in row order, the design's
sequence. **Either half is presence-driven** — troops alone or awards alone run
full width. **Desktop and mobile both followed:** the CTA sits top-right of the
heading on desktop and at the bottom of the card on mobile, rendered twice and
`display:none`-toggled; pills shrink to the mobile `.pill.sm` size. ⚠ The
eyebrow renders red-300 #C5000E, not `--kroc-red` (3.86:1 fails AA at 11px) —
same substitution as `[hero]` / `[church_ministries]`. Body ships via
`toJson()` (quotes, newlines). Repeater sub-field IDs are verified here —
they came from the spec the tool created the model from.

`[card_grid]` as built 2026-10-05 (model `6-8891ccd8fc-zxrpdq`; variant
"Church Groups" `7-86f0b1c5fe-zst4tm`, both made through the API): `cards`
repeater {`title`, `body` (Multi Line Text), `pills` (Multi Line Text, one pill
per line)}. **A general block, not the catalog's `[church_groups]`** — Japheth
2026-10-05: `[careers_values]` is the same white-card grid and gets its
optional Icon + section Heading added HERE (each rendered only when filled),
not a second model. NOT `[featured_cards]` 7.20 either, which the catalog named:
that is the homepage class/event/promo card block, built on references a
repeater can't hold. **Pills is flat text** because the ticket's
Pills-repeater-inside-Items nests a repeater, which Zesty disallows. **No
Columns field** — desktop columns follow the card count (1 → full, 2 or 4 →
2-up, else 3-up); mobile stacks. No Sort Order: cards keep repeater order.
**`[careers_values]` joined 2026-10-05** as variant "Careers Values"
`7-849a8ae2c0-v0kj18`, adding `heading` (block, sort 10000) and `cards.icon` /
`cards.photo` (Media). Everything presence-driven: Heading → section head plus
16px more top space (headed sections sit 48px down in the design, follow-on rows
32px); Icon or Photo → the ValueCard media face, a 160px band (140 mobile) over a
19px title, Photo full-bleed (Erin's ask, 💬1871730857) else the navy-50 → area
gradient with the icon in a red-50 chip. Icon/Photo are repeater Media, so bare
ZUIDs, resolved client-side by `useKrocMediaUrls` → `custom-endpoints/media.json`
(keyed by ZUID: the endpoint's order isn't guaranteed). Icons render as
uploaded — colour comes from the file. The three design icons were uploaded from
the `icons.html` sprite, stroked #EF3E42: `kroc-icon-heart.svg`
3-161f2cfb-w5mf29, `-users` 3-161f2cfd-7zfj57, `-star` 3-161f2cfc-llf6b5.

`[careers_benefits]` as built 2026-10-07 (blocks-doc §3.6, ticket 2457; model
`6-beb0bf9a9e-gj5vqr`, variant "Careers Benefits" `7-8ae7f29996-cr43f5`):
`heading`, `checklist_items` repeater {`item`}, `video_url` (External URL).
**Its own block, not an `[about_vision]` variant** (Japheth 2026-10-07), so the
catalog's Columns and Check Colour are not fields: green and two columns are
this card's design (`CheckList columns={2}` is one column below `sm`, which is
the mobile design). **`video_url` is the employee-testimonial request** — morgan
2026-07-24 (💬1857887156) "videos of employee testimonials … from youtube",
source settled by Erin as YouTube for video with audio (T10, ticket 2493). No
design places it, so it sits under the checklist inside the card, framed exactly
like `[about_joan_kroc_story]`'s (16:9, max 820px, centred) and parsed by its
`krocYouTubeId`, so any YouTube link shape works and a non-YouTube URL renders
no frame. One video, per Japheth. No Sort Order (nobody asked).

`[careers_positions_band]` → **variant "Careers Open Positions" of
`[intro_band]`** (2026-10-07, ticket 2458; `7-a2bbab91a0-4xtq2s`), not a model:
the centred navy band with title + body and no CTA is intro_band's colour band
in every respect but alignment. So `[intro_band]` gained **`alignment`**
(Dropdown `left` | `center`, same field + values as `[hero]`): `center` centres
the colour band's copy and CTA row; empty stays left, so the bands already
placed don't move; the white card and photo split ignore it. The catalog's
Background (X4) is the existing `background_color`. ⚠ **The B5/T16 icon answer
("centered above the title") belongs to the Job Listings cards
(`[careers_jobs]`), not the Values cards** — the 2026-09-03 digest and ticket
2499 filed it under "value cards", but Erin's B5 pin (💬1871731526) sits on Job
Listings and T16 answers our B5 follow-up. The Values cards' band face comes
from C2 (icon or photo) and stands.

`[careers_jobs]` as built 2026-10-07 (blocks-doc §3.6, ticket 2459; model
`6-86a5c2eeb5-lplp0x`, variant "Careers Job Listings" `7-c687b5fec0-km9jrg`):
`departments` repeater {`department`, `location`, `icon` (Media), `roles`
(Multi Line Text)}. **The ticket's Roles repeater would nest inside
Departments**, so the department stays the row (icon + location belong to it)
and Roles is one role per line as `Title | link` — split on the LAST `|` (a
title may contain one), link through `krocExternalUrl`, a line without a link
renders as plain text. **Icon is B5** (Erin, 💬1871731526: "one card being
Aquatic positions, one card Fitness positions"), placed "centered above the
title" per T16 — undesigned, so taken literally: 44/48px, centred, rest of the
card left-aligned; the slot keeps its size while `useKrocMediaUrls` resolves
it. Role links render red-300 (design red fails AA at 15px). Columns follow the
department count like `[card_grid]`. The variant's roles have no links yet —
the design has none; add `| <posting URL>` per line.

`[careers_apply]` as built 2026-10-09 (blocks-doc §3.6, ticket 2460; model
`6-8099c2c6b3-n1qdsq`, variant "Careers How to Apply" `7-fc9cf48cec-s23ppg`):
`heading`, `body` (WYSIWYG), `text_apply_eyebrow`, `text_apply_keyword`,
`text_apply_shortcode`. **One block for what the catalog filed as two** —
`[careers_text_apply]` (ticket 2461) was merged in on the `[church_ministries]`
precedent: desktop draws both cards in ONE `7fr 5fr` row, mobile stacks them,
and two placed blocks could express neither. Fields carry their half
(`text_apply_*`). **The red half is presence-driven**: keyword or shortcode
opens the grid (an eyebrow alone doesn't); either half alone runs full width;
an emptied WYSIWYG (`<p>&nbsp;</p>`) counts as empty. No Background field (red
on both surfaces, nobody asked). The red card is **`KrocSmsCard`**, a separate
component, because Hours draws the same card beside its hours card
(`[hours_alerts]`, blocks-doc F3) — that block should reuse it and add its
heading + CTA. ⚠ **Two contrast deviations:** the card is red-300 #C5000E, not
`--kroc-red` (3.86:1 fails at 11–15px), and the eyebrow / "to …" line are 90%
white, not the design's 80% (~4.25:1 on red-300, fails at 11px; 90% ≈ 5.15:1).
Body goes through `.kroc-prose`, resized to the design's 13 / 14.5px.

**Still placeholder:** `external_embed`, `featured_classes`, `custom_forms`,
`custom_navigation`. **Models not yet created** (v3): `featured_events`,
`featured_programs`, `map_block`, `rate_cards`, `job_postings`,
`[event_categories]` taxonomy.

**Featured-block build order** (dependency analysis vs v3): Stories ✅ →
Volunteer Opps ✅ (one-to-many, as v5 §18 designed) → Programs (needs block
model) →
Classes (needs PricePoints X3 + session dates + marketing_description on
[classes]) → Events (needs model + [events] fields + event_categories) →
Pages (independent; big own schema per SCHEMA-9).

---

**Block variant ZUIDs** — a "variant" is a content item of the block model, so
its ZUID is a `7-...`. Verified against the dev instance 2026-09-17:

- **`/-/block/<name>.html` is directly fetchable** and renders server-side with
  the model's **default** variant; `this.zuid` (in the section id) is that
  variant's ZUID. Fetching all 19 blocks is how the defaults were harvested.
- **`?variant=<zuid>` works on that URL** — the rendered `this.zuid` changes to
  match. An unknown ZUID does not error, it falls back.
- **Block models CAN be enumerated — `gql` minus `instant`.** There is no
  direct listing (`/-/block/`, `/-/blocks[.json]`, `/-/block.json`,
  `/-/block/index.json`, `/-/instant/blocks.json`, `/-/sitemap.xml` all 404),
  but `/-/gql/` returns **every** content model (zuid, label, name, field
  schema, per-model URL) and `/-/instant/` returns **page** models only, so
  `gql − instant` is exactly the set of block models. Verified 2026-09-17:
  the difference is 20, identical to the files in `/-/block/`. Drop `unknown`
  (the WebEngine fallback) for a usable 19. `blocks_catalog_page` derives its
  block dropdown this way and hardcodes nothing.
- `/-/gql/<model>.json` **does return every variant** of a model
  (`image_gallery` -> 3). Its one gap is the ZUID: the flat JSON has no `zuid`
  key (`status_zuids` and `uri` are both null). It *accepts* `?zuid=<zuid>` as
  a filter — verified, and `datasource.js` shows `get('<model>.json', {zuid})`
  — so gql can look **up by** a ZUID but never **reports** one. Note
  `/-/gql/zesty.schema` declares `zuid: ID!` on every type, so the generated
  GraphQL schema promises a field its own REST data source does not supply.
  The only ZUID carrier in the payload is `og_image`, whose URL embeds
  `variant=7-...`. **It is close but not complete**, and the failure is silent:
  measured 2026-09-18, gql returns 23 items across all blocks but og_image
  yields only **22 unique ZUIDs**. `membership_family_play_comparison` has a
  duplicated item ("… (copy)") whose screenshot was never regenerated, so its
  og_image still carries the *original's* ZUID — two distinct variants report
  one, and the real second (`7-dce2dae3a3-j1khws`, which renders fine) is
  invisible to gql. So **always dedupe by ZUID** when reading og_image, and
  treat `item count > unique ZUIDs` as variants lost, not as duplicates.
  A Parsley endpoint looping each model (`{{each <model> as b}}{{!b.zuid}}`)
  reports ZUIDs authoritatively and would close that gap — one existed briefly
  and was **retired 2026-09-18**: it needed a hand-written line per model, and
  the only variant it recovered was an unedited duplicate whose screenshot had
  not regenerated. `blocks_catalog_page` runs on gql alone and surfaces any
  shortfall as "N unresolved" rather than hiding it. (`blocks.json` now exists
  again but does something else entirely — it renders a block to HTML.)
- ⚐ **Worth trying**: the Instant API *does* report `meta.zuid` per item, but
  404s for block models and indexes only the 21 page models. If block models
  can be exposed to it (per-model setting in the manager),
  `/-/instant/<block-model-zuid>.json` becomes the authoritative dynamic source
  for variants, removing the og_image scraping entirely.
- The page-visual-layout JSON is fetchable at runtime
  (`/z/pvl/<zuid>.json`) and does contain block names + variant ZUIDs, but it
  is 463KB gzipped and only covers blocks placed on that one page — rejected
  as the catalog's data source for both reasons.
- **`/-/instant/` lists page models only** — no block models — so the instant
  API cannot enumerate variants.
- Any page where a block is placed records its variants in the synced
  `z/pvl/*.json`, next to the model's `6-...` ZUID and display name.

Default + PVL together gave 22 variants across 15 models for the catalog page.
Neither source is exhaustive; the complete set for a model still needs an
endpoint that loops it (`{{each <model_ref> as b}}{{b.zuid}}{{end-each}}`).
The 4 blocks that are still empty scaffolds (`custom_forms`,
`custom_navigation`, `external_embed`, `featured_classes`) return the
"Template File is empty" alert and have no variant.

End-to-end overview of both (tiers, files, models, how pages and blocks read
them): `../kroc-tractionrec-sync/docs/tractionrec-in-zesty.md`.

**Catalog pages read Traction Rec, not Zesty** (2026-10-05). `categories`,
`programs`, `courses`, `classes` and `categories_page` inline their own row and
children at render time —
`<script type="application/json" id="kroc-tr-self">` holding
`{{ include /tractionrec/<tier>/{this.tractionrec_id}.json }}` (and
`…/<id>/<childTier>.json`) — and read them with `krocTrInline`. Rules:

- **Any Zesty field that mirrors Traction Rec is ignored** (Japheth): names,
  course `description`, all 12 class schedule/price/capacity fields, and the
  relational `categories`/`programs`/`courses` fields. The Zesty title is only
  a fallback for an item with no Traction Rec row.
- Zesty still supplies what TR has no source for, from the page's **own**
  item only: hero image, icon, subtitle, intro copy, class type, location,
  tags. Child cards are TR-only (those Zesty values are all seed-template
  placeholders today).
- Card links use `meta.zestyPath`, which the sync writes; parents (crumbs) come
  from TR ids via `CatalogCrumbs`, drawn per the designs: desktop is a trail
  ("Programs" root on category + program pages only; course + class pages
  start at their category), mobile is one back link to the parent
  ("‹ All Programs" / "‹ Return to <parent>"). The root's URL is read with
  `each categories_page as cp` → `cp.getUrl()`; a direct
  `categories_page.getUrl()` renders empty.
- Spot counts show whenever TR allows (`Show_Capacity_Online__c`) and they mean
  something: "N spots remaining", else Open / Waitlist open / Full.
- The old endpoints `custom-endpoints/{categories,programs,courses,classes,
  class-finder,catalog-parents}.json` have no callers since this change.
- **Hidden class pages** (2026-10-09, 10-02 working group decision): the
  course field **`hide_class_pages`** (Yes/No, not required, so the sync never
  seeds it) keeps visitors on the course page. `catalogdata.jsx` builds
  `KROC_HIDDEN_CLASS_PAGES` (TR course Id -> course URL) with one Parsley loop,
  `each courses as c where c.hide_class_pages = 1` (verified: a `where` on a
  yes_no field filters correctly). `krocTrClassGate(row)` matches a class row's
  TR course Id against it: the `classes` view then renders `ClassGate` (holding
  card, siblings hidden, `noindex`, `location.replace` to the course) instead of
  `ClassDetail`, and `krocTrClassToCard` points the card's `url` at the course.
  On the course, not the class, because classes are re-created every season;
  matched by TR Id, not the class's `courses` relational field, which is due to
  go. Components are served `no-cache` and the file's cache tags include the
  courses model, so a saved toggle shows on the next request — no sync run.
  Test course: Learn-To-Swim Level 2 (`7-c2d0b38fd0-rddgsb`) has it on.

**Membership blocks read Traction Rec** (2026-10-08). The sync publishes
memberships as **files only** — no Zesty model, no items:
`/tractionrec/membership_types.json` (24 types sold online) and
`membership_categories/<id>/membership_types.json`. `[membership_tiers]` and
`[day_pass_passes]` inline the whole tier file next to the mount
(`kroc-tr-memberships-<zuid>`, about 58 KB) and read it with
`krocTrMembershipIndex` (`membershipdata.jsx`). Rules:

- A repeater row opts in with **`tractionrec_id`** (the Membership Type Id,
  `a2g…`) — one per card, so the editor picks the exact type (Autopay vs
  Annual vs 1 Month are separate types) and the order (`sort_order`; Traction
  Rec has none for types).
- With an id, **price, period and ages come from Traction Rec** and the typed
  ones are ignored. The name is the one exception: Traction Rec's name minus the
  payment plan and a trailing "Membership" ("Adult Membership - Autopay" →
  "Adult"), and a typed `tier_name` / `audience`+`label` **overrides** it — it
  is wording, so a stale one cannot show a wrong price. The age label
  (`Age_Range_Name__c`) is deliberately not used: "Summer Teen Membership 2026"
  carries "Teen".
- An id that is not in the file (no longer sold online) **hides the card**
  (console warning). A missing file (instance without the sync) renders every
  row as typed.
- Price: Autopay = monthly schedule amount + "/mo"; Annual / 1 Month = one-time
  schedule amount + period from the term ("/yr", "/mo", " for 3 months"); Day
  Pass = the price level's initial fee. On memberships the initial fee is the
  $20 registration fee — `fine_print` still states it in words.
- **Purchase links never come from a block's link field** (Japheth
  2026-10-08): `cta_link` (pass rows), `membership_benefits_band.primary_cta_url`
  and `membership_family_play_comparison.cta_url` are **not read**. The link
  belongs to Traction Rec, like the catalog's Register (the class's
  `Deep_Link_URL__c`), but no membership has one — the class link is an
  org-made formula, and the portal address it is built from
  (`$Setup.TREX1__App_Config__c`) is not readable by the integration user. Until
  the org adds a link field, `krocTrMembershipPurchaseUrl` returns the interim
  site-wide **Globals → `membership_purchase_url`** for all three buttons (no
  link = no button). The benefits band's secondary button is not a membership
  link and keeps its own URL.
- **Fee:** `fine_print` may hold **`{fee}`**, filled with the Traction Rec
  registration fee of the cards shown (`krocTrFillFee` / `krocTrFeeText`:
  "$20", or "$20–$55" if they differ); with no fee the sentence holding it is
  dropped. The variant's text uses it since 2026-10-08.
- Linked 2026-10-08: "Membership Tiers" (`7-e09de29d81-g5j19d`) holds the six
  Phoenix Autopay types, "Day Pass Passes" (`7-c48fc1b485-sk9t7x`) the four
  online day passes (San Diego demo rows replaced; the old versions are in the
  item history). Globals' `membership_purchase_url` is set to the sandbox
  portal's `/s/membership` — unconfirmed, the portal redirects to its login.
  ⚠ Globals is a dataset item, not a variant: don't write it with
  `zesty-variant.mjs` (it stamps a block og_image and renames the item).
  There are no Membership / Day Pass pages on the instance yet
  (`informational_pages` has 0 items).

---

## 6. Known gaps / pending

- Header CTAs + utility bar + nav hardcoded — awaiting `header_cta_1/2`
  globals (SCHEMA-3) and the `[custom_navigation]` model (SCHEMA-1/2);
  mega-menu content static until `[program_categories]` loop is re-verified
  and `[event_categories]` exists.
- **Catalog content issues found 2026-10-05 (Manager fixes, not code):**
  the catalog root item lives at `/categories-page/` (crumbs now read its URL
  from the item, so they work; the URL itself is still worth renaming); the
  Basketball program and the hand-made test course "Basketball"
  (`7-b4d5d7c2fa-s3w9mw`, the sync's course seed template) both claim
  `/basketball/`, and Zesty serves the course; the `classes` view's
  `this.autolayout(auto)` prints the item's frozen Zesty field values under the
  class detail. Six catalog endpoints are now unused (above) — delete in the
  Manager once confirmed.
- Footer mission text uses a hardcoded fallback — v3 puts the field on
  `[connect_block]`.
- `globals.donation_link` referenced by the donation block but not yet in
  the schema (bang-guarded).
- Repeater media (bare ZUIDs) is resolved only in `card_grid` so far, by
  `useKrocMediaUrls` in `cardgrid.jsx` (§3, two-pass `media.{csv}` lookup via
  `custom-endpoints/media.json`). Not yet applied to People headshots or
  `featured_pages` logos/heroes, which still fall back to placeholders.
- Long-text fields in hand-built JS strings need a Parsley escape modifier
  eventually (or migrate those payloads to toJson transport).
- Content URLs entered without protocol (`facebook.com`) resolve relative to
  the site — fix content or normalize in JS.
- CSS served stale = broken layout: if new elements render unstyled, the
  instance's `styles.html` wasn't re-synced after a build.
