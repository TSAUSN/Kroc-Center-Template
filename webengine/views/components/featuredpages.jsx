// Featured Pages block — architecture v5 §12 (instance-authoritative model).
// One `display_mode` field drives two faces:
//   compact -> quick-link chip row; the whole chip is the link
//   grid    -> full card: media panel + description + CTA
//
// X11 / AGENTS.md §3: a Media sub-field inside a repeater stores a bare ZUID
// that Parsley cannot resolve, and both `Page Logo` and `Page Hero` are exactly
// that. Accept whichever shape the row actually carries — a resolved URL, a
// toJson() media object, or an unresolvable ZUID — so a card falls back to its
// placeholder instead of rendering a broken <img>. If the model ever moves to a
// resolvable media field, this starts working with no code change.
const krocRepeaterMedia = (value) => {
  if (!value) {
    return "";
  }
  const media = krocFirstOf(value);
  if (media && media.url) {
    return media.url;
  }
  const s = String(value).trim();
  return /^(https?:)?\/\//.test(s) || s.charAt(0) === "/" ? s : "";
};

// The repeater's sub-field API IDs were truncated in the manager UI when the
// model was transcribed, so every read goes through krocPick with the plausible
// spellings — a field ref differing from the assumed one costs one field, not
// the whole card.
const krocFeaturedPageToCard = (row) => {
  const r = row || {};
  return {
    title: krocPick(r, ["page_title", "title", "name"]),
    description: krocPick(r, ["page_description", "description", "card_description"]),
    ctaLabel: krocPick(r, ["cta_label", "button_text", "cta"]),
    url: krocPick(r, ["cta_url", "url", "link"]),
    logoUrl: krocRepeaterMedia(r.page_logo || r.logo || r.icon),
    heroUrl: krocRepeaterMedia(r.page_hero || r.hero || r.image)
  };
};

// Column count is not an authored field on the built model (§12 divergence), so
// it is derived from the item count: 3 items -> 3-up, 4 -> 4-up, 6 -> 6-up,
// which reproduces all three consumers. Literal class strings — Tailwind cannot
// see an interpolated one.
//
// Below three items the equal-fraction tracks would stretch a chip into a
// full-width bar, so 1-2 chips get a fixed track at the prototype's 6-up chip
// width (~198px in a 1248px row) instead of filling the container.
const KROC_FP_COLS = {
  compact: {
    1: "grid-cols-[minmax(0,200px)]",
    2: "grid-cols-2 sm:grid-cols-[repeat(2,minmax(0,200px))]",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
  },
  grid: {
    1: "grid-cols-[minmax(0,405px)]",
    2: "grid-cols-1 sm:grid-cols-[repeat(2,minmax(0,405px))]",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
  }
};

const krocFeaturedCols = (mode, count) => {
  const table = KROC_FP_COLS[mode];
  const max = mode === "compact" ? 6 : 4;
  return table[Math.min(Math.max(count, 1), max)] || "grid-cols-1";
};

// Repeater rows carry sort_order only when the model defines it; sorting on a
// missing key would scramble the authored order instead of preserving it.
const krocSortRows = (rows) =>
  rows.every((r) => r && r.sort_order != null)
    ? rows.slice().sort((a, b) => parseInt(a.sort_order, 10) - parseInt(b.sort_order, 10))
    : rows;

// compact: icon chip + label, whole chip is the link target.
function FeaturedPageChip(props) {
  const c = props.card;
  const Tag = c.url ? "a" : "div";
  return (
    <Tag
      href={c.url || undefined}
      className={cx(
        "flex flex-col items-center gap-2.5 rounded-card bg-surface px-3.5 py-[18px] text-center text-content",
        c.url && "transition hover:shadow-card"
      )}
    >
      <span className="inline-flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-primary-subtle text-primary">
        {c.logoUrl ? (
          <img src={c.logoUrl} alt="" className="h-5 w-5 object-contain" />
        ) : (
          <Icon className="h-5 w-5" id={krocIconFor(c.title)} />
        )}
      </span>
      <span className="text-[12.5px] leading-[1.25]">{c.title}</span>
    </Tag>
  );
}

// grid: 4:3 media panel over title + 2-line description + secondary CTA.
// Page Hero fills the photo panel; with no hero, Page Logo (or an inferred
// glyph) sits on a tinted panel of the same footprint so rows stay aligned.
function FeaturedPageCard(props) {
  const c = props.card;
  return (
    <div className="flex flex-col overflow-hidden rounded-card bg-surface">
      {c.heroUrl ? (
        <img
          src={c.heroUrl}
          alt={c.title}
          className="aspect-[4/3] w-full bg-surface-muted object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-secondary-subtle text-secondary">
          {c.logoUrl ? (
            <img src={c.logoUrl} alt="" className="h-[54px] w-[54px] object-contain" />
          ) : (
            <Icon className="h-[54px] w-[54px]" id={krocIconFor(c.title)} />
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col px-[22px] py-5">
        <h3 className="mb-1.5 text-[18px] leading-[1.3] text-content">{c.title}</h3>
        {c.description && (
          // fixed 2-line box: the grid cannot equalise heights, so longer copy
          // is clamped rather than allowed to grow the row (v5 §12)
          <p className="mb-3.5 line-clamp-2 text-[13.5px] leading-[1.5] text-content">
            {c.description}
          </p>
        )}
        {c.url && (
          <a href={c.url} className="btn btn-secondary btn-sm mt-auto self-start">
            {c.ctaLabel || "Learn More"}
          </a>
        )}
      </div>
    </div>
  );
}

function FeaturedPages(props) {
  const d = props.data || {};
  const rows = []
    .concat(d.pages || [])
    .flat()
    .filter(Boolean);

  const cards = krocSortRows(rows)
    .map(krocFeaturedPageToCard)
    .filter((c) => c.title);

  if (!cards.length) {
    return null;
  }

  // the built model has no Card Style field — `compact` is the card face and
  // anything else (the model's only other option is `grid`) is the full card
  const compact = String(d.displayMode || "").toLowerCase() === "compact";
  const mode = compact ? "compact" : "grid";

  return (
    <div>
      {d.title && <h3 className="mb-[18px] text-heading-md text-content">{d.title}</h3>}
      <div
        className={cx(
          "grid items-stretch",
          compact ? "gap-3" : "gap-4",
          krocFeaturedCols(mode, cards.length)
        )}
      >
        {cards.map((c, i) =>
          compact ? (
            <FeaturedPageChip key={c.title + i} card={c} />
          ) : (
            <FeaturedPageCard key={c.title + i} card={c} />
          )
        )}
      </div>
    </div>
  );
}
