// Traction Rec data for the catalog pages (Category > Program > Course > Class).
// Loaded after catalog.jsx (uses krocDateRange, krocMoney, krocExternalUrl,
// krocDayIndex, KROC_DAYS, Breadcrumbs).
//
// Source: the tr_* Zesty datasets kroc-tractionrec-sync's dataset sync fills
// (that repo's docs/dataset-storage.md). Each page view prints the rows it
// needs into its own script — see "tr_* datasets" below — so nothing is
// fetched. (Before that the pages read the /tractionrec/ JSON files the
// file sync still writes.)
//
// Ownership: any Zesty field that mirrors Traction Rec —
// names, course description, every class schedule/price/capacity field, the
// relational parent fields — is IGNORED. Only what Traction Rec has no source
// for still comes from Zesty: hero image, icon, subtitle, intro copy, class
// type, location and tags, and those only on a page's OWN item (`this.*`).
// Child cards therefore carry Traction Rec data only; every Zesty value they
// could show is still the seed template's placeholder.
//
// Spot counts (same decision): show the number whenever Traction Rec allows
// it and it means something — see krocDsAvailability.

const krocTrRows = (v) => [].concat(v || []).filter(Boolean);
const krocTrText = (v) => String(v === null || v === undefined ? "" : v).trim();

/* --- formatting Traction Rec values ---------------------------------------- */

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

/* --- ordering -------------------------------------------------------------- */

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

/* --- tr_* datasets --------------------------------------------------------- */

// The catalog pages read the tr_* Zesty datasets that kroc-tractionrec-sync's
// dataset sync fills (its docs/dataset-storage.md), not the /tractionrec/
// files. A page view prints the rows it needs into its own script, through the
// row snippets in views/datasets/ (class, course, program, category), so the
// data is in the HTML and nothing is fetched. Rows keep the Zesty field names;
// every value arrives as a string ("" for empty, "1"/"0" for yes/no); relations
// are ZUIDs; url is the row's Zesty page.
//
//   krocDs({ self: "<zuid>", categories: [...], programs: [...], courses: [...],
//            classes: [...] })
//
// Nested loops can print a row more than once, so each kind is de-duplicated
// by ZUID. Rows are ordered by name, then Traction Rec Id — the order the
// /tractionrec/ children files had — since a dataset loop returns item order.
const krocDsOrder = (a, b) =>
  krocTrText(a.name).toLowerCase().localeCompare(krocTrText(b.name).toLowerCase()) ||
  krocTrText(a.tractionrec_id).localeCompare(krocTrText(b.tractionrec_id));

const krocDs = (bundle) => {
  const b = bundle || {};
  const ds = { byZuid: {} };
  ["categories", "programs", "courses", "classes"].forEach((kind) => {
    const seen = {};
    ds[kind] = krocTrRows(b[kind])
      .filter((row) => {
        if (!row.zuid || seen[row.zuid]) {
          return false;
        }
        seen[row.zuid] = true;
        ds.byZuid[row.zuid] = row;
        return true;
      })
      .sort(krocDsOrder);
  });
  ds.self = ds.byZuid[krocTrText(b.self)] || null;
  return ds;
};

const krocDsYes = (v) => v === true || v === 1 || v === "1";
// A row is active unless the sync marked it otherwise (the active field).
const krocDsActive = (row) => !row || row.active === undefined || krocDsYes(row.active);
const krocDsNumber = (v) => {
  const t = krocTrText(v);
  return t === "" || isNaN(Number(t)) ? null : Number(t);
};
const krocDsIds = (csv) =>
  krocTrText(csv)
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean);

// A program's categories (the one_to_many); the first is its home for crumbs.
const krocDsCategoryOf = (program, ds) =>
  krocDsIds(program && program.program_categories)
    .map((z) => ds.byZuid[z])
    .filter(Boolean)[0] || null;

// Member / Non-Member pair on class products; a lone untyped level is a single
// price, and a Day Pass-style level keeps its price in initial_fee.
const krocDsPrices = (prices) => {
  const rows = krocTrRows(prices);
  const amount = (p) => (krocTrText(p.amount) !== "" ? p.amount : p.initial_fee);
  const member = rows.find((p) => p.price_type === "Member");
  const pub = rows.find((p) => p.price_type === "Non-Member");
  const single = !member && !pub && rows.length ? rows[0] : null;
  return {
    memberPrice: member ? krocMoney(amount(member)) : "",
    publicPrice: pub ? krocMoney(amount(pub)) : "",
    price: single ? krocMoney(amount(single)) : ""
  };
};

// Availability pill + whether registration is open, from Traction Rec's own
// flags. The count is shown whenever TR allows it (show_capacity_online) and it
// is meaningful (a capped class with spots left); otherwise a state word.
// Counts are as fresh as the dataset sync's last run — the registration page
// has the final say after the hand-off.
const krocDsAvailability = (cls) => {
  const c = cls || {};
  // Inactive: Traction Rec no longer publishes it — its
  // registration window closed, it was set Not Available, or it was removed.
  // The page stays and says so; listings never show it (views filter on
  // active, and krocDsActive above).
  if (!krocDsActive(c)) {
    return { isOpen: false, spots: null, availability: "Registration closed", enrollLabel: "" };
  }
  if (!krocDsYes(c.available_online) || !krocDsYes(c.option_available)) {
    return { isOpen: false, spots: null, availability: "Not available online", enrollLabel: "" };
  }
  if (krocDsYes(c.unlimited_capacity)) {
    return { isOpen: true, spots: null, availability: "Open", enrollLabel: "Enroll" };
  }
  const left = krocDsNumber(c.capacity_available);
  if (left === null) {
    return { isOpen: true, spots: null, availability: "", enrollLabel: "Enroll" };
  }
  if (left > 0) {
    return {
      isOpen: true,
      spots: left,
      availability: krocDsYes(c.show_capacity_online)
        ? left + (left === 1 ? " spot remaining" : " spots remaining")
        : "Open",
      enrollLabel: "Enroll"
    };
  }
  const waitRoom = (krocDsNumber(c.waitlist_capacity) || 0) - (krocDsNumber(c.waitlist_total) || 0);
  if (waitRoom > 0) {
    return { isOpen: true, spots: 0, availability: "Waitlist open", enrollLabel: "Join Waitlist" };
  }
  return { isOpen: false, spots: 0, availability: "Full", enrollLabel: "" };
};

// Courses whose classes get no page (hide_class_pages): tr_courses ZUID -> the
// course page's URL (working group decision: swim lessons list every time on the
// course page). A class under one of these links to its course instead
// (krocDsClassToCard) and its own page redirects there (ClassGate). Read on
// every request — components are served no-cache — so the toggle needs no sync
// run. The matching tr_courses row comes from filter() on its page relation;
// the alias is lowercase on purpose — inside filter(), an alias with capitals
// (hiddenCourse) does not interpolate and the lookup comes back empty.
const KROC_DS_HIDDEN_CLASS_PAGES = Object.fromEntries(
  [
    {{each courses as hidden where hidden.hide_class_pages = 1}}
    ["{{tr_courses.filter(page = '{hidden.zuid}').zuid}}", "{{hidden.getUrl()}}".trim()],
    {{end-each}}
    null
  ].filter((r) => r && r[0] && r[1])
);

const krocDsClassGate = (cls) => KROC_DS_HIDDEN_CLASS_PAGES[krocTrText(cls && cls.course)] || "";

const krocDsLink = (row) => (row ? { label: krocTrText(row.name), url: row.url || "" } : null);

// ProgramCard props.card (categories share the card face)
const krocDsCategoryToCard = (row) => ({
  id: krocTrText(row && row.zuid),
  zuid: krocTrText(row && row.zuid),
  title: krocTrText(row && row.name),
  summary: "",
  iconUrl: "",
  url: (row && row.url) || ""
});

const krocDsProgramToCard = (row) => {
  const card = krocDsCategoryToCard(row);
  card.summary = krocPlainText(row && row.description);
  return card;
};

// CourseRow props.course
const krocDsCourseToCard = (row) => ({
  id: krocTrText(row && row.zuid),
  zuid: krocTrText(row && row.zuid),
  programId: krocTrText(row && row.program),
  title: krocTrText(row && row.name),
  subtitle: "",
  description: krocTrCleanHtml((row && (row.rich_description || row.description)) || ""),
  url: (row && row.url) || ""
});

// ClassCard props.item
const krocDsClassToCard = (row) => {
  const r = row || {};
  const days = krocTrDays(r.day_of_week);
  return Object.assign(
    {
      id: krocTrText(r.zuid),
      zuid: krocTrText(r.zuid),
      courseId: krocTrText(r.course),
      title: krocTrText(r.name),
      kind: "",
      day: days.label,
      dayPlural: days.plural,
      dayRank: days.rank,
      time: krocTrTime(r.start_time, r.end_time),
      startMinutes: krocTrMinutes(r.start_time),
      dates: krocDateRange(r.start_date, r.end_date),
      startDate: krocTrText(r.start_date),
      endDate: krocTrText(r.end_date),
      season: krocTrText(r.season),
      ages: krocTrAges(krocDsNumber(r.age_min), krocDsNumber(r.age_max)),
      instructor: krocTrText(r.instructor),
      location: "",
      desc: krocTrCleanHtml(r.description),
      enrollUrl: krocExternalUrl(r.deep_link_url),
      image: "",
      url: krocDsClassGate(r) || r.url || ""
    },
    krocDsPrices(r.prices),
    krocDsAvailability(r)
  );
};

// A course's active classes, as cards in calendar order.
const krocDsClassesOf = (ds, courseZuid) =>
  krocTrSortClasses(
    ds.classes.filter((c) => c.course === courseZuid && krocDsActive(c)).map(krocDsClassToCard)
  );

// The crumb trail above the page's own row, nearest last, from rows the page
// printed: [category, program, course]. No request.
const krocDsTrail = (kind, ds) => {
  const self = ds && ds.self;
  if (!self) {
    return [];
  }
  const links = (rows) => rows.map(krocDsLink).filter((l) => l && l.label);
  if (kind === "program") {
    return links([krocDsCategoryOf(self, ds)]);
  }
  if (kind === "course") {
    const program = ds.byZuid[self.program];
    return links([krocDsCategoryOf(program, ds), program]);
  }
  if (kind === "class") {
    const course = ds.byZuid[self.course];
    const program = course ? ds.byZuid[course.program] : null;
    return links([krocDsCategoryOf(program, ds), program, course]);
  }
  return [];
};

/* --- parents (crumbs) ----------------------------------------------------- */

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
// props.trail is the parents, nearest last (krocDsTrail): the page printed
// their rows, so the trail is complete on first render — no lookup, no flash
// of a wrong parent on mobile.
function CatalogCrumbs(props) {
  const trail = { items: [].concat(props.trail || []).filter(Boolean) };

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
      <a
        href={back.url || undefined}
        className="inline-flex items-center gap-1.5 text-[13.5px] text-brand-red-300 lg:hidden"
      >
        <Icon className="h-3.5 w-3.5 flex-none rotate-90" id="#i-chev" />
        {back.label}
      </a>
    </React.Fragment>
  );
}
