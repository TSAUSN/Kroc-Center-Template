// CardGrid — block: card_grid. White cards in a grid, optionally under a
// section heading. Variants so far:
//   "Church Groups"  6.19 Church (Music + Praise / Women's Auxiliary): title,
//                    body and a pill row; filed in the catalog as [church_groups]
//   "Careers Values" 6.20 Careers ("Why work with us?"): an icon band over
//                    title + body; filed as [careers_values]
//
// A general block, decided 2026-10-05 (Japheth): both sections are the same
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
//     (2026-08-04, 💬1871730857, agreed 💬1874933828).
//   - A card with neither keeps the plain face: 28px title, body, pill row.
//   - Pills render on either face.
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
      photo: c.photo
    }))
    .filter((c) => c.title || c.body);

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

  const plainCard = (c, i) => (
    <div key={c.title + i} className="rounded-card bg-surface p-[22px] lg:px-9 lg:py-8">
      {c.title && (
        <h3 className="mb-2 text-[19px] leading-[1.25] text-content lg:mb-2.5 lg:text-heading-sm lg:leading-[1.3]">
          {c.title}
        </h3>
      )}
      {c.body && (
        <p
          className={cx(
            "whitespace-pre-line text-[13px] leading-[1.55] text-content-muted lg:text-[14px]",
            c.pills.length > 0 && "mb-3 lg:mb-4"
          )}
        >
          {c.body}
        </p>
      )}
      {pillRow(c.pills)}
    </div>
  );

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
          {c.title && (
            <h3 className="mb-1.5 text-[19px] leading-[1.25] text-content lg:mb-2 lg:font-medium">
              {c.title}
            </h3>
          )}
          {c.body && (
            <p
              className={cx(
                "whitespace-pre-line text-[13px] leading-[1.6] text-content-muted lg:min-h-[90px] lg:text-[14px]",
                c.pills.length > 0 && "mb-3 lg:mb-4"
              )}
            >
              {c.body}
            </p>
          )}
          {pillRow(c.pills)}
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
