// "24 stories · 3 events · 2 programs" — only nonzero parts, stories always shown
const krocTagCountLabel = (counts) => {
  const parts = [counts.stories + (counts.stories === 1 ? " story" : " stories")];
  if (counts.events) {
    parts.push(counts.events + (counts.events === 1 ? " event" : " events"));
  }
  if (counts.programs) {
    parts.push(counts.programs + (counts.programs === 1 ? " program" : " programs"));
  }
  return parts.join(" · ");
};

const krocTagSlug = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function TagsHero(props) {
  const d = props.data || {};
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-card bg-secondary px-6 py-12 text-center text-content-ondark">
      <div className="mb-2.5 text-[12px] uppercase tracking-[0.14em] text-white/70">
        Browse by Topic
      </div>
      <h1 className="mb-3 text-heading-md lg:text-heading-lg">{d.title || "Tags"}</h1>
      {d.subheader && <p className="max-w-[560px] text-[17px] text-white/85">{d.subheader}</p>}
    </div>
  );
}

function TagCard(props) {
  const t = props.tag;
  return (
    <a
      href={t.url || "#"}
      className="block rounded-card bg-surface px-5.5 py-5 transition hover:shadow-card"
    >
      <div className="mb-1.5 flex items-center gap-2.5">
        {t.icon ? (
          <img src={t.icon} alt="" className="h-6 w-6 flex-none rounded-md object-cover" />
        ) : (
          <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-md bg-primary text-[13px] text-content-ondark"></span>
        )}
        <div className="text-[11px] text-content-muted">#{t.slug}</div>
      </div>
      <div className="mb-1 text-[18px] text-content">{t.name}</div>
      <div className="text-[12.5px] text-content-muted">{krocTagCountLabel(t.counts)}</div>
    </a>
  );
}

function AllTags() {
  const PAGE_SIZE = 16;

  const [feed, setFeed] = React.useState({ tags: [], corpus: [], loading: true });
  const [sort, setSort] = React.useState("az");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const topRef = React.useRef(null);

  React.useEffect(() => {
    fetch("/custom-endpoints/tags.json")
      .then((r) => r.json())
      .then((json) => {
        const tags = [].concat((json && json.tags) || []).filter(Boolean);
        // one JSON string per story's hashtag rows; tag membership = substring '"Name"'
        const corpus = []
          .concat((json && json.storyTags) || [])
          .map((rows) => JSON.stringify(rows));
        setFeed({ tags, corpus, loading: false });
      })
      .catch((err) => {
        console.error("KROC: tags feed failed", err);
        setFeed((prev) => ({ tags: prev.tags, corpus: prev.corpus, loading: false }));
      });
  }, []);

  const countStories = (name) => {
    const needle = '"' + name + '"';
    return feed.corpus.filter((h) => h.indexOf(needle) !== -1).length;
  };

  const tags = feed.tags.map((t) => ({
    name: t.name,
    url: t.url,
    icon: t.icon,
    slug: krocTagSlug(t.name),
    // events/programs wired to 0 for now; feed them here when those models are ready
    counts: { stories: countStories(t.name), events: 0, programs: 0 }
  }));

  const SORTS = [
    { key: "az", label: "A–Z" },
    { key: "most", label: "Most stories" }
  ];

  const needle = q.trim().toLowerCase();
  let list = tags.filter((t) => t.name.toLowerCase().indexOf(needle) !== -1);
  if (sort === "az") {
    list = list.slice().sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "most") {
    list = list.slice().sort((a, b) => b.counts.stories - a.counts.stories);
  }

  const pageCount = Math.ceil(list.length / PAGE_SIZE);
  const current = Math.min(page, pageCount || 1);
  const shown = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const goPage = (p) => {
    setPage(p);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div ref={topRef} className="scroll-mt-24">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setSort(s.key);
                setPage(1);
              }}
              className={cx(
                "cursor-pointer rounded-full px-[13px] py-[7px] text-[12.5px]",
                sort === s.key ? "bg-secondary text-content-ondark" : "bg-surface text-content"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Icon
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted"
            id="#i-search"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search tags"
            className="w-full rounded-input bg-surface py-2.5 pl-10 pr-4 text-[14px] text-content placeholder:text-content-muted focus:outline-none"
          />
        </div>
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((t) => (
            <TagCard key={t.name} tag={t} />
          ))}
        </div>
      ) : (
        <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">
          {feed.loading ? "Loading tags…" : "No tags found."}
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
