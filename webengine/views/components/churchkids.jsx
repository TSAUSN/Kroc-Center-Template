// ChurchKids — block: church_kids (blocks catalog §3.5). The "K.R.O.C. Kids"
// card on 6.19 Church: eyebrow, heading, register CTA and body, then a row of
// troop pills beside a stack of tinted award-ceremony boxes.
//
// Pills and tinted boxes are why this is a block and not Page Content: a
// WYSIWYG can't author either.
//
// Desktop and mobile are separate designs and both are followed:
//   - the CTA sits TOP RIGHT of the heading on desktop and at the BOTTOM of
//     the card on mobile. It is rendered twice, one copy per surface, and both
//     hide with display:none, so only one is ever in the accessibility tree;
//   - troops and awards sit side by side in a 7fr/5fr grid on desktop and
//     stack on mobile.
// Either half is presence-driven: without awards the troops take the full
// width, and the other way round. A sub-heading only renders when filled.
//
// Tone picks an award box's tint: red is brand-red-50 #FFEBEB, amber is the
// design's #FFF6E8 (a tint of brand-amber with no token of its own). An empty
// or unknown tone alternates red, amber in row order -- the design's sequence.
//
// The eyebrow is drawn in red-300 #C5000E, not the design's --kroc-red
// #EF3E42: that red on white is 3.86:1 and fails AA for 11px text, where
// red-300 is 6.21:1. Same substitution as [hero] and [church_ministries].
// Muted copy uses text-content-muted, which IS the design's #575757 (7.23:1).
//
// Loads after featuredpages.jsx (krocExternalUrl).
const KROC_KIDS_TONE = {
  red: "bg-brand-red-50",
  amber: "bg-[#fff6e8]"
};

function ChurchKids(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();
  const rows = (v) =>
    []
      .concat(v || [])
      .flat()
      .filter(Boolean);

  const eyebrow = text(d.eyebrow);
  const heading = text(d.heading);
  const body = text(d.body);
  const ctaLabel = text(d.ctaLabel);
  const ctaUrl = krocExternalUrl(d.ctaLink);
  const troopsHeading = text(d.troopsHeading);
  const awardsHeading = text(d.awardsHeading);

  const troops = rows(d.troops)
    .map((r) => text(r.label))
    .filter(Boolean);
  const tones = Object.keys(KROC_KIDS_TONE);
  const awards = rows(d.awards)
    .map((r) => ({
      title: text(r.title),
      description: text(r.description),
      tone: text(r.tone).toLowerCase()
    }))
    .filter((r) => r.title || r.description)
    .map((r, i) => ({ ...r, bg: KROC_KIDS_TONE[r.tone] || KROC_KIDS_TONE[tones[i % 2]] }));

  const hasTroops = troops.length > 0;
  const hasAwards = awards.length > 0;

  if (!heading && !body && !hasTroops && !hasAwards) {
    return null;
  }

  const subHead = "mb-2 text-[13px] leading-normal font-medium text-content-muted lg:mb-2.5";
  const cta = (className) =>
    ctaLabel && (
      <a href={ctaUrl || undefined} className={cx("btn btn-secondary btn-sm", className)}>
        {ctaLabel}
      </a>
    );

  const troopsCol = hasTroops && (
    <div>
      {troopsHeading && <div className={subHead}>{troopsHeading}</div>}
      <div className="flex flex-wrap gap-1.5 lg:gap-2">
        {troops.map((t, i) => (
          <span
            key={t + i}
            className="rounded-full bg-surface-muted px-[11px] py-[5px] text-[11.5px] text-content lg:px-3.5 lg:py-1.5 lg:text-[13px]"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );

  const awardsCol = hasAwards && (
    <div>
      {awardsHeading && <div className={subHead}>{awardsHeading}</div>}
      <div className="flex flex-col gap-2.5">
        {awards.map((a, i) => (
          <div key={a.title + i} className={cx("rounded-xl px-4 py-3", a.bg)}>
            {a.title && (
              <div className="text-[13px] leading-normal font-medium text-content lg:text-[14px]">
                {a.title}
              </div>
            )}
            {a.description && (
              <div className="text-[11.5px] leading-[1.45] text-content-muted lg:text-[12.5px] lg:leading-normal">
                {a.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-card bg-surface p-[22px] lg:px-12 lg:py-10">
      <div className="lg:mb-2 lg:flex lg:flex-wrap lg:items-baseline lg:justify-between lg:gap-4">
        <div>
          {eyebrow && (
            <div className="mb-2 text-[11px] tracking-[.14em] text-brand-red-300 uppercase">
              {eyebrow}
            </div>
          )}
          {heading && (
            <h2 className="mb-2.5 text-[22px] leading-[1.2] text-content lg:mb-0 lg:text-heading-md lg:leading-[1.25]">
              {heading}
            </h2>
          )}
        </div>
        {cta("hidden lg:inline-flex")}
      </div>
      {body && (
        <p className="mb-4 whitespace-pre-line text-[13px] leading-[1.6] text-content lg:mt-1.5 lg:mb-6 lg:max-w-[760px] lg:text-[14.5px]">
          {body}
        </p>
      )}
      {(hasTroops || hasAwards) && (
        <div
          className={cx(
            "grid grid-cols-1 gap-[18px]",
            hasTroops && hasAwards && "lg:grid-cols-[7fr_5fr] lg:gap-8"
          )}
        >
          {troopsCol}
          {awardsCol}
        </div>
      )}
      {ctaLabel && <div className="mt-3.5 lg:hidden">{cta()}</div>}
    </div>
  );
}
