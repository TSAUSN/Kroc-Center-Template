// Class finder — the tree-wide search on the catalog root (/categories-page/).
// Loaded after catalogcards.jsx (ClassCard).
//
// A Class doesn't carry its Category: that is three levels up. The catalog
// root prints every row the finder needs from the tr_* datasets (krocDs
// bundle, data.ds) — classes with their prices, plus courses, programs and
// categories — and they are joined here by relation ZUID: class -> course ->
// program -> categories (program_categories, a one_to_many — the Category
// filter matches any of them). Nothing is fetched.
//
// Everything is client-side: filtering, search and pagination all work off
// the one joined list, which is what lets the Category filter exist at all.
//
// Type: Traction Rec has no class type, and Zesty's class_type isn't on these
// rows, so the Type filter only appears once a row actually carries a kind.

const KROC_ALL_CATEGORIES = "All Categories";
const KROC_DATE_FILTERS = ["Any time", "This week", "Next week", "This month"];

// Calendar windows, not rolling ones: "This week" is Sun–Sat of the current
// week, "This month" the 1st to the last of this month.
const krocDateWindow = (key) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (base, days) => {
    const d = new Date(base);
    d.setDate(base.getDate() + days);
    return d;
  };
  if (key === "This week" || key === "Next week") {
    const from = shift(today, -today.getDay() + (key === "Next week" ? 7 : 0));
    return { from: from, to: shift(from, 6) };
  }
  if (key === "This month") {
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    };
  }
  return null;
};

// A class matches a window when its run overlaps it. An undated class can only
// ever show under "Any time" — better than asserting it runs now.
const krocInWindow = (c, win) => {
  if (!win) {
    return true;
  }
  const start = krocParseDate(c.startDate);
  if (!start) {
    return false;
  }
  const end = krocParseDate(c.endDate) || start;
  return start.getTime() <= win.to.getTime() && end.getTime() >= win.from.getTime();
};

function FilterSelect(props) {
  return (
    <label className="inline-flex items-center gap-2 rounded-full bg-surface py-2 pl-3.5 pr-2 text-[13px]">
      <span className="text-content-muted">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="cursor-pointer border-0 bg-transparent pr-1 text-[13px] text-content focus:outline-none"
      >
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ClassFinderTable(props) {
  const rows = props.rows || [];
  const th = "px-5 py-3 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-content-muted";
  const td = "px-5 py-3.5 align-middle text-[14px] text-content";
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black/5 text-left">
            <th className={th}>Class</th>
            <th className={th}>Category</th>
            {props.showKind && <th className={th}>Type</th>}
            <th className={th}>Schedule</th>
            <th className={th}>Price</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id || c.title} className="border-b border-black/5 last:border-0">
              <td className={td}>
                {c.url ? (
                  <a href={c.url} className="text-content hover:text-primary">
                    {c.title}
                  </a>
                ) : (
                  c.title
                )}
              </td>
              <td className={cx(td, "text-content-muted")}>{c.categoryName}</td>
              {props.showKind && (
                <td className={td}>
                  {!!c.kind && (
                    <span className="inline-flex rounded-full bg-surface-muted px-[11px] py-[5px] text-[12px] text-content-muted">
                      {c.kind}
                    </span>
                  )}
                </td>
              )}
              <td className={cx(td, "text-content-muted")}>
                <div>{[c.day, c.time].filter(Boolean).join(" · ")}</div>
                {!!c.dates && <div className="mt-0.5 text-[12.5px]">{c.dates}</div>}
              </td>
              <td className={td}>
                {c.memberPrice || c.publicPrice ? (
                  <div className="leading-[1.45]">
                    {!!c.memberPrice && (
                      <div>
                        <span className="text-[11px] text-content-muted">Members </span>
                        {c.memberPrice}
                      </div>
                    )}
                    {!!c.publicPrice && (
                      <div>
                        <span className="text-[11px] text-content-muted">Public </span>
                        {c.publicPrice}
                      </div>
                    )}
                  </div>
                ) : (
                  c.price
                )}
              </td>
              <td className={cx(td, "text-right")}>
                {c.isOpen ? (
                  <a href={c.enrollUrl || c.url || undefined} className="btn btn-primary btn-sm">
                    {c.enrollLabel === "Join Waitlist" ? "Waitlist" : "Register"}
                  </a>
                ) : (
                  <span className="text-[13px] text-content-muted">Closed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Join each class to its course, program and categories, from the rows the
// page printed. Returns { classes: [card…], categories: [name…] }.
const krocFinderFeed = (ds) => {
  const name = (row) => krocTrText(row && row.name);

  const classes = ds.classes.filter(krocDsActive).map((row) => {
    const card = krocDsClassToCard(row);
    const course = ds.byZuid[row.course] || null;
    const program = course ? ds.byZuid[course.program] || null : null;
    const cats = krocDsIds(program && program.program_categories)
      .map((z) => ds.byZuid[z])
      .filter(Boolean);
    card.courseName = name(course);
    card.programName = name(program);
    card.categoryName = name(cats[0]);
    card.categoryNames = cats.map(name);
    card.searchText = [
      card.title,
      krocPlainText(card.desc),
      card.instructor,
      card.location,
      card.courseName,
      card.programName
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return card;
  });

  const categories = ds.categories
    .map(name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  // Soonest first: start date, then day band, then time.
  classes.sort(
    (a, b) =>
      String(a.startDate || "9999").localeCompare(String(b.startDate || "9999")) ||
      a.dayRank - b.dayRank ||
      a.startMinutes - b.startMinutes ||
      a.title.localeCompare(b.title)
  );
  return { classes: classes, categories: categories };
};

function ClassFinder(props) {
  const d = props.data || {};
  const PAGE_SIZE = d.pageSize || 12;
  const heading = d.heading || "Search for Classes";

  // The rows are in the page already, so the feed is ready on first render.
  const [feed] = React.useState(() => {
    const ds = d.ds || krocDs(null);
    const f = krocFinderFeed(ds);
    return {
      classes: f.classes,
      categories: f.categories,
      loading: false,
      failed: !ds.categories.length && !ds.classes.length
    };
  });
  const [view, setView] = React.useState("card");
  const [catF, setCatF] = React.useState(KROC_ALL_CATEGORIES);
  const [dateF, setDateF] = React.useState(KROC_DATE_FILTERS[0]);
  const [typeF, setTypeF] = React.useState("All");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const topRef = React.useRef(null);

  // any filter change returns to page 1
  React.useEffect(() => {
    setPage(1);
  }, [catF, dateF, typeF, q]);

  const catOptions = [KROC_ALL_CATEGORIES].concat(feed.categories);
  const kinds = feed.classes.map((c) => c.kind).filter(Boolean);
  const typeOptions = ["All"].concat(kinds.filter((k, i) => kinds.indexOf(k) === i).sort());
  const showKind = typeOptions.length > 1;

  const win = krocDateWindow(dateF);
  const needle = q.trim().toLowerCase();
  const shown = feed.classes.filter(
    (c) =>
      (typeF === "All" || c.kind === typeF) &&
      (catF === KROC_ALL_CATEGORIES || c.categoryNames.indexOf(catF) !== -1) &&
      krocInWindow(c, win) &&
      (!needle || c.searchText.indexOf(needle) !== -1)
  );

  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const goPage = (p) => {
    setPage(p);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  let body = null;
  if (feed.loading) {
    body = (
      <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">
        Loading classes…
      </div>
    );
  } else if (feed.failed) {
    body = (
      <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">
        Classes couldn’t be loaded right now.
      </div>
    );
  } else if (!rows.length) {
    body = (
      <div className="rounded-card bg-surface px-6 py-14 text-center text-[14.5px] text-content-muted">
        No classes match your search. Try a different filter or clear the search.
      </div>
    );
  } else if (view === "table") {
    body = <ClassFinderTable rows={rows} showKind={showKind} />;
  } else {
    body = (
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => (
          <ClassCard key={c.id || c.title} item={c} />
        ))}
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-heading-md text-content">{heading}</h2>
        <div className="inline-flex rounded-full bg-surface p-[3px]">
          {[
            ["card", "Cards"],
            ["table", "Table"]
          ].map((v) => (
            <button
              key={v[0]}
              type="button"
              onClick={() => setView(v[0])}
              className={cx(
                "cursor-pointer rounded-full border-0 px-4 py-[7px] text-[13px]",
                view === v[0] ? "bg-primary text-content-ondark" : "bg-transparent text-content"
              )}
            >
              {v[1]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Category" value={catF} options={catOptions} onChange={setCatF} />
          <FilterSelect
            label="Date"
            value={dateF}
            options={KROC_DATE_FILTERS}
            onChange={setDateF}
          />
          {showKind && (
            <FilterSelect label="Type" value={typeF} options={typeOptions} onChange={setTypeF} />
          )}
        </div>
        <div className="relative w-full sm:w-60">
          <Icon
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted"
            id="#i-search"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={d.searchPlaceholder || "Search all classes"}
            className="w-full rounded-input bg-surface py-2.5 pl-10 pr-4 text-[14px] text-content placeholder:text-content-muted focus:outline-none"
          />
        </div>
      </div>

      {!feed.loading && !feed.failed && (
        <div className="mb-3.5 text-[13px] text-content-muted">
          Showing {shown.length} of {feed.classes.length}{" "}
          {feed.classes.length === 1 ? "class" : "classes"}
        </div>
      )}

      {body}

      {pageCount > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination page={current} pageCount={pageCount} onPage={goPage} />
        </div>
      )}
    </div>
  );
}
