// ServiceBand — block: service_band (v5 V4, catalog 7.22). One named service
// on a colour band: photo · copy · rates panel. First variant: "Membership
// PlayCare" (6.15, ages 6 months – 11 years, drop-in rates).
//
// The service's name is content, not a heading string (morgan: "every Kroc
// calls this something different, such as Child Watch or Kroc Kids"), so one
// block serves every centre. Built 2026-11-09 with v5's fields, minus what
// nothing uses:
//   - only the 3-up layout (no photo-background / colour variants);
//   - no Ink field: the colours offered are the dark ones that pass AA with
//     white ink (X8). Purple is #652C90 (white 9.07:1; the 70% panel label on
//     the 8% panel 4.54:1); navy has headroom. Red-300 was left out because
//     its 70% white labels fall to 3.46:1;
//   - CTAs are a fixed pair, like every other block here.
// The Rates Panel is a top-level repeater {Label, Value} plus a label and CTA,
// with no media in the repeater (X11).
//
// Presence-driven: no panel rows, no panel; no photo, no photo column. Desktop
// and mobile are separate designs and both are followed. On desktop the photo
// sits left (or right, Photo Side), with the copy in the middle and the panel on
// the far side. The DOM order is copy, panel, photo, so the name is read before
// the prices, and the grid places them. On mobile, the photo comes first, then
// the copy with full-width buttons, then the panel.
//
// Loads after catalog.jsx (krocExternalUrl).
const KROC_SERVICE_BG = { purple: "bg-[#652c90]", navy: "bg-secondary" };

function ServiceBand(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const name = text(d.name);
  const eyebrow = text(d.eyebrow);
  const bodyHtml = text(d.body);
  const hasBody = bodyHtml.replace(/<[^>]*>|&nbsp;/g, "").trim() !== "";
  const bodyMarkup = { __html: bodyHtml };
  const photo = text(d.photo);
  const right = text(d.photoSide).toLowerCase() === "right";
  const bg = KROC_SERVICE_BG[text(d.backgroundColor).toLowerCase()] || KROC_SERVICE_BG.purple;
  const ctas = [
    { label: text(d.primaryLabel), link: krocExternalUrl(text(d.primaryLink)), light: true },
    { label: text(d.secondaryLabel), link: krocExternalUrl(text(d.secondaryLink)), light: false }
  ].filter((c) => c.label);
  const rows = []
    .concat(d.panelRows || [])
    .flat()
    .filter(Boolean)
    .map((r) => ({ key: text(r.key), value: text(r.value) }))
    .filter((r) => r.key || r.value);
  const panel = {
    label: text(d.panelLabel),
    cta: text(d.panelCtaLabel),
    link: krocExternalUrl(text(d.panelCtaLink))
  };
  const hasPanel = rows.length > 0;

  if (!name && !hasBody) {
    return null;
  }

  // Desktop tracks and grid placement for each combination (literal strings so
  // Tailwind compiles them).
  let cols = "";
  let place = { copy: "", panel: "", photo: "" };
  if (photo && hasPanel) {
    cols = right ? "lg:grid-cols-[300px_1fr_340px]" : "lg:grid-cols-[340px_1fr_300px]";
    place = right
      ? { copy: "lg:col-start-2", panel: "lg:col-start-1", photo: "lg:col-start-3" }
      : { copy: "lg:col-start-2", panel: "lg:col-start-3", photo: "lg:col-start-1" };
  } else if (photo) {
    cols = right ? "lg:grid-cols-[1fr_340px]" : "lg:grid-cols-[340px_1fr]";
    place = right
      ? { copy: "lg:col-start-1", panel: "", photo: "lg:col-start-2" }
      : { copy: "lg:col-start-2", panel: "", photo: "lg:col-start-1" };
  } else if (hasPanel) {
    cols = "lg:grid-cols-[1fr_300px]";
    place = { copy: "lg:col-start-1", panel: "lg:col-start-2", photo: "" };
  }

  return (
    <div
      className={cx(
        "grid grid-cols-1 gap-4 rounded-card px-6 py-[30px] text-content-ondark lg:items-center lg:gap-8 lg:px-10 lg:py-9",
        bg,
        cols
      )}
    >
      <div className={cx("lg:row-start-1", place.copy)}>
        {eyebrow && (
          <div className="mb-2 text-[11px] font-medium tracking-[.14em] text-white/[0.72] uppercase lg:mb-3 lg:text-[12px]">
            {eyebrow}
          </div>
        )}
        {name && (
          <h3 className="mb-2.5 text-[27px] leading-[1.12] lg:mb-3.5 lg:text-heading-md lg:leading-[1.25]">
            {name}
          </h3>
        )}
        {hasBody && (
          <div
            className={cx(
              "kroc-prose text-[13px] leading-[1.6] text-white/85 lg:text-[15px] [&_a]:text-white [&_p]:mb-2.5 [&_p:last-child]:mb-0",
              ctas.length > 0 && "mb-[18px] lg:mb-6"
            )}
            dangerouslySetInnerHTML={bodyMarkup}
          ></div>
        )}
        {ctas.length > 0 && (
          <div className="grid gap-2 lg:flex lg:flex-wrap lg:gap-3">
            {ctas.map((c) => (
              <a
                key={c.label}
                href={c.link || undefined}
                className={cx("btn", c.light ? "btn-light" : "btn-outline-light")}
              >
                {c.label}
              </a>
            ))}
          </div>
        )}
      </div>
      {hasPanel && (
        <div
          className={cx(
            "rounded-[14px] bg-white/[0.08] px-5 py-[18px] lg:row-start-1 lg:rounded-2xl lg:px-7 lg:py-6",
            place.panel
          )}
        >
          {panel.label && (
            <div className="mb-2.5 text-[11px] tracking-[.12em] text-white/70 uppercase lg:mb-3">
              {panel.label}
            </div>
          )}
          <dl className="m-0">
            {rows.map((r, i) => (
              <div
                key={r.key + i}
                className={cx(
                  "flex justify-between gap-3 py-[7px] text-[14px] lg:py-2",
                  i < rows.length - 1 && "border-b border-white/[0.16]"
                )}
              >
                <dt>{r.key}</dt>
                <dd className="m-0 font-medium">{r.value}</dd>
              </div>
            ))}
          </dl>
          {panel.cta && (
            <a
              href={panel.link || undefined}
              className="btn btn-light btn-sm mt-3.5 w-full lg:mt-[18px]"
            >
              {panel.cta}
            </a>
          )}
        </div>
      )}
      {photo && (
        <div
          className={cx(
            "relative order-first aspect-[4/3] overflow-hidden rounded-xl bg-white/10 lg:order-none lg:row-start-1 lg:rounded-2xl",
            place.photo
          )}
        >
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}
