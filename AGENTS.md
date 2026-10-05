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
                          (red/navy band)
      cards.jsx           shared cards: StoryCard (+ krocFormatDate), OppCard,
                          TierCard (membership/rate row — name + note left,
                          price + period right; items-center per quick-win A1),
                          PassCard (centred Day Pass card — bold audience +
                          label, 64px price, ages, own CTA);
                          ClassCard/EventCard/CategoryCard land here later
      featuredstories.jsx FeaturedStories — grid 3-up | carousel, curation order
                          restored from one-to-many CSV
      featuredpages.jsx   FeaturedPages — compact chips | grid cards from the
                          `featured_pages` repeater; owns the shared repeater
                          helpers (krocMediaRef, useKrocMediaUrls two-pass media
                          resolve, krocSizedMedia, krocExternalUrl, krocSortRows)
      membershipbenefits.jsx MembershipBenefitsBand — navy band + 2 CTAs +
                          CheckList column (block: membership_benefits_band).
                          Background is NOT a field — see the header comment
      membershiptiers.jsx MembershipTiers — 3-up TierCard grid + section head +
                          fine print (block: membership_tiers). Prices via
                          krocMoney from catalog.jsx
      daypassintro.jsx    DayPassIntroBand — green band + WYSIWYG body via
                          .kroc-prose repainted on-dark (block:
                          day_pass_intro_band)
      daypasspasses.jsx   DayPassPasses — 2-up PassCard grid, max 960 (block:
                          day_pass_passes)
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
`church_ministries`.
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
and no Columns field (nothing asks for one; 3-up is hardcoded). Prices are
authored, not read from TR — TR does model them (`Membership_Type__c` →
`Product__c` → Price Level, `Total_Billing_Schedule_Amount__c`) but the proxy
service does not exist yet.
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
`cta_label`, `cta_url`, `sort_order`}. Two fields only — no heading, the design
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
- People block headshots: repeater media sub-field = bare ZUIDs. No longer a
  dead end — resolve them the way `featuredpages.jsx` does (§3, two-pass
  `media.{csv}` lookup via `custom-endpoints/media.json`). Not yet applied.
- Long-text fields in hand-built JS strings need a Parsley escape modifier
  eventually (or migrate those payloads to toJson transport).
- Content URLs entered without protocol (`facebook.com`) resolve relative to
  the site — fix content or normalize in JS.
- CSS served stale = broken layout: if new elements render unstyled, the
  instance's `styles.html` wasn't re-synced after a build.
