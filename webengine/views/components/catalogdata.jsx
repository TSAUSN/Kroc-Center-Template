// Traction Rec data for the catalog pages (Category > Program > Course > Class).
// Loaded after catalog.jsx (uses krocDateRange, krocMoney, krocExternalUrl,
// krocDayIndex, KROC_DAYS, Breadcrumbs).
//
// Source: the files kroc-tractionrec-sync publishes under /tractionrec/ — see
// ../kroc-tractionrec-sync/AGENTS.md for the full contract:
//
//   /tractionrec/<tier>.json                       every row of a tier
//   /tractionrec/<tier>/<id>.json                  one row
//   /tractionrec/<parentTier>/<id>/<childTier>.json that parent's children
//
// Tiers: program_categories, programs, courses, classes. Each row is the
// Salesforce record, field names untouched, plus `meta` (zestyItemZuid, and
// zestyPath — the URL of the Zesty page that row belongs to).
//
// Ownership (Japheth, 2026-10-05): any Zesty field that mirrors Traction Rec —
// names, course description, every class schedule/price/capacity field, the
// relational parent fields — is IGNORED. Only what Traction Rec has no source
// for still comes from Zesty: hero image, icon, subtitle, intro copy, class
// type, location and tags, and those only on a page's OWN item (`this.*`).
// Child cards therefore carry Traction Rec data only; every Zesty value they
// could show is still the seed template's placeholder (checked 2026-10-05).
//
// Spot counts (same decision): show the number whenever Traction Rec allows
// it and it means something — see krocTrAvailability.

const KROC_TR_ROOT = "/tractionrec";
const KROC_TR_OPT = "TREX1__Course_Option__r";

// One request per path per page view, shared by every component that asks.
const krocTrRequests = {};
const krocTrGet = (path) => {
  if (!krocTrRequests[path]) {
    krocTrRequests[path] = fetch(KROC_TR_ROOT + path)
      .then((r) => {
        if (!r.ok) {
          throw new Error("HTTP " + r.status + " " + path);
        }
        return r.json();
      })
      .catch((err) => {
        delete krocTrRequests[path];
        throw err;
      });
  }
  return krocTrRequests[path];
};

// A page view inlines its own row and its children at render time:
//   <script type="application/json" id="kroc-tr-self">  + Parsley include
// The loader leaves application/json scripts alone, so the JSON is still in the
// DOM when the page script runs. A missing file includes as nothing -> null.
const krocTrInline = (id) => {
  const el = document.getElementById(id);
  const text = el ? el.textContent.trim() : "";
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("KROC: inline Traction Rec data #" + id + " is not JSON", err);
    return null;
  }
};

const krocTrRows = (v) => [].concat(v || []).filter(Boolean);
const krocTrMeta = (row) => (row && row.meta) || {};
const krocTrOpt = (row) => (row && row[KROC_TR_OPT]) || {};
const krocTrText = (v) => String(v === null || v === undefined ? "" : v).trim();

// A class's parent Course is nested under its Course Session.
const krocTrCourseId = (cls) =>
  krocTrText(((cls && cls.TREX1__cso_Course_Session__r) || {}).TREX1__Course__c);

// A program's categories are an array (many-to-many); the first is its home
// for crumbs. No program is in more than one category today.
const krocTrCategoryIds = (program) => krocTrRows(program && program.TREX1__Program_Category__c);

/* --- formatting raw Salesforce values ------------------------------------ */

// Rich text from Salesforce carries inline colours and fonts (course copy has
// red and blue runs). Keep the structure, drop the styling and anything active.
const krocTrCleanHtml = (html) => {
  const s = krocTrText(html);
  if (!s || typeof DOMParser === "undefined") {
    return s;
  }
  const doc = new DOMParser().parseFromString("<div>" + s + "</div>", "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,form").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((n) => {
    [].slice.call(n.attributes).forEach((a) => {
      const name = a.name.toLowerCase();
      const unsafeHref = name === "href" && /^\s*javascript:/i.test(a.value);
      if (name === "style" || name === "class" || name.indexOf("on") === 0 || unsafeHref) {
        n.removeAttribute(a.name);
      }
    });
  });
  const root = doc.body.firstChild;
  return root ? root.innerHTML : "";
};

// "19:00:00.000" -> { h: 19, m: 0 }
const krocTrClock = (v) => {
  const parts = krocTrText(v).split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  return parts[0] && !isNaN(h) && !isNaN(m) ? { h: h, m: m } : null;
};

const krocTrMinutes = (v) => {
  const t = krocTrClock(v);
  return t ? t.h * 60 + t.m : 9999;
};

// "7:00 – 8:00 PM", or "11:30 AM – 12:15 PM" across noon. Written in the shape
// krocParseTimeRange reads, so Add to Calendar keeps working.
const krocTrTime = (start, end) => {
  const a = krocTrClock(start);
  const b = krocTrClock(end);
  const fmt = (t) => (t.h % 12 || 12) + ":" + (t.m < 10 ? "0" : "") + t.m;
  const mer = (t) => (t.h < 12 ? "AM" : "PM");
  if (a && b) {
    return mer(a) === mer(b)
      ? fmt(a) + " – " + fmt(b) + " " + mer(b)
      : fmt(a) + " " + mer(a) + " – " + fmt(b) + " " + mer(b);
  }
  return a ? fmt(a) + " " + mer(a) : "";
};

// TREX1__Day_of_Week__c is a multipicklist ("Monday;Wednesday"), and 65% of
// options meet on more than one day. A class is banded once, under all its
// days ("Monday & Wednesday"), never duplicated into two bands.
const krocTrDays = (value) => {
  const tokens = krocTrText(value)
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
  const known = tokens
    .map((t) => krocDayIndex(t))
    .filter((i, n, all) => i >= 0 && all.indexOf(i) === n)
    .sort((a, b) => a - b);
  if (!known.length) {
    return { label: tokens.join(", "), plural: tokens.join(", "), rank: 99 };
  }
  const full = known.map((i) => KROC_DAYS[i].label);
  const short = known.map((i) => KROC_DAYS[i].label.slice(0, 3));
  const join = (list) =>
    list.length > 1 ? list.slice(0, -1).join(", ") + " & " + list[list.length - 1] : list[0];
  return {
    label: known.length > 2 ? join(short) : join(full),
    plural: known.length > 2 ? join(short) : join(full.map((d) => d + "s")),
    rank: known[0] * 10 + known.length
  };
};

const krocTrAges = (min, max) => {
  const lo = min === null || min === undefined || min === "" ? null : Number(min);
  const hi = max === null || max === undefined || max === "" ? null : Number(max);
  if (lo !== null && hi !== null) {
    return lo === hi ? "Age " + lo : "Ages " + lo + "–" + hi;
  }
  if (lo !== null) {
    return "Ages " + lo + "+";
  }
  if (hi !== null) {
    return "Up to age " + hi;
  }
  return "";
};

// Price levels attached by the sync: Member / Non-Member pair cleanly on class
// products; a lone untyped level is a single price. Day Pass-style products
// keep their price in initialFee, so fall back to it.
const krocTrPrices = (prices) => {
  const rows = krocTrRows(prices);
  const amount = (p) => (p.amount !== null && p.amount !== undefined ? p.amount : p.initialFee);
  const member = rows.find((p) => p.priceType === "Member");
  const pub = rows.find((p) => p.priceType === "Non-Member");
  const single = !member && !pub && rows.length ? rows[0] : null;
  return {
    memberPrice: member ? krocMoney(amount(member)) : "",
    publicPrice: pub ? krocMoney(amount(pub)) : "",
    price: single ? krocMoney(amount(single)) : ""
  };
};

// Availability pill + whether registration is open, from Traction Rec's own
// flags. The count is shown whenever TR allows it (Show_Capacity_Online) and
// it is meaningful (a capped class with spots left); otherwise a state word.
// Counts are as fresh as the sync's last run — the registration page has the
// final say after the hand-off.
const krocTrAvailability = (cls) => {
  const o = krocTrOpt(cls);
  if (
    cls &&
    (cls.TREX1__Available_Online__c === false || cls.TREX1__Option_Available__c === false)
  ) {
    return { isOpen: false, spots: null, availability: "Not available online", enrollLabel: "" };
  }
  if (o.TREX1__Unlimited_Capacity__c) {
    return { isOpen: true, spots: null, availability: "Open", enrollLabel: "Enroll" };
  }
  const raw = o.TREX1__Total_Capacity_Available__c;
  const left = Number(raw);
  if (raw === null || raw === undefined || raw === "" || isNaN(left)) {
    return { isOpen: true, spots: null, availability: "", enrollLabel: "Enroll" };
  }
  if (left > 0) {
    return {
      isOpen: true,
      spots: left,
      availability:
        o.TREX1__Show_Capacity_Online__c === false
          ? "Open"
          : left + (left === 1 ? " spot remaining" : " spots remaining"),
      enrollLabel: "Enroll"
    };
  }
  const waitRoom =
    (Number(o.TREX1__Waitlist_Capacity__c) || 0) - (Number(o.TREX1__Waitlist_Total__c) || 0);
  if (waitRoom > 0) {
    return { isOpen: true, spots: 0, availability: "Waitlist open", enrollLabel: "Join Waitlist" };
  }
  return { isOpen: false, spots: 0, availability: "Full", enrollLabel: "" };
};

/* --- class pages a course hides ------------------------------------------- */

// Courses whose classes get no page of their own — the course field
// hide_class_pages (10-02 working group: swim lessons list every time on the
// course page). Traction Rec course Id -> that course page's URL. A class
// under one of these links to its course instead (krocTrClassToCard), and its
// own page redirects there (ClassGate). Read from Zesty on every request —
// components are served no-cache — so the toggle needs no sync run.
const KROC_HIDDEN_CLASS_PAGES = Object.fromEntries(
  [
    {{each courses as c where c.hide_class_pages = 1}}
    ["{{!c.tractionrec_id}}".trim(), "{{c.getUrl()}}".trim()]
    {{c._arraycomma}}
    {{end-each}}
  ].filter((r) => r[0] && r[1])
);

// The course page a class's own page gives way to, or "" when it keeps it.
const krocTrClassGate = (cls) => KROC_HIDDEN_CLASS_PAGES[krocTrCourseId(cls)] || "";

/* --- rows -> card props --------------------------------------------------- */

const krocTrLink = (row) =>
  row ? { label: krocTrText(row.Name), url: krocTrMeta(row).zestyPath || "" } : null;

// ProgramCard props.card (also used for categories — same card face)
const krocTrCategoryToCard = (row) => ({
  id: krocTrText(row && row.Id),
  zuid: krocTrMeta(row).zestyItemZuid || "",
  title: krocTrText(row && row.Name),
  summary: "",
  iconUrl: "",
  url: krocTrMeta(row).zestyPath || ""
});

const krocTrProgramToCard = (row) => {
  const card = krocTrCategoryToCard(row);
  card.summary = krocPlainText(row && row.TREX1__Description__c);
  return card;
};

// CourseRow props.course
const krocTrCourseToCard = (row) => ({
  id: krocTrText(row && row.Id),
  zuid: krocTrMeta(row).zestyItemZuid || "",
  programId: krocTrText(row && row.TREX1__Program__c),
  title: krocTrText(row && row.Name),
  subtitle: "",
  description: krocTrCleanHtml(
    (row && (row.TREX1__Rich_Description__c || row.TREX1__Description__c)) || ""
  ),
  url: krocTrMeta(row).zestyPath || ""
});

// ClassCard props.item
const krocTrClassToCard = (row) => {
  const r = row || {};
  const o = krocTrOpt(r);
  const days = krocTrDays(o.TREX1__Day_of_Week__c);
  const session = (r.TREX1__cso_Course_Session__r || {}).TREX1__Session__r || {};
  return Object.assign(
    {
      id: krocTrText(r.Id),
      zuid: krocTrMeta(r).zestyItemZuid || "",
      courseId: krocTrCourseId(r),
      title: krocTrText(o.Name),
      kind: "",
      day: days.label,
      dayPlural: days.plural,
      dayRank: days.rank,
      time: krocTrTime(o.TREX1__Start_Time_Formula__c, o.TREX1__End_Time_Formula__c),
      startMinutes: krocTrMinutes(o.TREX1__Start_Time_Formula__c),
      dates: krocDateRange(o.TREX1__Start_Date__c, o.TREX1__End_Date__c),
      startDate: krocTrText(o.TREX1__Start_Date__c),
      endDate: krocTrText(o.TREX1__End_Date__c),
      season: krocTrText(session.Name),
      ages: krocTrAges(o.TREX1__Age_Min__c, o.TREX1__Age_Max__c),
      instructor: krocTrText(o.TREX1__Instructor__c),
      location: "",
      desc: krocTrCleanHtml(o.TREX1__Description__c),
      enrollUrl: krocExternalUrl(r.Deep_Link_URL__c),
      image: "",
      url: krocTrClassGate(r) || krocTrMeta(r).zestyPath || ""
    },
    krocTrPrices(r.prices),
    krocTrAvailability(r)
  );
};

// Calendar order: day band, then start date, then start time, then name.
const krocTrSortClasses = (cards) =>
  cards
    .slice()
    .sort(
      (a, b) =>
        a.dayRank - b.dayRank ||
        String(a.startDate).localeCompare(String(b.startDate)) ||
        a.startMinutes - b.startMinutes ||
        a.title.localeCompare(b.title)
    );

/* --- parents (crumbs) ----------------------------------------------------- */

// The trail above a row, nearest last: [category, program, course]. Parent ids
// sit inside the Traction Rec data, which Parsley can't put in an include path,
// so they are looked up here — one small record file per level.
const krocTrTrail = (kind, self) => {
  const one = (tier, id) =>
    id ? krocTrGet("/" + tier + "/" + id + ".json").catch(() => null) : Promise.resolve(null);
  const categoryOf = (program) => one("program_categories", krocTrCategoryIds(program)[0]);
  const links = (rows) => rows.map(krocTrLink).filter((l) => l && l.label);
  if (!self) {
    return Promise.resolve([]);
  }
  if (kind === "program") {
    return categoryOf(self).then((c) => links([c]));
  }
  if (kind === "course") {
    return one("programs", self.TREX1__Program__c).then((p) =>
      categoryOf(p).then((c) => links([c, p]))
    );
  }
  if (kind === "class") {
    return one("courses", krocTrCourseId(self)).then((co) =>
      one("programs", co && co.TREX1__Program__c).then((p) =>
        categoryOf(p).then((c) => links([c, p, co]))
      )
    );
  }
  return Promise.resolve([]);
};

// The catalog root (the [categories_page] item). Read from Zesty, so a path
// change in the Manager follows: it lives at /categories-page/, and the old
// hardcoded "/categories/" was a 404. The loop form is required — a direct
// categories_page.getUrl() call renders empty on this instance.
const KROC_CATALOG_ROOT = {
  label: "Programs",
  url: "{{each categories_page as cp}}{{cp.getUrl()}}{{end-each}}".trim()
};

// Breadcrumbs, as the two designs draw them:
//   desktop (prototype pages-catalog.jsx) — a trail. Category and Program
//     pages start at "Programs" (the catalog root); Course and Class pages
//     start at their category: "Aquatics > Adaptive Lessons > Adaptive Swim".
//   mobile (prototype mobile/m-pages-a.jsx) — one back link to the parent:
//     "‹ All Programs" on a category, "‹ Return to Aquatics" below it. The
//     mobile design only drew the old two-level catalog, so Program / Course /
//     Class extend the same rule one level each.
// Parents resolve from Traction Rec ids (krocTrTrail) and fill in as their
// records arrive; the mobile link waits for them rather than flashing a
// wrong parent.
function CatalogCrumbs(props) {
  const [trail, setTrail] = React.useState({ items: [], ready: props.kind === "category" });
  React.useEffect(() => {
    let live = true;
    krocTrTrail(props.kind, props.self)
      .then((t) => live && setTrail({ items: t, ready: true }))
      .catch((err) => {
        console.error("KROC: crumb lookup failed", err);
        if (live) {
          setTrail({ items: [], ready: true });
        }
      });
    return () => {
      live = false;
    };
  }, [props.kind, props.self]);

  const fromRoot = props.kind === "category" || props.kind === "program";
  const items = (fromRoot ? [KROC_CATALOG_ROOT] : [])
    .concat(trail.items)
    .concat([{ label: props.title }])
    .filter((x) => x && x.label);

  const parent = trail.items.length ? trail.items[trail.items.length - 1] : null;
  const back = parent
    ? { label: "Return to " + parent.label, url: parent.url }
    : { label: "All Programs", url: KROC_CATALOG_ROOT.url };

  return (
    <React.Fragment>
      <div className="hidden lg:block">
        <Breadcrumbs items={items} />
      </div>
      {trail.ready && (
        <a
          href={back.url || undefined}
          className="inline-flex items-center gap-1.5 text-[13.5px] text-brand-red-300 lg:hidden"
        >
          <Icon className="h-3.5 w-3.5 flex-none rotate-90" id="#i-chev" />
          {back.label}
        </a>
      )}
    </React.Fragment>
  );
}
