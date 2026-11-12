// Catalog core — shared by the catalog pages (Category > Program > Course >
// Class) AND by blocks elsewhere on the site. Loaded after cards.jsx (uses cx,
// Icon, krocFirstOf) and before the rest of the catalog:
//
//   catalog.jsx          this file: formatting helpers, CatalogIcon,
//                        CatalogHero, Breadcrumbs
//   catalogdata.jsx      Traction Rec data: /tractionrec/ files, row -> card
//                        adapters, availability, crumb trail
//   catalogcards.jsx     ProgramCard, ClassCard, ClassList, CourseRow
//   catalogsections.jsx  the Category / Program / Course listings
//   catalogdetail.jsx    CourseDetail, ClassDetail
//   classfinder.jsx      the tree-wide class finder on /categories-page/
//
// Split when the pages moved to Traction Rec data. The helpers below
// stayed here because other components call them by name: krocExternalUrl
// (11 blocks), krocMoney (membership tiers, day passes), krocPick + krocZuid
// (featured pages / volunteers) and krocIconFor (featured pages). Moving them
// would break those blocks, since Babel scripts share one global scope.
//
// What used to live here and is gone: the Zesty-field card mappers
// (krocClassToCard and friends) and the enrollment_status dropdown logic. The
// catalog no longer reads the Zesty fields that mirror Traction Rec.

// kroc-icon keys are content-authored, so map loosely onto the sprite and fall
// back to a neutral glyph rather than rendering nothing.
const KROC_ICON_MAP = {
  aquatics: "#i-water",
  swim: "#i-water",
  water: "#i-water",
  fitness: "#i-dumbbell",
  wellness: "#i-heart",
  health: "#i-heart",
  sports: "#i-ball",
  ball: "#i-ball",
  arts: "#i-palette",
  art: "#i-palette",
  music: "#i-music",
  dance: "#i-music",
  youth: "#i-users",
  family: "#i-users",
  seniors: "#i-users",
  camp: "#i-sun",
  summer: "#i-sun",
  education: "#i-book",
  tutoring: "#i-book",
  academy: "#i-trophy",
  events: "#i-cal",
  worship: "#i-heart",
  community: "#i-users"
};

const krocIconFor = (key) => {
  const k = String(key || "")
    .trim()
    .toLowerCase();
  if (!k) {
    return "#i-grid";
  }
  if (KROC_ICON_MAP[k]) {
    return KROC_ICON_MAP[k];
  }
  // allow "sports-rec", "youth_programs", "Arts & Crafts" -> first known token
  const token = k.split(/[^a-z0-9]+/).find((t) => KROC_ICON_MAP[t]);
  return token ? KROC_ICON_MAP[token] : "#i-grid";
};

// First non-empty string among candidates — tolerates a field ref differing
// from the assumed one without breaking the card.
const krocPick = (obj, keys) => {
  for (const k of keys) {
    const v = obj && obj[k];
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  return "";
};

// toJson() does NOT expose a top-level zuid — it lives under meta.
const krocZuid = (item) => (item && item.meta && item.meta.zuid) || "";

// Icon chip: the uploaded program/category icon when there is one, otherwise a
// sprite glyph inferred from the name so a card is never iconless.
function CatalogIcon(props) {
  const size = props.size || "h-7 w-7";
  if (props.url) {
    return <img src={props.url} alt="" className={cx(size, "object-contain")} />;
  }
  return <Icon className={size} id={krocIconFor(props.name)} />;
}

/* ---------------------------------------------------------------------------
   Formatting helpers — days, dates, money, text, URLs, times.
--------------------------------------------------------------------------- */

const KROC_DAYS = [
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" }
];

// Day names arrive in several spellings ("Mon" / "Monday" / "monday"), so
// match on the first three letters. Used to order Traction Rec's multipicklist.
const krocDayIndex = (v) => {
  const k = String(v || "")
    .trim()
    .slice(0, 3)
    .toLowerCase();
  return KROC_DAYS.findIndex((d) => d.key === k);
};

// Course-level Age Range / Facility Location are not stored — they roll up from
// the child Classes. One distinct value renders as-is; several join with " · ".
const krocRollUp = (items, key) => {
  const seen = items.map((x) => x[key]).filter(Boolean);
  return seen.filter((v, i) => seen.indexOf(v) === i).join(" · ");
};

// Zesty date fields arrive as "2026-07-31" or "2026-07-31 00:00:00". Parsing
// the bare form with Date() treats it as UTC and can shift a day backwards, so
// build the date from its parts instead.
const krocParseDate = (s) => {
  const parts = String(s || "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3) {
    return null;
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return isNaN(d.getTime()) ? null : d;
};

const krocShortDate = (d, withYear) => {
  const opts = withYear
    ? { month: "short", day: "numeric", year: "numeric" }
    : { month: "short", day: "numeric" };
  return d.toLocaleDateString("en-US", opts);
};

// "Jul 31 – Sep 18, 2026" — the year is printed once when both ends share it.
const krocDateRange = (start, end) => {
  const a = krocParseDate(start);
  const b = krocParseDate(end);
  if (a && b) {
    const sameYear = a.getFullYear() === b.getFullYear();
    return krocShortDate(a, !sameYear) + " – " + krocShortDate(b, true);
  }
  if (a) {
    return "Starts " + krocShortDate(a, true);
  }
  if (b) {
    return "Through " + krocShortDate(b, true);
  }
  return "";
};

// Currency fields arrive as "85.00" / 85 / "". Whole dollars drop the cents,
// and a priced-at-zero class reads as Free rather than "$0".
const krocMoney = (v) => {
  if (v === null || v === undefined || v === "") {
    return "";
  }
  const n = Number(v);
  if (isNaN(n)) {
    return String(v).trim();
  }
  if (n === 0) {
    return "Free";
  }
  // "$1,092", "$46", "$12.50"
  const digits = n % 1 === 0 ? 0 : 2;
  return (
    "$" +
    n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
  );
};

// Dropdown values are stored lowercase on this instance ("roster", "open"), so
// title-case them for display. Already-cased values pass through unchanged.
const krocLabelCase = (v) =>
  String(v || "")
    .trim()
    .replace(/(^|[\s\-/])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());

// Visible text of a WYSIWYG value — used to decide whether a field is actually
// empty, how long its copy is, and what the finder searches. Editors leave
// &nbsp; behind when copy is deleted, so it counts as whitespace, not content.
const krocPlainText = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const krocTextLength = (html) => krocPlainText(html).length;

// Content URLs are often entered without a scheme, which makes the browser
// resolve them against the site (AGENTS.md §6). Only promote values that look
// like a host — a bare word stays relative, since that may well be intended.
const krocExternalUrl = (v) => {
  const s = String(v || "").trim();
  if (!s || /^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("/") || s.startsWith("#")) {
    return s;
  }
  return /^[^\s/]+\.[a-z]{2,}(\/|$)/i.test(s) ? "https://" + s : s;
};

// "6:00 – 7:00 PM" / "9:00-10:00 AM" / "5:45 PM – 6:30 PM" -> 24h start+end.
// `time` is free text, so anything that isn't a clear range returns null and
// the caller hides whatever depended on it rather than guessing.
const KROC_TIME_RANGE =
  /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i;
const KROC_TIME_RANGE_TAIL =
  /(\d{1,2})(?::(\d{2}))?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i;

const krocParseTimeRange = (time) => {
  const s = String(time || "");
  const to24 = (h, mer) => (Number(h) % 12) + (String(mer).toLowerCase() === "p" ? 12 : 0);
  let m = s.match(KROC_TIME_RANGE);
  if (m) {
    return {
      start: { h: to24(m[1], m[3]), m: Number(m[2] || 0) },
      end: { h: to24(m[4], m[6]), m: Number(m[5] || 0) }
    };
  }
  // only the end carries the meridiem — the start inherits it
  m = s.match(KROC_TIME_RANGE_TAIL);
  if (m) {
    return {
      start: { h: to24(m[1], m[5]), m: Number(m[2] || 0) },
      end: { h: to24(m[3], m[5]), m: Number(m[4] || 0) }
    };
  }
  return "";
};

// Google Calendar template link for a weekly class. Needs a start date and a
// parseable time range; the date range becomes the recurrence UNTIL.
const krocCalendarUrl = (c) => {
  const start = krocParseDate(c.startDate);
  const range = start && krocParseTimeRange(c.time);
  if (!range) {
    return "";
  }
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const day = (d) => "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  const stamp = (d, hm) => day(d) + "T" + pad(hm.h) + pad(hm.m) + "00";
  const end = krocParseDate(c.endDate);
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", c.title || "Class");
  params.set("dates", stamp(start, range.start) + "/" + stamp(start, range.end));
  if (c.location) {
    params.set("location", c.location);
  }
  if (end && end.getTime() > start.getTime()) {
    params.set("recur", "RRULE:FREQ=WEEKLY;UNTIL=" + day(end) + "T235959");
  }
  return "https://calendar.google.com/calendar/render?" + params.toString();
};

// Catalog hero shared by Category / Program / Course detail: optional kroc-icon
// chip, H1, and a subtitle, over a photo with a navy scrim.
function CatalogHero(props) {
  const d = props.data || {};
  return (
    <div className="relative flex min-h-[320px] items-end overflow-hidden rounded-card bg-secondary px-6 py-10 sm:px-12">
      {d.heroDesktop && (
        <picture>
          {d.heroMobile && <source media="(max-width: 640px)" srcSet={d.heroMobile} />}
          <img src={d.heroDesktop} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </picture>
      )}
      <div className="absolute inset-0 bg-[rgba(2,32,86,0.55)]"></div>
      <div className="relative z-10 max-w-[640px]">
        {(d.iconUrl || d.icon) && (
          <span className="mb-3.5 inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/15 text-white">
            <CatalogIcon url={d.iconUrl} name={d.icon || d.title} size="h-6 w-6" />
          </span>
        )}
        {d.eyebrow && (
          <div className="mb-2.5 text-[12px] uppercase tracking-[0.14em] text-white/70">
            {d.eyebrow}
          </div>
        )}
        <h1 className="mb-3 text-heading-md text-content-ondark lg:text-heading-lg">{d.title}</h1>
        {d.subtitle && <p className="text-[17px] text-white/85">{d.subtitle}</p>}
      </div>
    </div>
  );
}

// Trail of links ending in the current page. items = [{ label, url }].
function Breadcrumbs(props) {
  const items = [].concat(props.items || []).filter(Boolean);
  if (!items.length) {
    return null;
  }
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[13px]">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={c.label + i}>
            {i > 0 && <Icon className="h-3.5 w-3.5 -rotate-90 text-content-muted" id="#i-chev" />}
            {last || !c.url ? (
              <span className="text-content-muted">{c.label}</span>
            ) : (
              <a href={c.url} className="text-brand-link hover:underline">
                {c.label}
              </a>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
