function TagDetailHero(props) {
  const d = props.data || {};
  return (
    <div className="flex min-h-60 flex-col items-center justify-center rounded-card bg-secondary px-6 py-12 text-center text-content-ondark">
      <div className="mb-3.5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px]">
        #{d.slug}
      </div>
      <h1 className="mb-2.5 text-heading-md lg:text-heading-lg">{d.description}</h1>
      {d.countLabel && <p className="text-[16px] text-white/85">{d.countLabel}</p>}
    </div>
  );
}

function TagDetail(props) {
  const d = props.data || {};
  const name = d.name || "";
  const slug = krocTagSlug(name);
  const parentUrl = (d.url || "/tags/").replace(/[^/]+\/?$/, "") || "/";

  const stories = []
    .concat(d.stories || [])
    .flat()
    .filter(Boolean)
    .map(krocStoryToCard);

  // Mixed content feed. Only stories exist today; append event/program items
  // here (with type "event"/"program") once those models are wired up, and the
  // chips + card switch below will pick them up automatically.
  const feed = stories.map((c) => ({ type: "story", card: c }));

  const counts = { stories: stories.length, events: 0, programs: 0 };

  const TYPES = [
    { key: "all", label: "All", count: feed.length },
    { key: "story", label: "Stories", count: counts.stories },
    { key: "event", label: "Events", count: counts.events },
    { key: "program", label: "Programs", count: counts.programs }
  ];

  const PAGE_SIZE = 12;
  const [type, setType] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const listRef = React.useRef(null);

  const filtered = type === "all" ? feed : feed.filter((f) => f.type === type);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const current = Math.min(page, pageCount || 1);
  const start = (current - 1) * PAGE_SIZE;
  const shown = filtered.slice(start, start + PAGE_SIZE);

  const changeType = (key) => {
    setType(key);
    setPage(1);
  };

  const goPage = (p) => {
    setPage(p);
    if (listRef.current) {
      listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // description is a rich-text field; strip markup for the hero headline, fall
  // back to the tag name when no description is set
  const description =
    String(d.description || "")
      .replace(/<[^>]*>/g, "")
      .trim() || name;
  const heroData = { description, slug, countLabel: krocTagCountLabel(counts) };

  return (
    <div>
      <div className="mb-4">
        <a href={parentUrl} className="inline-flex items-center gap-1.5 text-[13px] text-content">
          <Icon className="h-3.5 w-3.5 flex-none rotate-90" id="#i-chev" />
          All Tags
        </a>
      </div>

      <TagDetailHero data={heroData} />

      <div
        ref={listRef}
        className="mb-4.5 mt-10 flex scroll-mt-24 flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeType(t.key)}
              disabled={t.key !== "all" && !t.count}
              className={cx(
                "rounded-full px-3.25 py-1.75 text-[12.5px]",
                t.key !== "all" && !t.count
                  ? "cursor-default bg-surface text-content-muted opacity-50"
                  : "cursor-pointer",
                type === t.key
                  ? "bg-secondary text-content-ondark"
                  : t.count || t.key === "all"
                    ? "bg-surface text-content"
                    : ""
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="text-[13px] text-content-muted">
          {filtered.length > 0
            ? "Showing " + (start + 1) + "–" + (start + shown.length) + " of " + filtered.length
            : ""}
        </div>
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((f, i) => {
            if (f.type === "story") {
              return <StoryCard key={f.card.zuid || f.card.title || i} card={f.card} />;
            }
            return null;
          })}
        </div>
      ) : (
        <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">
          Nothing tagged here yet.
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-10 flex justify-center">
          <Pagination page={current} pageCount={pageCount} onPage={goPage} />
        </div>
      )}
    </div>
  );
}
