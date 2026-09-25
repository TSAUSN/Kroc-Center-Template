// Featured Volunteer Opportunities block — architecture v5 §18 as designed: a
// One-to-Many relationship to [volunteer_opportunities], resolved in the block
// view with the featured_stories FIND_IN_SET pattern. Each card pulls Hero
// Image, Opportunity Title, Start/End Date and Excerpt from the referenced
// item, and links to it with getUrl(), so a renamed or moved opportunity page
// never strands a card.
//
// Why not a repeater like §12 Featured Pages: a Zesty repeater cannot hold a
// relational sub-field, so its rows could only duplicate the opportunity's
// copy and hand-type an absolute URL — and the built [volunteer_opportunities]
// model (2026-06-16) already carries every card field. Shifts stay on that
// model as their own {label, time} repeater; the design never puts them on the
// card, only in the detail sidebar.
//
// Uses krocPick from catalog.jsx, krocFirstOf from cards.jsx and
// krocExternalUrl from featuredpages.jsx (all loaded earlier). OppCard lives in
// cards.jsx.

// start_date / end_date are Date & Time on the built model and ship as
// "YYYY-MM-DD HH:MM:SS". Only the day is read — shift times live in `shifts` —
// and it is parsed by hand: new Date("2026-06-01") is UTC midnight, which
// prints as May 31 in every US timezone.
const krocOppDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || "").trim());
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

const krocOppMonthDay = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const krocOppFull = (d) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// The card's muted mono dateline: "Jun 1 – Aug 7, 2026" · "Dec 1 – 24, 2026" ·
// "Sep 1, 2026 – May 31, 2027" · one day "Dec 24, 2026". A blank End Date
// means ongoing (v5 §36) -> "Ongoing · from Jun 1, 2026", the prototype's
// "Ongoing · …" card.
const krocOppDateline = (start, end) => {
  const s = krocOppDate(start);
  const e = krocOppDate(end);
  if (s && e) {
    if (s.getTime() === e.getTime()) {
      return krocOppFull(s);
    }
    if (s.getFullYear() !== e.getFullYear()) {
      return krocOppFull(s) + " – " + krocOppFull(e);
    }
    if (s.getMonth() === e.getMonth()) {
      return krocOppMonthDay(s) + " – " + e.getDate() + ", " + e.getFullYear();
    }
    return krocOppMonthDay(s) + " – " + krocOppFull(e);
  }
  if (s) {
    return "Ongoing · from " + krocOppFull(s);
  }
  if (e) {
    return "Through " + krocOppFull(e);
  }
  return "";
};

// An Internal Link field prints the target's ZUID, which krocExternalUrl would
// pass through as a broken relative href — drop it instead of rendering it.
const krocOppLink = (value) => {
  const url = krocExternalUrl(value);
  return /^\d+-[0-9a-z]+-[0-9a-z]+$/i.test(url) ? "" : url;
};

// { item: <volunteer_opportunities toJson()>, hero, url } -> OppCard props.card.
// Field API IDs from the built model: opportunity_title, hero_image, excerpt,
// start_date, end_date. toJson() leaves media as { data: [{ url }] }, so the
// block view's getImage(800) is preferred and that shape is the fallback.
const krocOpportunityToCard = (row) => {
  const it = (row && row.item) || {};
  const heroMedia = krocFirstOf(it.hero_image);
  return {
    zuid: krocZuid(it) || it.zuid || "",
    title: krocPick(it, ["opportunity_title", "title"]),
    dateline: krocOppDateline(it.start_date, it.end_date),
    excerpt: krocPick(it, ["excerpt"]),
    ctaLabel: "",
    url: (row && row.url) || "",
    image: (row && row.hero) || (heroMedia && heroMedia.url ? heroMedia.url + "?width=800" : "")
  };
};

// Display Mode is Grid 3-up / Grid 4-up (v5 §18). Below three cards the
// equal-fraction tracks would stretch a card across the row, so 1-2 cards get
// a fixed track at the prototype's 3-up card width. Literal class strings —
// Tailwind cannot see an interpolated one.
const KROC_FVO_COLS = {
  1: "grid-cols-[minmax(0,405px)]",
  2: "grid-cols-1 sm:grid-cols-[repeat(2,minmax(0,405px))]",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
};

const krocOppCols = (fourUp, count) => KROC_FVO_COLS[Math.min(Math.max(count, 1), fourUp ? 4 : 3)];

function FeaturedVolunteerOpps(props) {
  const d = props.data || {};

  // the each-loop returns dataset order; the one-to-many CSV holds curation order
  const order = String(d.zuids || "")
    .split(",")
    .map((z) => z.trim());

  const cards = []
    .concat(d.opportunities || [])
    .flat()
    .filter(Boolean)
    .map(krocOpportunityToCard)
    .filter((c) => c.title)
    .sort((a, b) => order.indexOf(a.zuid) - order.indexOf(b.zuid));

  if (!cards.length) {
    return null;
  }

  const fourUp = /4/.test(String(d.displayMode || ""));
  // Block Title is the public heading; without one Block Name doubles as it,
  // the way the built §12 model already works
  const title = String(d.title || d.name || "").trim();
  const viewAll = krocOppLink(d.viewAllUrl);

  return (
    <div>
      {(title || viewAll) && (
        <div className="mb-[18px] flex items-baseline justify-between gap-4">
          {title && <h3 className="text-heading-md text-content">{title}</h3>}
          {viewAll && (
            <a
              href={viewAll}
              className="inline-flex flex-none items-center gap-1.5 text-[13px] text-content"
            >
              View All Opportunities <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
            </a>
          )}
        </div>
      )}
      <div className={cx("grid items-stretch gap-4", krocOppCols(fourUp, cards.length))}>
        {cards.map((c, i) => (
          <OppCard key={c.zuid || c.title + i} card={c} />
        ))}
      </div>
    </div>
  );
}
