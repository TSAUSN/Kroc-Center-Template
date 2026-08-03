// Shared pieces for the v4 catalog: Category > Program > Course > Class.
// Loaded after cards.jsx (uses cx, Icon, Pagination, krocFirstOf).
//
// Field refs verified in the Manager 2026-07-30 (Parsley (** **) comments get
// stripped from synced JSON endpoints, so they are recorded here instead):
//   [categories]  category_name · category_icon (Media) · hero_image_desktop ·
//                 hero_subtitle · card_summary · intro_content · sort_order
//   [programs]    program_name · categories (one-to-one parent) ·
//                 program_icon (Media) · hero_image_desktop · hero_subtitle ·
//                 card_summary · intro_content · sort_order
//   [courses]     course_name · programs (one-to-one parent) ·
//                 hero_image_desktop · hero_subtitle · description (WYSIWYG) ·
//                 sort_order
//   [classes]     class_name · courses (one-to-one parent) · class_type ·
//                 day_of_week · time · class_start_date · class_end_date ·
//                 age_range · instructors · member_price · public_price ·
//                 price · hero_image_desktop · enrollment_status ·
//                 spots_remaining · facility_location · deep_link_url ·
//                 description (WYSIWYG) · tags (one-to-many)
// Both `description` fields are WYSIWYG, so they render through
// dangerouslySetInnerHTML and are tested for emptiness with krocTextLength —
// an "empty" WYSIWYG still ships <p></p> and would read as truthy.
// Gotchas: parent relations are PLURAL (`categories`, `programs`, `courses`);
// the icon fields are `category_icon` / `program_icon` — a bare `icon` resolves
// to the system field, which makes a loop `where` clause "unknown or ambiguous".
// No model here has hero_image_mobile or hero_image_thumbnail. A Course carries
// no Age Range / Facility Location of its own — both roll up from its Classes.

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

// { zuid, item: <program toJson()>, url, icon } -> ProgramCard props.card
// program_icon is a Media field, so the icon is an image URL — the endpoint
// resolves it; toJson() carries the same media under .data[0].url.
const krocProgramToCard = (row) => {
  const it = (row && row.item) || {};
  const iconMedia = krocFirstOf(it.program_icon);
  return {
    zuid: (row && row.zuid) || krocZuid(it),
    title: krocPick(it, ["program_name", "title", "name"]),
    summary: krocPick(it, ["card_summary", "hero_subtitle"]),
    iconUrl:
      (row && row.icon && row.icon.trim()) ||
      (iconMedia && iconMedia.url ? iconMedia.url + "?width=96" : ""),
    url: (row && row.url) || "#"
  };
};

// Icon chip: the uploaded program/category icon when there is one, otherwise a
// sprite glyph inferred from the name so a card is never iconless.
function CatalogIcon(props) {
  const size = props.size || "h-7 w-7";
  if (props.url) {
    return <img src={props.url} alt="" className={cx(size, "object-contain")} />;
  }
  return <Icon className={size} id={krocIconFor(props.name)} />;
}

// The prototype's CategoryCard face, reused for Programs: icon (or photo) +
// title + summary + a secondary CTA. Whole card is the link target.
function ProgramCard(props) {
  const c = props.card || {};
  const cta = props.ctaLabel || "View Program";
  return (
    <a
      href={c.url || "#"}
      className="group flex flex-col overflow-hidden rounded-card bg-surface transition hover:shadow-card"
    >
      <div className="flex flex-1 flex-col px-6 pb-6 pt-6">
        <span className="mb-4 inline-flex h-14 w-14 flex-none items-center justify-center rounded-[14px] bg-primary-subtle text-primary">
          <CatalogIcon url={c.iconUrl} name={c.title} />
        </span>
        <h3 className="mb-2 text-[20px] leading-[1.3] text-content">{c.title}</h3>
        {c.summary && (
          <p className="line-clamp-3 text-[13.5px] leading-[1.55] text-content-muted">
            {c.summary}
          </p>
        )}
        <span className="btn btn-secondary btn-sm mt-5 self-start">{cta}</span>
      </div>
    </a>
  );
}

// Programs listing on the Category detail page: server-side search + numbered
// pagination against /custom-endpoints/programs.json. `data.categoryZuid`
// scopes the feed to the current category.
function ProgramsSection(props) {
  const d = props.data || {};
  const PAGE_SIZE = d.pageSize || 9;
  const heading = d.heading || "Programs";

  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [cards, setCards] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const topRef = React.useRef(null);

  const load = (nextPage, query) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("start", (nextPage - 1) * PAGE_SIZE);
    params.set("limit", PAGE_SIZE);
    if (query) {
      params.set("q", query);
    }
    if (d.categoryZuid) {
      params.set("category", d.categoryZuid);
    }
    fetch("/custom-endpoints/programs.json?" + params.toString())
      .then((r) => r.json())
      .then((json) => {
        const rows = []
          .concat((json && json.data) || [])
          .filter(Boolean)
          .map(krocProgramToCard);
        const ids = [].concat((json && json.total) || []).filter(Boolean);
        setCards(rows);
        setTotal(ids.length);
        setFailed(false);
        setLoading(false);
      })
      .catch((err) => {
        console.error("KROC: programs feed failed", err);
        setFailed(true);
        setLoading(false);
      });
  };

  // debounce typing; a search always returns to page 1
  React.useEffect(() => {
    const t = setTimeout(() => load(1, q), q ? 300 : 0);
    setPage(1);
    return () => clearTimeout(t);
  }, [q]);

  // guard against a narrowed result set leaving `page` past the last page
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const goPage = (p) => {
    setPage(p);
    load(p, q);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  let body = null;
  if (cards.length > 0) {
    body = (
      <div
        className={cx(
          "grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3",
          loading && "opacity-60"
        )}
      >
        {cards.map((c) => (
          <ProgramCard key={c.zuid || c.title} card={c} ctaLabel={d.ctaLabel} />
        ))}
      </div>
    );
  } else {
    let msg = "No programs match your search.";
    if (loading) {
      msg = "Loading programs…";
    } else if (failed) {
      msg = "Programs couldn’t be loaded right now.";
    }
    body = (
      <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">{msg}</div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading-md text-content">{heading}</h2>
        <div className="relative w-full sm:w-60">
          <Icon
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted"
            id="#i-search"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={d.searchPlaceholder || "Search programs"}
            className="w-full rounded-input bg-surface py-2.5 pl-10 pr-4 text-[14px] text-content placeholder:text-content-muted focus:outline-none"
          />
        </div>
      </div>

      {body}

      {pageCount > 1 && (
        <div className="mt-10 flex justify-center">
          <Pagination page={current} pageCount={pageCount} onPage={goPage} />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Courses & Classes — the Program detail listing.

   Decision B (v4): a Course's Classes always render grouped by DAY OF WEEK
   (navy day bands). No 5th content type, no Course Session/Term field — the
   class date range already says which run it is.
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

// day_of_week is an author-facing dropdown ("Mon" / "Monday" / "monday" all
// plausible), so match on the first three letters and keep anything unknown as
// its own trailing band rather than dropping the class.
const krocDayIndex = (v) => {
  const k = String(v || "")
    .trim()
    .slice(0, 3)
    .toLowerCase();
  return KROC_DAYS.findIndex((d) => d.key === k);
};

const krocDayLabel = (v) => {
  const i = krocDayIndex(v);
  if (i >= 0) {
    return KROC_DAYS[i].label;
  }
  return String(v || "").trim() || "Schedule";
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
  return "$" + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2));
};

// enrollment_status is an author-facing dropdown, so read it by keyword rather
// than by an exact option value; anything unrecognised counts as open.
const krocStatusOpen = (status) => {
  const s = String(status || "").toLowerCase();
  if (!s) {
    return true;
  }
  return !/clos|full|waitlist|cancel|sold/.test(s);
};

const krocClassOpen = (c) => {
  const n = Number(c.spots);
  if (c.spots !== "" && c.spots !== null && c.spots !== undefined && !isNaN(n) && n <= 0) {
    return false;
  }
  return krocStatusOpen(c.status);
};

// Availability pill copy: a spot count beats the dropdown label when present.
const krocAvailability = (c) => {
  const n = Number(c.spots);
  if (c.spots !== "" && c.spots !== null && c.spots !== undefined && !isNaN(n)) {
    if (n > 0) {
      return n + (n === 1 ? " spot remaining" : " spots remaining");
    }
    return "No spots remaining";
  }
  return String(c.status || "").trim();
};

// Dropdown values are stored lowercase on this instance ("roster", "open"), so
// title-case them for display. Already-cased values pass through unchanged.
const krocLabelCase = (v) =>
  String(v || "")
    .trim()
    .replace(/(^|[\s\-/])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());

// Visible text length of a WYSIWYG value — drives "is this field actually
// empty" and "is this long enough to need Show more". Editors leave &nbsp;
// behind when copy is deleted, so it counts as whitespace, not content.
const krocTextLength = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;

// { zuid, courseZuid, item: <class toJson()>, url } -> ClassCard props.item
const krocClassToCard = (row) => {
  const it = (row && row.item) || {};
  const hero = krocFirstOf(it.hero_image_desktop);
  const parent = krocFirstOf(it.courses);
  return {
    zuid: (row && row.zuid) || krocZuid(it),
    courseZuid: (row && row.courseZuid) || krocZuid(parent),
    title: krocPick(it, ["class_name", "title", "name"]),
    kind: krocLabelCase(it.class_type),
    day: String(it.day_of_week || "").trim(),
    time: String(it.time || "").trim(),
    dates: krocDateRange(it.class_start_date, it.class_end_date),
    ages: String(it.age_range || "").trim(),
    instructor: String(it.instructors || "").trim(),
    location: String(it.facility_location || "").trim(),
    desc: String(it.description || "").trim(),
    status: krocLabelCase(it.enrollment_status),
    spots: it.spots_remaining,
    memberPrice: krocMoney(it.member_price),
    publicPrice: krocMoney(it.public_price),
    price: krocMoney(it.price),
    enrollUrl: String(it.deep_link_url || "").trim(),
    image: hero && hero.url ? hero.url + "?width=800" : "",
    url: (row && row.url) || ""
  };
};

// { zuid, item: <course toJson()>, url } -> CourseRow props.course
const krocCourseToCard = (row) => {
  const it = (row && row.item) || {};
  return {
    zuid: (row && row.zuid) || krocZuid(it),
    title: krocPick(it, ["course_name", "title", "name"]),
    subtitle: krocPick(it, ["hero_subtitle"]),
    description: String(it.description || "").trim(),
    url: (row && row.url) || ""
  };
};

function ClassPrice(props) {
  return (
    <div>
      <div className="text-[11px] uppercase text-content-muted">{props.label}</div>
      <div className="text-[14px] text-content">{props.value}</div>
    </div>
  );
}

// The single Class card: 16:9 hero (or a navy colour-cover when the class has
// no image) with the type pill overlaid, then the leaf-class schema — dates,
// day/time, ages, instructor, location, availability, Member/Public prices.
// A class with a Description is clickable and opens a marketing modal.
function ClassCard(props) {
  const c = props.item || {};
  const [modal, setModal] = React.useState(false);
  const isOpen = krocClassOpen(c);
  const availability = krocAvailability(c);
  // description is a WYSIWYG, so an "empty" one can still hold <p></p> or a
  // stray &nbsp; — measure the text, or the card becomes clickable on nothing.
  const canOpen = krocTextLength(c.desc) > 0;
  const descHtml = { __html: c.desc };
  const singlePrice = !!c.price && !c.memberPrice && !c.publicPrice;
  const dayTime = [krocDayIndex(c.day) >= 0 ? krocDayLabel(c.day) : c.day, c.time]
    .filter(Boolean)
    .join(" · ");

  const meta = [
    c.dates && ["#i-cal", c.dates],
    dayTime && ["#i-clock", dayTime],
    c.ages && ["#i-users", c.ages],
    c.instructor && ["#i-star", c.instructor],
    c.location && ["#i-pin", c.location]
  ].filter(Boolean);

  React.useEffect(() => {
    if (!modal) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        setModal(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  const metaRows = meta.length > 0 && (
    <div className="flex flex-col gap-2 text-[13px] text-content-muted">
      {meta.map((m) => (
        <div key={m[0] + m[1]} className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 flex-none" id={m[0]} />
          {m[1]}
        </div>
      ))}
    </div>
  );

  const availPill = !!availability && (
    <span
      className={cx(
        "inline-flex rounded-full px-[11px] py-[5px] text-[12px]",
        isOpen ? "bg-success/10 text-success" : "bg-surface-muted text-content-muted"
      )}
    >
      {availability}
    </span>
  );

  const prices = (!!c.memberPrice || !!c.publicPrice || !!c.price) && (
    <div className="flex gap-[18px]">
      {singlePrice && <ClassPrice label="Price" value={c.price} />}
      {!!c.memberPrice && <ClassPrice label="Members" value={c.memberPrice} />}
      {!!c.publicPrice && <ClassPrice label="Public" value={c.publicPrice} />}
    </div>
  );

  const enroll = isOpen ? (
    <a
      href={c.enrollUrl || c.url || "#"}
      onClick={(e) => e.stopPropagation()}
      className="btn btn-primary btn-sm"
    >
      Enroll
    </a>
  ) : (
    <span className="btn btn-sm cursor-default bg-surface-muted text-content-muted">
      Enrollment Closed
    </span>
  );

  const openModal = (e) => {
    e.stopPropagation();
    setModal(true);
  };

  const modalNode =
    modal &&
    ReactDOM.createPortal(
      <div
        onClick={() => setModal(false)}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(28,27,31,0.5)] p-6"
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[520px] rounded-card bg-surface px-9 py-8 shadow-card"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setModal(false)}
            className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-surface-muted text-content"
          >
            <Icon className="h-4 w-4" id="#i-close" />
          </button>
          {!!c.kind && (
            <span className="inline-flex rounded-full bg-primary px-[11px] py-[5px] text-[12px] text-content-ondark">
              {c.kind}
            </span>
          )}
          <h3 className="mb-2.5 mt-3 text-heading-sm text-content">{c.title}</h3>
          {metaRows && <div className="mb-4">{metaRows}</div>}
          {availPill && <div className="mb-4">{availPill}</div>}
          {prices && <div className="mb-[18px]">{prices}</div>}
          <div
            className="kroc-prose mb-6 text-[14.5px] leading-[1.65] text-content"
            dangerouslySetInnerHTML={descHtml}
          ></div>
          <div className="flex gap-3">
            {isOpen && (
              <a href={c.enrollUrl || c.url || "#"} className="btn btn-primary">
                Enroll
              </a>
            )}
            <button
              type="button"
              onClick={() => setModal(false)}
              className="btn btn-outline-primary"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div
      onClick={canOpen ? () => setModal(true) : undefined}
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onKeyDown={
        canOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setModal(true);
              }
            }
          : undefined
      }
      className={cx(
        "flex flex-col overflow-hidden rounded-card bg-surface",
        props.bordered && "border border-black/10",
        canOpen && "cursor-pointer transition hover:shadow-card"
      )}
    >
      {c.image ? (
        <div className="relative aspect-video w-full bg-surface-muted">
          <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {!!c.kind && (
            <span className="absolute left-3.5 top-3.5 z-10 inline-flex rounded-full bg-primary px-[11px] py-[5px] text-[12px] text-content-ondark">
              {c.kind}
            </span>
          )}
        </div>
      ) : (
        <div className="relative flex aspect-video w-full items-end bg-secondary px-5 py-[18px]">
          {!!c.kind && (
            <span className="absolute left-3.5 top-3.5 inline-flex rounded-full bg-primary px-[11px] py-[5px] text-[12px] text-content-ondark">
              {c.kind}
            </span>
          )}
          <h4 className="text-[22px] leading-[1.15] text-content-ondark">{c.title}</h4>
        </div>
      )}

      <div className="flex flex-1 flex-col px-5 py-[18px]">
        {!!c.image && <h4 className="mb-3 text-[17px] leading-[1.25] text-content">{c.title}</h4>}
        {metaRows}
        {availPill && <div className="mb-[18px] mt-3">{availPill}</div>}
        <div className="mt-auto border-t border-black/5 pt-3.5">
          {prices && <div className="mb-3.5">{prices}</div>}
          <div className="flex items-center gap-3">
            {enroll}
            {canOpen && (
              <button
                type="button"
                onClick={openModal}
                className="cursor-pointer border-0 bg-transparent text-[13px] text-brand-link"
              >
                Details
              </button>
            )}
          </div>
        </div>
      </div>

      {modalNode}
    </div>
  );
}

// A collapsible day band (navy header) + its class grid. Open by default.
function DayGroup(props) {
  const [open, setOpen] = React.useState(true);
  const count = props.count || 0;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cx(
          "flex w-full cursor-pointer items-center gap-3 rounded-[8px] border-0 bg-secondary px-4 py-2 text-left text-[13px] font-semibold tracking-[0.04em] text-content-ondark",
          open && "mb-3.5"
        )}
      >
        <span className="flex-1">{props.label}</span>
        <span className="text-[12px] font-normal opacity-70">
          {count} {count === 1 ? "class" : "classes"}
        </span>
        <span className={cx("inline-flex transition", open && "rotate-180")}>
          <Icon className="h-4 w-4" id="#i-chev" />
        </span>
      </button>
      {open && props.children}
    </div>
  );
}

// Classes for one Course, banded by day of week in calendar order (unknown or
// missing days fall into a trailing "Schedule" band). `bordered` is for cards
// sitting on a white surface (the Program-detail course row) — on the page
// background they separate on their own.
function ClassList(props) {
  const classes = [].concat(props.classes || []).filter(Boolean);
  const order = [];
  const byDay = {};
  classes.forEach((c) => {
    const label = krocDayLabel(c.day);
    if (!byDay[label]) {
      byDay[label] = [];
      order.push(label);
    }
    byDay[label].push(c);
  });

  const rank = (label) => {
    const i = KROC_DAYS.findIndex((d) => d.label === label);
    return i >= 0 ? i : KROC_DAYS.length;
  };
  const groups = order
    .slice()
    .sort((a, b) => rank(a) - rank(b) || order.indexOf(a) - order.indexOf(b));

  return (
    <div className="flex flex-col gap-[22px]">
      {groups.map((label) => (
        <DayGroup key={label} label={label} count={byDay[label].length}>
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {byDay[label].map((c) => (
              <ClassCard key={c.zuid || c.title} item={c} bordered={props.bordered} />
            ))}
          </div>
        </DayGroup>
      ))}
    </div>
  );
}

// A Course as an expandable row — recreates the client's TractionRec catalog UI.
// The row header carries the rolled-up age range and the class count; expanding
// reveals the Course Description (clamped to 3 lines behind Show more) and the
// day-banded Classes.
function CourseRow(props) {
  const c = props.course || {};
  const classes = [].concat(props.classes || []).filter(Boolean);
  const [open, setOpen] = React.useState(!!props.defaultOpen);
  const [more, setMore] = React.useState(false);
  const ageRange = krocRollUp(classes, "ages");
  const ready = props.classesReady !== false;
  // WYSIWYG: measure the text, not the markup — an empty field still ships tags
  const descLength = krocTextLength(c.description);
  const hasDesc = descLength > 0;
  const longCopy = descLength > 180;
  const descHtml = { __html: c.description };

  let countLabel = "";
  if (ready) {
    countLabel = classes.length
      ? classes.length + (classes.length === 1 ? " class" : " classes")
      : "Schedule coming soon";
  }

  return (
    <div className="overflow-hidden rounded-card bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 border-0 bg-transparent px-5 py-4 text-left"
      >
        <span
          className={cx(
            "inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary-subtle text-primary transition",
            open && "rotate-180"
          )}
        >
          <Icon className="h-4 w-4" id="#i-chev" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] text-content">{c.title}</span>
            {!!ageRange && (
              <span className="inline-flex rounded-full bg-surface-muted px-[11px] py-[5px] text-[12px] text-content-muted">
                {ageRange}
              </span>
            )}
          </span>
        </span>
        <span className="whitespace-nowrap text-[13px] text-content-muted">{countLabel}</span>
      </button>

      {open && (
        <div className="border-t border-black/5 p-5">
          {hasDesc && (
            <div className="mb-[18px]">
              <div
                className={cx(
                  "kroc-prose text-[13.5px] leading-[1.55] text-content",
                  longCopy && !more && "line-clamp-3"
                )}
                dangerouslySetInnerHTML={descHtml}
              ></div>
              {longCopy && (
                <button
                  type="button"
                  onClick={() => setMore((m) => !m)}
                  aria-expanded={more}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent text-[13px] text-primary"
                >
                  {more ? "Show less" : "Show more"}
                  <span className={cx("inline-flex transition", more && "rotate-180")}>
                    <Icon className="h-3.5 w-3.5" id="#i-chev" />
                  </span>
                </button>
              )}
            </div>
          )}

          {!ready && (
            <div className="rounded-card bg-surface-muted px-5 py-[18px] text-center text-[14px] text-content-muted">
              Loading classes…
            </div>
          )}
          {ready && classes.length > 0 && <ClassList classes={classes} bordered />}
          {ready && classes.length === 0 && (
            <div className="rounded-card bg-surface-muted px-5 py-[18px] text-center text-[14px] text-content-muted">
              Class dates for this course haven’t been posted yet — check back soon.
            </div>
          )}

          {!!c.url && (
            <div className="mt-4">
              <a
                href={c.url}
                className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
              >
                View full course details <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Courses listing on the Program detail page. Two chained feeds: the paginated
// course rows come from /custom-endpoints/courses.json, then one call to
// /custom-endpoints/classes.json fetches the Classes for exactly the courses on
// screen (their zuids as a CSV) — the row's class count and age pill both roll
// up from that second response.
function CoursesSection(props) {
  const d = props.data || {};
  const PAGE_SIZE = d.pageSize || 10;
  const heading = d.heading || "Courses";

  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [courses, setCourses] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [classes, setClasses] = React.useState({ byCourse: {}, ready: false });
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const topRef = React.useRef(null);

  const loadClasses = (zuids) => {
    if (!zuids.length) {
      setClasses({ byCourse: {}, ready: true });
      return;
    }
    const params = new URLSearchParams();
    params.set("courses", zuids.join(","));
    fetch("/custom-endpoints/classes.json?" + params.toString())
      .then((r) => r.json())
      .then((json) => {
        const byCourse = {};
        []
          .concat((json && json.data) || [])
          .filter(Boolean)
          .map(krocClassToCard)
          .forEach((c) => {
            const key = c.courseZuid;
            if (!key) {
              return;
            }
            if (!byCourse[key]) {
              byCourse[key] = [];
            }
            byCourse[key].push(c);
          });
        setClasses({ byCourse: byCourse, ready: true });
      })
      .catch((err) => {
        console.error("KROC: classes feed failed", err);
        setClasses({ byCourse: {}, ready: true });
      });
  };

  const load = (nextPage, query) => {
    setLoading(true);
    setClasses({ byCourse: {}, ready: false });
    const params = new URLSearchParams();
    params.set("start", (nextPage - 1) * PAGE_SIZE);
    params.set("limit", PAGE_SIZE);
    if (query) {
      params.set("q", query);
    }
    if (d.programZuid) {
      params.set("program", d.programZuid);
    }
    fetch("/custom-endpoints/courses.json?" + params.toString())
      .then((r) => r.json())
      .then((json) => {
        const rows = []
          .concat((json && json.data) || [])
          .filter(Boolean)
          .map(krocCourseToCard);
        const ids = [].concat((json && json.total) || []).filter(Boolean);
        setCourses(rows);
        setTotal(ids.length);
        setFailed(false);
        setLoading(false);
        loadClasses(rows.map((r) => r.zuid).filter(Boolean));
      })
      .catch((err) => {
        console.error("KROC: courses feed failed", err);
        setFailed(true);
        setLoading(false);
        setClasses({ byCourse: {}, ready: true });
      });
  };

  // debounce typing; a search always returns to page 1
  React.useEffect(() => {
    const t = setTimeout(() => load(1, q), q ? 300 : 0);
    setPage(1);
    return () => clearTimeout(t);
  }, [q]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const goPage = (p) => {
    setPage(p);
    load(p, q);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  let body = null;
  if (courses.length > 0) {
    body = (
      <div className={cx("flex flex-col gap-3", loading && "opacity-60")}>
        {courses.map((c, i) => (
          <CourseRow
            key={c.zuid || c.title}
            course={c}
            classes={classes.byCourse[c.zuid]}
            classesReady={classes.ready}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    );
  } else {
    let msg = "No courses match your search.";
    if (loading) {
      msg = "Loading courses…";
    } else if (failed) {
      msg = "Courses couldn’t be loaded right now.";
    } else if (!q) {
      msg = "Courses for this program haven’t been published yet — check back soon.";
    }
    body = (
      <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">{msg}</div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading-md text-content">{heading}</h2>
        <div className="relative w-full sm:w-60">
          <Icon
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted"
            id="#i-search"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={d.searchPlaceholder || "Search courses"}
            className="w-full rounded-input bg-surface py-2.5 pl-10 pr-4 text-[14px] text-content placeholder:text-content-muted focus:outline-none"
          />
        </div>
      </div>

      {body}

      {pageCount > 1 && (
        <div className="mt-10 flex justify-center">
          <Pagination page={current} pageCount={pageCount} onPage={goPage} />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Course detail — the leaf listing page above the Classes themselves.
--------------------------------------------------------------------------- */

// Sidebar summary. Every row is rolled up from the Course's Classes, so a row
// with nothing behind it is dropped rather than rendered as a blank label, and
// a Course with no Classes at all falls back to a single line.
function CourseGlance(props) {
  const rows = [].concat(props.rows || []).filter((r) => r && r[1]);
  let body = null;
  if (!props.ready) {
    body = <div className="text-[14px] text-content-muted">Loading…</div>;
  } else if (rows.length) {
    // label left / value right on one line: reads as a spec list at 320px in
    // the sidebar, and doesn't strand the values when the grid stacks
    body = (
      <dl className="divide-y divide-black/5">
        {rows.map((r) => (
          <div
            key={r[0]}
            className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <dt className="flex-none text-[13px] text-content-muted">{r[0]}</dt>
            <dd className="text-right text-[14.5px] text-content">{r[1]}</dd>
          </div>
        ))}
      </dl>
    );
  } else {
    body = <div className="text-[14px] text-content-muted">Schedule coming soon</div>;
  }
  return (
    <div className="rounded-card bg-surface p-6">
      <div className="mb-3 text-[13px] uppercase tracking-[0.08em] text-content-muted">
        At a glance
      </div>
      {body}
    </div>
  );
}

// Sibling Courses under the same Program. The prototype puts an age range next
// to each one, but that would mean fetching every sibling's Classes purely for
// decoration — names only keeps this page at two requests.
function OtherCourses(props) {
  const list = [].concat(props.courses || []).filter(Boolean);
  if (!list.length) {
    return null;
  }
  return (
    <div className="mt-6 rounded-card bg-surface p-6">
      <div className="mb-3 text-[13px] uppercase tracking-[0.08em] text-content-muted">
        Other courses
      </div>
      {list.map((c) => (
        <a
          key={c.zuid || c.title}
          href={c.url || "#"}
          className="block py-1.5 text-[14px] text-content hover:underline"
        >
          {c.title}
        </a>
      ))}
    </div>
  );
}

// Course detail body: the About card + sidebar, then the Course's own Classes
// in the same day bands the Program page uses. Two independent feeds — this
// course's classes, and its sibling courses — so neither blocks the other.
function CourseDetail(props) {
  const d = props.data || {};
  const [classes, setClasses] = React.useState({ list: [], ready: false, failed: false });
  const [siblings, setSiblings] = React.useState([]);

  React.useEffect(() => {
    if (!d.zuid) {
      setClasses({ list: [], ready: true, failed: false });
      return;
    }
    const params = new URLSearchParams();
    params.set("courses", d.zuid);
    fetch("/custom-endpoints/classes.json?" + params.toString())
      .then((r) => r.json())
      .then((json) => {
        const list = []
          .concat((json && json.data) || [])
          .filter(Boolean)
          .map(krocClassToCard);
        setClasses({ list: list, ready: true, failed: false });
      })
      .catch((err) => {
        console.error("KROC: classes feed failed", err);
        setClasses({ list: [], ready: true, failed: true });
      });
  }, [d.zuid]);

  React.useEffect(() => {
    if (!d.programZuid) {
      return;
    }
    const params = new URLSearchParams();
    params.set("program", d.programZuid);
    params.set("limit", 20);
    fetch("/custom-endpoints/courses.json?" + params.toString())
      .then((r) => r.json())
      .then((json) => {
        const rows = []
          .concat((json && json.data) || [])
          .filter(Boolean)
          .map(krocCourseToCard)
          .filter((c) => c.zuid && c.zuid !== d.zuid);
        setSiblings(rows);
      })
      .catch((err) => {
        console.error("KROC: sibling courses feed failed", err);
      });
  }, [d.programZuid, d.zuid]);

  const glance = [
    ["Ages", krocRollUp(classes.list, "ages")],
    ["Location", krocRollUp(classes.list, "location")],
    ["Classes", classes.list.length ? String(classes.list.length) : ""]
  ];

  const hasDesc = krocTextLength(d.description) > 0;
  const descHtml = { __html: d.description };

  let classBody = null;
  if (!classes.ready) {
    classBody = "Loading classes…";
  } else if (classes.failed) {
    classBody = "Classes couldn’t be loaded right now.";
  } else if (!classes.list.length) {
    classBody = "Class dates for this course haven’t been posted yet — check back soon.";
  }

  return (
    <div>
      <div className="mb-11 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div className="rounded-card bg-surface px-6 py-8 sm:px-9">
          <h2 className="mb-3 text-heading-sm text-content">About this course</h2>
          {hasDesc ? (
            <div
              className="kroc-prose text-[15px] leading-[1.6] text-content"
              dangerouslySetInnerHTML={descHtml}
            ></div>
          ) : (
            <p className="text-[15px] text-content-muted">
              A description for this course hasn’t been added yet.
            </p>
          )}
        </div>
        <aside>
          <CourseGlance rows={glance} ready={classes.ready} />
          <OtherCourses courses={siblings} />
        </aside>
      </div>

      <h2 className="mb-[18px] text-heading-md text-content">Classes</h2>
      {classBody ? (
        <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">
          {classBody}
        </div>
      ) : (
        <ClassList classes={classes.list} />
      )}
    </div>
  );
}

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
