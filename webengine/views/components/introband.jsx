// IntroBand — block: intro_band.
//
// Three shapes out of one schema, chosen by what the item carries rather than
// by a style flag: a photo splits the card 7fr/5fr, a colour fills a band, and
// `background_color = white` renders the plain prose card that 6.18 Rentals
// ("Host an event at the Kroc") and the other heading-plus-body sections use.
// That last shape is why `[rentals_intro]` was never created as its own model
// — its two fields are a subset of this one's.
//
// Every optional part is guarded on its own value: eyebrow, body, image and
// each CTA. Two of those guards sit on the WRAPPER, not just the contents --
// the CTA row used to render as an empty flex box, so an item with no CTAs
// still paid for the body's bottom margin and sat on dead space, and the photo
// column now collapses the 7fr/5fr grid to one column rather than emitting an
// <img> with an empty src.
//
// The white card carries its own metrics rather than the band's. The design
// pairs it with 44/36 padding and a heading that steps 34px -> 22px on mobile,
// where the colour bands are a separate and roomier design; those bands are
// left exactly as they were, since they are already placed on live pages.
function IntroBand(props) {
  const d = props.data || {};
  const layout = String(d.layout_variant || "").toLowerCase();
  const hasPhoto = layout.indexOf("no") !== 0 && !!d.image;

  // Dropdown option values are not readable from the schema, so normalise
  // whatever arrives ("White", "no_photo") and fall back to the colour band.
  const bg = String(d.background_color || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

  const hasCtas = !!(d.primary_cta_label || d.secondary_cta_label);

  const ctas = (light) => (
    <div className="flex flex-wrap gap-3">
      {d.primary_cta_label && (
        <a
          href={d.primary_cta_url || "#"}
          className={cx("btn", light ? "btn-light" : "btn-primary")}
        >
          {d.primary_cta_label}
        </a>
      )}
      {d.secondary_cta_label && (
        <a
          href={d.secondary_cta_url || "#"}
          className={cx("btn", light ? "btn-outline-light" : "btn-outline-primary")}
        >
          {d.secondary_cta_label}
        </a>
      )}
    </div>
  );

  if (hasPhoto) {
    return (
      <div
        className={cx(
          "grid grid-cols-1 overflow-hidden rounded-card bg-surface",
          d.image ? "lg:grid-cols-[7fr_5fr]" : ""
        )}
      >
        <div className="flex flex-col justify-center px-6 py-8 lg:px-12 lg:py-11">
          {d.eyebrow && (
            <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-primary">
              {d.eyebrow}
            </div>
          )}
          <h3 className="mb-3.5 text-heading-md text-content">{d.title}</h3>
          {d.body && (
            <p
              className={cx(
                "whitespace-pre-line text-[15px] leading-relaxed text-content",
                hasCtas ? "mb-[22px]" : ""
              )}
            >
              {d.body}
            </p>
          )}
          {hasCtas && ctas(false)}
        </div>
        {d.image && (
          <div className="relative min-h-[320px]">
            <img
              src={d.image}
              alt={d.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        )}
      </div>
    );
  }

  // Plain prose card — white surface, ink type, no photo.
  if (bg === "white" || bg === "surface") {
    return (
      <div className="rounded-card bg-surface p-[22px] lg:px-11 lg:py-9">
        <div className="max-w-[820px]">
          {d.eyebrow && (
            <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-primary">
              {d.eyebrow}
            </div>
          )}
          <h3 className="mb-2.5 text-[22px] leading-[1.2] text-content lg:mb-3 lg:text-heading-md lg:leading-[1.25]">
            {d.title}
          </h3>
          {d.body && (
            <p
              className={cx(
                "whitespace-pre-line text-[13px] leading-[1.6] text-content",
                "lg:text-[15px] lg:leading-[1.65]",
                hasCtas ? "mb-6" : ""
              )}
            >
              {d.body}
            </p>
          )}
          {hasCtas && ctas(false)}
        </div>
      </div>
    );
  }

  const bandBg = bg === "navy" ? "bg-secondary" : "bg-primary";
  return (
    <div className={cx("rounded-card px-7 py-9 text-content-ondark lg:px-14 lg:py-12", bandBg)}>
      <div className="max-w-[720px]">
        {d.eyebrow && (
          <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-[rgba(255,255,255,0.72)]">
            {d.eyebrow}
          </div>
        )}
        <h3 className="mb-3.5 text-heading-md">{d.title}</h3>
        {d.body && (
          <p
            className={cx(
              "whitespace-pre-line text-body-lg leading-relaxed text-[rgba(255,255,255,0.85)]",
              hasCtas ? "mb-6" : ""
            )}
          >
            {d.body}
          </p>
        )}
        {hasCtas && ctas(true)}
      </div>
    </div>
  );
}
