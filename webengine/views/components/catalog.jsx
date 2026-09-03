// Shared pieces for the v4 catalog: Category > Program > Course > Class.
// Loaded after cards.jsx (uses cx, Icon, Pagination, krocFirstOf).
//
// Field refs verified in the Manager 2026-07-29 (Parsley (** **) comments get
// stripped from synced JSON endpoints, so they are recorded here instead):
//   [categories]  category_name · category_icon (Media) · hero_image_desktop ·
//                 hero_subtitle · card_summary · intro_content · sort_order
//   [programs]    program_name · categories (One-to-One parent) ·
//                 program_icon (Media) · hero_image_desktop · hero_subtitle ·
//                 card_summary · intro_content · sort_order
// Gotchas: the relation is `categories` (plural), NOT `category`; and the icon
// fields are `category_icon` / `program_icon` — a bare `icon` resolves to the
// system field, which makes a loop `where` clause "unknown or ambiguous".
// Neither model has hero_image_mobile or hero_image_thumbnail.

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

// { item: <program toJson()>, url, icon } -> ProgramCard props.card
// program_icon is a Media field, so the icon is an image URL — the endpoint
// resolves it; toJson() only carries the ZUID envelope, hence krocFirstOf.
const krocProgramToCard = (row) => {
  const it = (row && row.item) || {};
  const iconMedia = krocFirstOf(it.program_icon);
  return {
    zuid: it.zuid || "",
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
