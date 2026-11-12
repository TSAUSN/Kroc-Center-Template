const krocFormatDate = (s) => {
  if (!s) {
    return "";
  }
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d.getTime())) {
    return String(s);
  }
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

// toJson() resolves media/relationship fields to { type, totalItems, data: [...] }
const krocFirstOf = (field) => (field && field.data && field.data.length ? field.data[0] : null);

// { item: <story toJson()>, url } -> StoryCard props.card
const krocStoryToCard = (row) => {
  const it = row.item || {};
  const thumb = krocFirstOf(it.story_image_thumbnail) || krocFirstOf(it.story_image_desktop);
  const category = krocFirstOf(it.related_program_category);
  return {
    zuid: it.zuid || "",
    title: it.title,
    date: krocFormatDate(it.story_date),
    author: it.author,
    excerpt: it.story_excerpt,
    ctaLabel: it.story_cta_label,
    category: category ? category.category_name : "",
    image: thumb && thumb.url ? thumb.url + "?width=800" : "",
    url: row.url
  };
};

function StoryCard(props) {
  const c = props.card;
  return (
    <div className="flex flex-col overflow-hidden rounded-card bg-surface">
      <div className="relative aspect-video w-full bg-surface-muted">
        {c.image && (
          <img
            src={c.image}
            alt={c.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-[rgba(28,27,31,0.5)] to-[rgba(28,27,31,0.1)]"></div>
        {c.category && (
          <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white px-[11px] py-[5px] text-[12px] text-content">
            <span className="h-3.5 w-3.5 flex-none rounded-[3px] bg-primary"></span>{" "}
            {/*logo placeholder*/}
            {c.category}
          </span>
        )}
        <div className="absolute inset-x-4 bottom-3 z-10 flex justify-between gap-3 text-[12px] text-white">
          <span>{c.date}</span>
          {c.author && <span>By {c.author}</span>}
        </div>
      </div>
      <div className="px-6 pb-4 pt-5">
        <h3 className="mb-2 text-[20px] leading-[1.3] text-content">{c.title}</h3>
        {c.excerpt && (
          <p className="line-clamp-3 text-[13.5px] leading-[1.55] text-content">{c.excerpt}</p>
        )}
      </div>
      <div className="mt-auto px-6 pb-6">
        <a href={c.url || "#"} className="btn btn-secondary btn-sm btn-block">
          <Icon className="h-3.5 w-3.5" id="#i-arrowur" /> {c.ctaLabel || "Read Article"}
        </a>
      </div>
    </div>
  );
}

function CarouselArrow(props) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.label}
      className="inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full bg-surface text-content shadow-card transition disabled:cursor-default disabled:opacity-40"
    >
      <Icon className={cx("h-4 w-4", props.dir < 0 ? "rotate-90" : "-rotate-90")} id="#i-chev" />
    </button>
  );
}

// Horizontal story rail. Card widths are sized so a full row exactly fills the
// track (3-up on desktop, 2-up on tablet, ~1 + peek on mobile); anything beyond
// that overflows and the prev/next controls appear. So 3 cards read as a static
// row on desktop while 4+ become a scrollable carousel — no display-mode flag.
function StoryCarousel(props) {
  const cards = props.cards || [];
  const trackRef = React.useRef(null);
  const [nav, setNav] = React.useState({ overflow: false, atStart: true, atEnd: false });

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      setNav({
        overflow: el.scrollWidth > el.clientWidth + 1,
        atStart: el.scrollLeft <= 1,
        atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [cards.length]);

  const scroll = (dir) => {
    const el = trackRef.current;
    if (el) {
      el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
    }
  };

  if (!cards.length) {
    return null;
  }

  return (
    <div>
      <div className="mb-[18px] flex items-baseline justify-between gap-4">
        <h3 className="text-heading-md text-content">{props.title}</h3>
        {props.action}
      </div>
      <div className="relative">
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 scrollbar-none"
        >
          {cards.map((c) => (
            <div
              key={c.zuid || c.title}
              className="basis-[85%] flex-none snap-start sm:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2rem)/3)]"
            >
              <StoryCard card={c} />
            </div>
          ))}
        </div>
        {nav.overflow && (
          <React.Fragment>
            <div className="absolute left-2 top-1/2 z-10 -translate-y-1/2">
              <CarouselArrow
                dir={-1}
                label="Previous stories"
                disabled={nav.atStart}
                onClick={() => scroll(-1)}
              />
            </div>
            <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
              <CarouselArrow
                dir={1}
                label="Next stories"
                disabled={nav.atEnd}
                onClick={() => scroll(1)}
              />
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

// Volunteer opportunity card (prototype OppCard / B_FeaturedVolunteerOpps):
// 16:9 hero, title, muted mono dateline, 3-line excerpt, secondary CTA. With
// no hero a tinted panel of the same footprint keeps the row aligned.
// card = { title, dateline, excerpt, ctaLabel, url, image }
function OppCard(props) {
  const c = props.card;
  return (
    <div className="flex flex-col overflow-hidden rounded-card bg-surface">
      {c.image ? (
        <img
          src={c.image}
          alt={c.title}
          className="aspect-video w-full bg-surface-muted object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-secondary-subtle text-secondary">
          <Icon className="h-[54px] w-[54px]" id="#i-users" />
        </div>
      )}
      <div className="flex flex-1 flex-col px-[22px] pb-[22px] pt-[18px]">
        <h3 className="mb-1 text-[17px] leading-[1.3] text-content">{c.title}</h3>
        {c.dateline && (
          <div className="mb-2 font-mono text-[12.5px] tracking-[0.02em] text-content-muted">
            {c.dateline}
          </div>
        )}
        {c.excerpt && (
          <p className="mb-3.5 line-clamp-3 text-[13.5px] leading-[1.5] text-content">
            {c.excerpt}
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

// Membership tier row (prototype TierCard / Figma `Card · Membership` 424:531):
// compact row, name + age note left, rate + period right. No CTA and no
// eyebrow — the Figma master has neither, so the v5 §21 per-tier CTA fields
// were modelled for a card that was never designed.
// Content is vertically centred per quick-win A1 (Miranda Tsadilas, 2026-07-30)
// — the prototype's original `align-items: baseline` was the reported bug.
//
// Price is 28px, NOT the design's 24px — a deliberate deviation, asked for
// 2026-09-10. Root cause of "the price looks small": these rows render 86.5px
// tall against the Figma master's 360x70, because the design's tight Figma
// leading becomes line-height 1.5 in CSS. `leading-none` keeps the larger
// price from growing the row further. Tightening the left block's leading is
// the other half of that fix and has NOT been done.
// card = { name, note, price (preformatted), period }
function TierCard(props) {
  const c = props.card;
  return (
    <div className="flex flex-row items-center justify-between gap-3 rounded-card bg-surface px-[22px] py-5">
      <div>
        <div className="mb-0.5 text-[17px] text-content">{c.name}</div>
        {c.note && <div className="text-[12.5px] text-content-muted">{c.note}</div>}
      </div>
      {c.price && (
        <div className="whitespace-nowrap text-right">
          <span className="text-[28px] leading-none text-secondary">{c.price}</span>
          {c.period && <span className="text-[12.5px] text-content-muted">{c.period}</span>}
        </div>
      )}
    </div>
  );
}

// Day Pass card (prototype Page_DayPass / Figma `Card · Day Pass` 424:4492):
// centred stack — "<Audience> <Label>", a large navy price, an age note, and
// its own Purchase CTA. Sibling of TierCard: that one is a compact priced row,
// this is the big centred card.
// card = { audience, label, price (preformatted), ages, ctaLabel, ctaUrl }
function PassCard(props) {
  const c = props.card;
  return (
    <div className="flex flex-col items-center rounded-card bg-surface px-10 py-11 text-center">
      <div className="mb-1.5 text-[26px] text-content">
        <strong className="font-semibold">{c.audience}</strong>
        {c.label ? " " + c.label : ""}
      </div>
      {c.price && (
        <div className="mb-1 mt-1.5 text-[64px] leading-none text-secondary">{c.price}</div>
      )}
      {c.ages && <div className="mb-6 text-[14px] text-content-muted">{c.ages}</div>}
      {c.ctaLabel && c.ctaUrl && (
        <a href={c.ctaUrl} className="btn btn-primary btn-lg mt-auto">
          {c.ctaLabel}
        </a>
      )}
    </div>
  );
}
