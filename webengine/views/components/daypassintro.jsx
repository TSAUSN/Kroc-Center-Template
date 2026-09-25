// DayPassIntroBand — block: day_pass_intro_band (blocks catalog §3.2, where
// the model is called `[daypass_intro_band]` — the Zesty ref ID has the
// underscore). Green band on 6.16 Day Pass: title, three rich-text paragraphs,
// two CTAs. No eyebrow — the design has none.
//
// The catalog flags "green palette value still pending". It is not: the design
// renders `--kroc-success` #12825F, which is already `--color-brand-green` ->
// `--ui-success` here, i.e. `bg-success`. What was pending is the *other*
// green, the expanded palette's #8DC63F, which fails AA on white body text at
// 2.04:1. #12825F clears it at 4.79:1, so the band keeps white ink and needs
// no X8 Ink control. Background is not a field for the same reason it is not
// one on [membership_benefits_band]: one background in the design, nothing on
// record asking for a control.
//
// Body is WYSIWYG because the inline bold ("does not include ice skating") is
// content. It borrows `.kroc-prose` for paragraph rhythm — that class sits in
// @layer components, so the utilities here win and repaint it for a dark
// background, links included (untouched, .kroc-prose would put navy links on
// the green).
//
// Body ink is PURE white, not the prototype's rgba(255,255,255,.92). Measured
// off the render: 92% white composites to #E8F3F0 on this green = 4.31:1,
// under AA; pure white is 4.79:1. Imperceptible change, and it is the whole
// margin. The navy bands are not affected — 85% white on navy is 11.59:1.
//
// Loads after catalog.jsx (krocExternalUrl).
function DayPassIntroBand(props) {
  const d = props.data || {};

  const ctas = [
    { label: d.primaryCtaLabel, url: d.primaryCtaUrl, className: "btn-light" },
    { label: d.secondaryCtaLabel, url: d.secondaryCtaUrl, className: "btn-outline-light" }
  ].filter((c) => c.label);

  // A band with no title is an unfinished block, not an empty state.
  if (!d.title) {
    return null;
  }

  return (
    <div className="rounded-card bg-success px-7 py-9 text-content-ondark lg:px-12 lg:py-11">
      <h3 className="mb-4 text-heading-md">{d.title}</h3>
      {d.bodyHtml && d.bodyHtml.__html && (
        <div
          className="kroc-prose mb-6 max-w-220 text-content-ondark [&_a]:border-white/60 [&_a]:text-white [&_p:last-child]:mb-0"
          dangerouslySetInnerHTML={d.bodyHtml}
        ></div>
      )}
      {ctas.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {ctas.map((c) => (
            <a
              key={c.label}
              href={krocExternalUrl(c.url) || "#"}
              className={cx("btn", c.className)}
            >
              {c.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
