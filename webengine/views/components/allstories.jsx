function StoriesHero(props) {
  const d = props.data || {};
  return (
    <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-card bg-secondary px-6 py-12 text-center">
      {d.heroDesktop && (
        <picture>
          {d.heroMobile && <source media="(max-width: 640px)" srcSet={d.heroMobile} />}
          <img src={d.heroDesktop} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </picture>
      )}
      <div className="absolute inset-0 bg-[rgba(2,32,86,0.55)]"></div>
      <div className="relative z-10 max-w-[600px]">
        {d.eyebrow && (
          <div className="mb-2.5 text-[12px] uppercase tracking-[0.14em] text-white/70">
            {d.eyebrow}
          </div>
        )}
        <h1 className="mb-3 text-heading-md text-content-ondark lg:text-heading-lg">{d.title}</h1>
        {d.subheader && <p className="text-[17px] text-white/85">{d.subheader}</p>}
      </div>
    </div>
  );
}

function AllStories(props) {
  const d = props.data || {};
  const categories = [].concat(d.categories || []).filter(Boolean);
  const PAGE_SIZE = 9;

  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [cards, setCards] = React.useState([]);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const startRef = React.useRef(0);

  const load = (start, replace) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("start", start);
    params.set("limit", PAGE_SIZE);
    // quotes would break the endpoint's SQL-ish where clause
    const safeQ = q.replace(/['"]/g, "").trim();
    if (safeQ) {
      params.set("q", safeQ);
    }
    if (category) {
      params.set("category", category);
    }
    fetch("/custom-endpoints/stories.json?" + params.toString())
      .then((r) => r.json())
      .then((json) => {
        const rows = []
          .concat((json && json.data) || [])
          .filter(Boolean)
          .map(krocStoryToCard);
        startRef.current = start;
        setCards((prev) => (replace ? rows : prev.concat(rows)));
        setHasMore(rows.length === PAGE_SIZE);
        setLoading(false);
      })
      .catch((err) => {
        console.error("KROC: stories feed failed", err);
        setLoading(false);
      });
  };

  // debounce typing; chip changes apply immediately
  React.useEffect(() => {
    const t = setTimeout(() => load(0, true), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, category]);

  return (
    <div>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={cx(
              "cursor-pointer rounded-full px-[13px] py-[7px] text-[12.5px]",
              category ? "bg-surface text-content" : "bg-secondary text-content-ondark"
            )}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.zuid}
              type="button"
              onClick={() => setCategory(category === c.zuid ? "" : c.zuid)}
              className={cx(
                "cursor-pointer rounded-full px-[13px] py-[7px] text-[12.5px]",
                category === c.zuid ? "bg-secondary text-content-ondark" : "bg-surface text-content"
              )}
            >
              {c.name}
            </button>
          ))}
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
            placeholder="Search stories"
            className="w-full rounded-input bg-surface py-2.5 pl-10 pr-4 text-[14px] text-content placeholder:text-content-muted focus:outline-none"
          />
        </div>
      </div>

      {cards.length > 0 ? (
        <div
          className={cx(
            "grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3",
            loading && "opacity-60"
          )}
        >
          {cards.map((c) => (
            <StoryCard key={c.zuid || c.title} card={c} />
          ))}
        </div>
      ) : (
        <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">
          {loading ? "Loading stories…" : "No stories found."}
        </div>
      )}

      {hasMore && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => load(startRef.current + PAGE_SIZE, false)}
            className="btn btn-secondary cursor-pointer"
          >
            Load More Stories
          </button>
        </div>
      )}
    </div>
  );
}
