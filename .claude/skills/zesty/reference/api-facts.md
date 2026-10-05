# Zesty API facts (verified on the KROC dev instance)

The public docs (docs.zesty.io, index at `/llms.txt`, raw pages at `<page>.md`) give endpoints but rarely shapes or side effects. **When in doubt, read existing objects from the instance and copy their shape** — that is how everything below was established.

## Hosts

- Instance API: `https://<instance_zuid>.api.zesty.io/v1` — `content/models`, `content/models/<m>/fields`, `content/models/<m>/items`, `web/views`, `web/stylesheets`, `web/scripts`.
- Accounts: `https://accounts.api.zesty.io/v1/instances/<instance_zuid>` → `randomHashID` (`6wz46m14`).
- Dev WebEngine (preview): `https://<randomHashID>-dev.webengine.zesty.io` — `/-/block/<model>.html?variant=<7-zuid>`, `/-/gql/`, `/-/gql/<model>.json`, `/custom-endpoints/*`.
- Media manager: `https://media-manager.api.zesty.io` — `/file/<3-zuid>`, `/bin/<1-id>`, `/bin/<1-id>/files`. `/site/<instance>/bins` returns 401 for developer tokens → find the bin through an existing file.
- Media storage (upload): `https://media-storage.api.zesty.io/upload/<bin.storage_driver>/<bin.storage_name>` — multipart `bin_id`, `group_id` (= bin id for the top level), `user_id`, `file`. Provider is the bin's `storage_driver` (`gcp`); the docs' `gcs` → 400 "Unsupported provider".

## Models + fields

- Create model: `POST content/models` `{name, label, type: block|dataset|pageset|templateset, description, listed}`. A block model immediately gets a generated view `-/block/<name>.html` ("Template File is empty" placeholder).
- **The API does not add `og_image`**; the Manager does. Its exact definition (sort 9999, `images`, `{defaultValue:null, group_id:"", limit:1, list:false}`) is in `zesty-model.mjs` (`OG_IMAGE_FIELD`) and is added automatically.
- Manager starts user fields at sort 10000.
- Field settings the Manager writes: scalars `{defaultValue:null, list:true}`; repeater `{list:false, subFields:[…]}` (no defaultValue); dropdown/yes_no add `options {value: Label}`; images add `limit`; currency adds `currency:"USD"`. `zesty-model.mjs` reproduces these — its `show` round-trips all 45 live models.
- Update field: `PUT …/fields/<12-zuid>` replaces `settings` wholesale — always send the full settings (the tool rebuilds them from a spec).
- Relations: `relatedModelZUID` + `relatedFieldZUID` (the field to display).
- Legacy oddities on the instance: `hero.background_color` and `clippings.timezone` dropdowns have only an empty option; `test_page.integration_test` stores a Salesforce bearer token in its settings.

## Items (block variants)

- A variant = a content item of the block model; its Manager name = `web.metaTitle`. `POST …/items {data, web:{metaTitle, canonicalTagMode:1, sitemapPriority:-1}, meta:{listed:true}}`; no pathPart/parent for blocks.
- **`PUT …/items/<7-zuid>` without `meta.listed` UNLISTS the item** → it vanishes from `/-/gql/` and its render 400s (`{{!this.zuid}}` → "field does not exist"). Always send `meta:{masterZUID, listed:true}` and `web.sitemapPriority:-1` (all Manager variants carry both). PUT replaces the version wholesale — send every data field.
- Stored value shapes: text/textarea/wysiwyg/link/date strings; `datetime` `"YYYY-MM-DD HH:MM:SS.000000"`; `number`/`sort` numbers; `currency` string; `yes_no` 0/1; `images`/relations comma-joined ZUIDs (`3-…` / `7-…`); repeater = array of row objects keyed by sub-field name (Manager sets `sort_order: 0` on untouched sort sub-fields).
- No publishing needed on dev — it renders the latest saved version (30 of 31 variants were never published). Publishing (`POST …/items/<z>/publishings {version, publishAt:"now", unpublishAt:"never"}`) goes live; don't, unless asked.
- **Screenshots:** the Manager requests a variant screenshot on save and stores its URL in `og_image`: `https://storage.googleapis.com/zesty-prod-instance-screenshots/<host>!-!block!<model>.html!variant=<7-zuid>&version=<n>&_bypassError=true&preview=global_1280_720.png`. The API never requests one. `blocks_catalog_page` reads variant ZUIDs only from that URL, so `zesty-variant.mjs` stamps it; the Manager overwrites it with a real screenshot on the first save there.
- `/-/gql/<model>.json` returns every listed variant but no ZUID field; it does carry `meta_title`.

## Views

- `GET web/views` returns dev and live records (filter `status === "dev"`); single `GET web/views/<11-zuid>` returns the dev copy. `PUT {code}`; create `POST {filename, type, code}` — extension-less → `snippet`, else `ajax-json` (every `components/*.jsx` is ajax-json, i.e. a public endpoint).
- Delete exists (`DELETE web/views/<z>`) but is blocked by the classifier and is a Manager action anyway.
- A view's filename needs a **leading slash** (`/tractionrec/x.json`). Without it the API accepts it, reports it live, and every request 404s.
- `updateView` doesn't return the new version number. Read it back with `GET` before `publishView`, or you re-publish the old version.

## Generated Traction Rec files (`views/tractionrec/`)

- Written **only** by the sibling repo `../kroc-tractionrec-sync` (its `AGENTS.md` has the paths, row shape and rules). Gitignored here, so `zesty-sync` skips it. Never edit, push or create files there; change that service and re-run it.
- Shape: `<tier>.json`, `<tier>/<id>.json`, `<parentTier>/<id>/<childTier>.json` (plural tiers `program_categories`, `programs`, `courses`, `classes`). Salesforce fields sit at each row's root; nested `__r` fields are read in JS.
- Reading them in Parsley: `api.json.get` with a full URL, one level deep only. A dotted read crashes the page. See `AGENTS.md` §3, "Fetched JSON".

## Media in repeaters

- Repeater Media sub-fields store bare `3-…` ZUIDs that Parsley can't resolve in place. Resolve client-side: `GET /custom-endpoints/media.json?zuids=<csv>` → `data: [{zuid, url, url_sized, title}, …, null]`; unknown ZUIDs come back with `url: ""`; order isn't guaranteed → key by ZUID (`useKrocMediaUrls` in `components/cardgrid.jsx`).
