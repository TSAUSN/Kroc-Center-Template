// Catalog listings: CategoriesSection (the catalog root, /categories-page/), ProgramsSection
// (a Category page) and CoursesSection (a Program page). Loaded after
// catalogcards.jsx.
//
// Each listing is handed its COMPLETE row set by the page view — the tier file
// or the parent's children file from /tractionrec/, inlined at render time —
// so search and paging are client-side over a short list (the largest, Group
// Swim Lessons, has 29 courses). Before the Traction Rec files these were
// server-side Parsley queries over Zesty relational fields, one request per
// keystroke and page.
//
// `data.rows === null` means the page had no Traction Rec data to inline (an
// item with no tractionrec_id, or a missing file); an empty array means the
// parent genuinely has no children.

// Search + page state over an in-memory list. Typing returns to page 1.
function useKrocListing(items, pageSize, textOf) {
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const topRef = React.useRef(null);
  React.useEffect(() => setPage(1), [q]);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? items.filter((it) => textOf(it).toLowerCase().indexOf(needle) !== -1)
    : items;
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const current = Math.min(page, pageCount);
  const goPage = (p) => {
    setPage(p);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  return {
    q: q,
    setQ: setQ,
    needle: needle,
    rows: shown.slice((current - 1) * pageSize, current * pageSize),
    current: current,
    pageCount: pageCount,
    goPage: goPage,
    topRef: topRef
  };
}

// Heading + search box, the body, then numbered pagination.
function CatalogListing(props) {
  const l = props.listing;
  return (
    <div ref={l.topRef} className="scroll-mt-24">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading-md text-content">{props.heading}</h2>
        {props.searchable !== false && (
          <div className="relative w-full sm:w-60">
            <Icon
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted"
              id="#i-search"
            />
            <input
              type="search"
              value={l.q}
              onChange={(e) => l.setQ(e.target.value)}
              placeholder={props.placeholder}
              className="w-full rounded-input bg-surface py-2.5 pl-10 pr-4 text-[14px] text-content placeholder:text-content-muted focus:outline-none"
            />
          </div>
        )}
      </div>

      {props.children}

      {l.pageCount > 1 && (
        <div className="mt-10 flex justify-center">
          <Pagination page={l.current} pageCount={l.pageCount} onPage={l.goPage} />
        </div>
      )}
    </div>
  );
}

function CatalogEmpty(props) {
  return (
    <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">
      {props.children}
    </div>
  );
}

// The message for an empty result: no data at all, a search with no hits, or a
// parent with no children yet.
const krocListingEmpty = (rows, listing, words) => {
  if (rows === null) {
    return words.missing;
  }
  return listing.needle ? words.noMatch : words.none;
};

// Category or Program cards in a 1/2/3-column grid.
function CardGridListing(props) {
  const d = props.data || {};
  const cards = krocTrRows(d.rows).map(props.toCard);
  const listing = useKrocListing(cards, d.pageSize || 9, (c) => c.title + " " + c.summary);
  return (
    <CatalogListing
      heading={d.heading || props.heading}
      placeholder={d.searchPlaceholder || props.placeholder}
      listing={listing}
    >
      {listing.rows.length > 0 ? (
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listing.rows.map((c) => (
            <ProgramCard key={c.id || c.title} card={c} ctaLabel={d.ctaLabel || props.ctaLabel} />
          ))}
        </div>
      ) : (
        <CatalogEmpty>{krocListingEmpty(d.rows, listing, props.empty)}</CatalogEmpty>
      )}
    </CatalogListing>
  );
}

// Empty-state copy per listing (named constants: an object literal written
// inline as a JSX prop would put a double brace in a Parsley-processed file).
const KROC_EMPTY_CATEGORIES = {
  missing: "Categories couldn’t be loaded right now.",
  noMatch: "No categories match your search.",
  none: "Categories haven’t been published yet — check back soon."
};
const KROC_EMPTY_PROGRAMS = {
  missing: "Programs couldn’t be loaded right now.",
  noMatch: "No programs match your search.",
  none: "Programs for this category haven’t been published yet — check back soon."
};
const KROC_EMPTY_COURSES = {
  missing: "Courses couldn’t be loaded right now.",
  noMatch: "No courses match your search.",
  none: "Courses for this program haven’t been published yet — check back soon."
};

// "Browse by Category" on the catalog root. data.rows: tr_program_categories
// rows (krocDs)
function CategoriesSection(props) {
  return (
    <CardGridListing
      data={props.data}
      toCard={krocDsCategoryToCard}
      heading="Browse by Category"
      placeholder="Search categories"
      ctaLabel="View Category"
      empty={KROC_EMPTY_CATEGORIES}
    />
  );
}

// A Category's programs. data.rows: tr_programs rows (krocDs)
function ProgramsSection(props) {
  return (
    <CardGridListing
      data={props.data}
      toCard={krocDsProgramToCard}
      heading="Programs"
      placeholder="Search programs"
      ctaLabel="View Program"
      empty={KROC_EMPTY_PROGRAMS}
    />
  );
}

// A Program's courses, each an expandable row carrying its classes.
// data.ds: the krocDs bundle the program page printed — the program
// (ds.self), its courses and all their classes. Nothing is fetched.
function CoursesSection(props) {
  const d = props.data || {};
  const PAGE_SIZE = d.pageSize || 10;
  const ds = d.ds || krocDs(null);
  const rows = ds.self
    ? ds.courses.filter((c) => c.program === ds.self.zuid && krocDsActive(c))
    : null;
  const courses = krocTrRows(rows).map(krocDsCourseToCard);
  // Traction Rec Id order, as the classes tier file had it: CourseRow rolls up
  // its ages line in the order it is given, and ClassList bands them itself.
  const classes = { byCourse: {}, ready: true };
  ds.classes
    .filter(krocDsActive)
    .sort((a, b) => krocTrText(a.tractionrec_id).localeCompare(krocTrText(b.tractionrec_id)))
    .forEach((row) => {
      (classes.byCourse[row.course] = classes.byCourse[row.course] || []).push(
        krocDsClassToCard(row)
      );
    });

  const listing = useKrocListing(
    courses,
    PAGE_SIZE,
    (c) => c.title + " " + krocPlainText(c.description)
  );

  return (
    <CatalogListing
      heading={d.heading || "Courses"}
      placeholder={d.searchPlaceholder || "Search courses"}
      listing={listing}
    >
      {listing.rows.length > 0 ? (
        <div className="flex flex-col gap-3">
          {listing.rows.map((c, i) => (
            <CourseRow
              key={c.id || c.title}
              course={c}
              classes={classes.byCourse[c.id]}
              classesReady={classes.ready}
              defaultOpen={i === 0 && listing.current === 1}
            />
          ))}
        </div>
      ) : (
        <CatalogEmpty>{krocListingEmpty(rows, listing, KROC_EMPTY_COURSES)}</CatalogEmpty>
      )}
    </CatalogListing>
  );
}
