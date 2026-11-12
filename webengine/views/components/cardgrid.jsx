// CardGrid — block: card_grid. White cards in a grid, optionally under a
// section heading. Variants so far:
//   "Church Groups"  6.19 Church (Music + Praise / Women's Auxiliary): title,
//                    body and a pill row; filed in the catalog as [church_groups]
//   "Careers Values" 6.20 Careers ("Why work with us?"): an icon band over
//                    title + body; filed as [careers_values]
//   "App & Portal System Cards" 6.23 App & Portal (Community Portal vs Kroc
//                    Connect app): accent bar, eyebrow, title, tagline, a
//                    checklist and a CTA; filed as [appportal_systems]
//
// A general block: both sections are the same
// white-card grid, so the second added its optional Heading and per-card Icon /
// Photo to this model instead of becoming a second model. NOT [featured_cards]
// 7.20, which the catalog named: that is the homepage's class / event / promo
// card block, built on references a repeater can't hold.
//
// Everything is presence-driven:
//   - Heading renders a section head; a headed section also sits 16px lower,
//     because the design spaces headed sections 48px and follow-on rows 32px.
//   - A card with a Photo or an Icon gets the media face ([careers_values]'s
//     ValueCard): a 160px band (140 on mobile) over a 19px title. Photo fills
//     the band full-bleed; otherwise the band is the navy-50 -> area gradient
//     with the icon in a red-50 chip, lower-left. Photo is Erin's ask
//     (💬1871730857, agreed 💬1874933828).
//   - A card with neither keeps the plain face: 28px title, body, pill row.
//   - Pills render on either face.
//   - Eyebrow, Checklist (one item per line) and CTA render on either face;
//     Accent (navy | red) adds the plain face's 6px top bar (5 on mobile) and
//     colours the eyebrow, the checks and the button — the System Card. A card
//     with any of these takes the System Card's body metrics (14.5px / 1.6)
//     and pins its CTA to the card foot. Red text and buttons are red-300
//     #C5000E (#EF3E42 fails AA at 11-13px); the bar and checks keep #EF3E42.
//     Mobile: full-width button, as designed. The catalog listed this block as
//     identical to [careers_values] / [church_groups] (merge note 3), so it
//     joined here rather than becoming [appportal_systems].
//
// The ticket's shapes nest a repeater (Pills inside Items), which Zesty
// disallows, so Pills is Multi Line Text, one pill per line. No Columns field:
// desktop columns follow the card count (1 -> full width, 2 or 4 -> 2-up,
// otherwise 3-up); mobile stacks. Cards keep their repeater order.
//
// Icon and Photo are Media sub-fields, which arrive as bare ZUIDs Parsley can't
// resolve inside a repeater (AGENTS.md §3), so they are resolved in a second
// pass through custom-endpoints/media.json. The icon renders as uploaded: its
// colour comes from the file, not from CSS.
//
// Desktop and mobile are separate designs and both are followed.

// Media values: a resolved URL passes through; a 3-... ZUID needs the lookup.
const krocMediaZuid = (v) => {
  const s = String(v == null ? "" : v).trim();
  return /^3-[0-9a-z]+-[0-9a-z]+$/.test(s) ? s : "";
};
const krocMediaDirectUrl = (v) => {
  const s = String(v == null ? "" : v).trim();
  return /^(https?:)?\/\//.test(s) || s.charAt(0) === "/" ? s : "";
};

// Second-pass resolver: CSV of media ZUIDs -> { zuid: url }. Results are keyed
// by ZUID because the endpoint's order isn't guaranteed.
function useKrocMediaUrls(zuids) {
  const key = zuids.filter(Boolean).sort().join(",");
  const [urls, setUrls] = React.useState({});
  React.useEffect(() => {
    if (!key) {
      return undefined;
    }
    let alive = true;
    fetch("/custom-endpoints/media.json?zuids=" + encodeURIComponent(key))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((res) => {
        if (!alive) {
          return;
        }
        const map = {};
        (res.data || []).forEach((m) => {
          if (m && m.zuid && m.url) {
            map[m.zuid] = m.url;
          }
        });
        setUrls(map);
      })
      .catch((e) => console.warn("KROC card_grid: media lookup failed", e));
    return () => {
      alive = false;
    };
  }, [key]);
  return urls;
}

function CardGrid(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();
  const heading = text(d.heading);

  const cards = []
    .concat(d.cards || [])
    .flat()
    .filter(Boolean)
    .map((c) => ({
      title: text(c.title),
      body: text(c.body),
      pills: text(c.pills)
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      icon: c.icon,
      photo: c.photo,
      eyebrow: text(c.eyebrow),
      accent: text(c.accent).toLowerCase(),
      checklist: text(c.checklist)
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean),
      ctaLabel: text(c.cta_label),
      ctaLink: krocExternalUrl(text(c.cta_link))
    }))
    .filter((c) => c.title || c.body || c.checklist.length > 0);

  const urls = useKrocMediaUrls(
    cards.flatMap((c) => [krocMediaZuid(c.icon), krocMediaZuid(c.photo)])
  );
  const mediaUrl = (v) => krocMediaDirectUrl(v) || urls[krocMediaZuid(v)] || "";

  if (cards.length === 0) {
    return null;
  }

  const n = cards.length;
  const cols = n === 1 ? "" : n % 2 === 0 && n % 3 !== 0 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  const pillRow = (pills) =>
    pills.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {pills.map((p, j) => (
          <span
            key={p + j}
            className="rounded-full bg-surface-muted px-[11px] py-[5px] text-[11.5px] text-content lg:px-3.5 lg:py-1.5 lg:text-[13px]"
          >
            {p}
          </span>
        ))}
      </div>
    );

  const isSystem = (c) => Boolean(c.accent || c.eyebrow || c.checklist.length || c.ctaLabel);
  const accentText = (c) =>
    c.accent === "red"
      ? "text-brand-red-300"
      : c.accent === "navy"
        ? "text-secondary"
        : "text-primary";

  const eyebrowLine = (c) =>
    c.eyebrow && (
      <div
        className={cx(
          "mb-2 text-[11px] tracking-[.14em] uppercase lg:mb-2.5",
          c.accent ? accentText(c) : "text-brand-red-300"
        )}
      >
        {c.eyebrow}
      </div>
    );

  // Checklist + CTA: the System Card's foot. The CTA sits at the card's foot
  // (mt-auto) so two cards' buttons line up.
  const systemFoot = (c) => (
    <React.Fragment>
      {c.checklist.length > 0 && (
        <div className={cx(c.ctaLabel && "mb-4 lg:mb-6")}>
          <CheckList items={c.checklist} tone={c.accent === "navy" ? "navy" : "red"} />
        </div>
      )}
      {c.ctaLabel && (
        <a
          href={c.ctaLink || undefined}
          className={cx(
            "btn btn-sm mt-auto w-full lg:w-auto lg:self-start",
            c.accent === "red"
              ? "btn-primary bg-brand-red-300 hover:bg-brand-red-300/90"
              : "btn-secondary"
          )}
        >
          <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
          {c.ctaLabel}
        </a>
      )}
    </React.Fragment>
  );

  const plainCard = (c, i) => {
    const sys = isSystem(c);
    return (
      <div
        key={c.title + i}
        className={cx(
          "flex flex-col overflow-hidden rounded-card bg-surface",
          !c.accent && "p-[22px] lg:px-9 lg:py-8"
        )}
      >
        {c.accent && (
          <div
            className={cx(
              "h-[5px] flex-none lg:h-1.5",
              c.accent === "red" ? "bg-primary" : "bg-secondary"
            )}
          ></div>
        )}
        <div className={cx("flex flex-1 flex-col", c.accent && "p-5 lg:px-8 lg:pt-7 lg:pb-8")}>
          {eyebrowLine(c)}
          {c.title && (
            <h3
              className={cx(
                "text-[19px] leading-[1.25] text-content lg:text-heading-sm lg:leading-[1.3]",
                sys ? "mb-1.5 lg:mb-2" : "mb-2 lg:mb-2.5"
              )}
            >
              {c.title}
            </h3>
          )}
          {c.body && (
            <p
              className={cx(
                "whitespace-pre-line text-[13px] text-content-muted",
                sys ? "leading-[1.6] lg:text-[14.5px]" : "leading-[1.55] lg:text-[14px]",
                (c.pills.length > 0 || c.checklist.length > 0 || c.ctaLabel) &&
                  (sys ? "mb-3.5 lg:mb-5" : "mb-3 lg:mb-4")
              )}
            >
              {c.body}
            </p>
          )}
          {pillRow(c.pills)}
          {systemFoot(c)}
        </div>
      </div>
    );
  };

  const mediaCard = (c, i) => {
    const photo = mediaUrl(c.photo);
    const icon = mediaUrl(c.icon);
    return (
      <div key={c.title + i} className="flex flex-col overflow-hidden rounded-card bg-surface">
        {c.photo ? (
          <div className="h-[140px] flex-none bg-surface-muted lg:h-40">
            {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
          </div>
        ) : (
          <div className="flex h-[140px] flex-none items-end bg-[linear-gradient(135deg,var(--color-brand-navy-50)_0%,var(--color-brand-area)_100%)] px-5 pb-5 lg:h-40 lg:px-[26px] lg:pb-[26px]">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-red-50 lg:h-12 lg:w-12">
              {icon && (
                <img src={icon} alt="" className="h-[22px] w-[22px] object-contain lg:h-6 lg:w-6" />
              )}
            </span>
          </div>
        )}
        <div className="flex flex-1 flex-col px-5 pt-4 pb-5 lg:px-[26px] lg:pt-5 lg:pb-7">
          {eyebrowLine(c)}
          {c.title && (
            <h3 className="mb-1.5 text-[19px] leading-[1.25] text-content lg:mb-2 lg:font-medium">
              {c.title}
            </h3>
          )}
          {c.body && (
            <p
              className={cx(
                "whitespace-pre-line text-[13px] leading-[1.6] text-content-muted lg:min-h-[90px] lg:text-[14px]",
                (c.pills.length > 0 || c.checklist.length > 0 || c.ctaLabel) && "mb-3 lg:mb-4"
              )}
            >
              {c.body}
            </p>
          )}
          {pillRow(c.pills)}
          {systemFoot(c)}
        </div>
      </div>
    );
  };

  return (
    <div className={cx(heading && "lg:pt-4")}>
      {heading && (
        <h2 className="mb-3.5 text-[22px] leading-[1.2] text-content lg:mb-[18px] lg:text-heading-md lg:leading-[1.25]">
          {heading}
        </h2>
      )}
      <div className={cx("grid grid-cols-1 gap-3.5 lg:gap-4", cols)}>
        {cards.map((c, i) => (c.icon || c.photo ? mediaCard(c, i) : plainCard(c, i)))}
      </div>
    </div>
  );
}
