// CareersApply — block: careers_apply (blocks catalog §3.6, ticket 2460). The
// "How to Apply" card on 6.20 Careers, plus the red "Text to Apply" card
// beside it.
//
// ONE block for what the catalog filed as two ([careers_apply] +
// [careers_text_apply], merged), on the [church_ministries]
// precedent: the desktop design draws both in a single 7fr/5fr row and mobile
// stacks them, which two separately placed blocks can't express. Field names
// carry their half (`text_apply_*`), like `prayer_request_*` there.
//
// The red half is presence-driven: its keyword or shortcode opens the 7fr/5fr
// grid; without either, How to Apply runs full width. Either half alone takes
// the full width. Background (X4) is not a field — the card is red on both
// surfaces and nobody asked for a control (the standing rule).
//
// KrocSmsCard is its own component because the Hours page draws the same card
// ("Closure Alerts — Text KROCINFO") beside its hours card; [hours_general]
// renders it with variant="alerts": a heading (desktop only, as designed), a
// CTA, the keyword in bold rather than quoted, and left-aligned on desktop
// (centred on mobile, like this one).
//
// Contrast deviations from the design, both for AA on small white text:
//   - the card is red-300 #C5000E, not --kroc-red #EF3E42 (3.86:1 fails at
//     11-15px; red-300 is 6.21:1) — same substitution as [hero] and
//     [church_connect_links];
//   - the eyebrow and "to …" line are 90% white, not the design's 80%: 80% on
//     red-300 is ~4.25:1 and fails at 11px; 90% is ~5.15:1.
//
// Body is WYSIWYG (per the ticket) through .kroc-prose, resized to the
// design's 13px (mobile) / 14.5px (desktop). Desktop and mobile are separate
// designs and both are followed.
function KrocSmsCard(props) {
  const text = (v) => String(v == null ? "" : v).trim();
  const eyebrow = text(props.eyebrow);
  const keyword = text(props.keyword);
  const shortcode = text(props.shortcode);
  const alerts = props.variant === "alerts";
  const heading = alerts ? text(props.heading) : "";
  const ctaLabel = alerts ? text(props.ctaLabel) : "";
  const ctaLink = text(props.ctaLink);

  if (!keyword && !shortcode) {
    return null;
  }

  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-card bg-brand-red-300 px-6 py-[30px] text-center text-content-ondark lg:px-9 lg:py-8",
        alerts && "lg:items-start lg:text-left"
      )}
    >
      {eyebrow && (
        <div
          className={cx(
            "mb-1.5 text-[11px] tracking-[.14em] text-white/90 uppercase",
            alerts ? "lg:mb-2.5" : "lg:mb-2"
          )}
        >
          {eyebrow}
        </div>
      )}
      {heading && (
        <h3 className="mb-3 hidden text-heading-sm leading-[1.3] text-content-ondark lg:block">
          {heading}
        </h3>
      )}
      {keyword && alerts && (
        <div className="mb-0.5 text-[20px] leading-[1.25] lg:mb-1 lg:text-[21px]">
          Text <strong className="font-semibold">{keyword}</strong>
        </div>
      )}
      {keyword && !alerts && (
        <div className="mb-0.5 text-[21px] leading-[1.25] lg:mb-1 lg:text-[24px]">
          {'Text "' + keyword + '"'}
        </div>
      )}
      {shortcode && (
        <div className="text-[15px] leading-normal text-white/90">
          to <strong className="font-semibold">{shortcode}</strong>
        </div>
      )}
      {ctaLabel && (
        <a
          href={krocExternalUrl(ctaLink) || undefined}
          className="btn btn-light btn-sm mt-3.5 w-full lg:mt-5 lg:w-auto"
        >
          {ctaLabel}
        </a>
      )}
    </div>
  );
}

function CareersApply(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const heading = text(d.heading);
  const bodyHtml = text(d.body);
  // An emptied WYSIWYG can still hold "<p></p>"; treat tag-only as empty.
  const hasBody = bodyHtml.replace(/<[^>]*>|&nbsp;/g, "").trim() !== "";
  const hasApply = Boolean(heading || hasBody);
  const bodyMarkup = { __html: bodyHtml };

  const sms = (
    <KrocSmsCard eyebrow={d.smsEyebrow} keyword={d.smsKeyword} shortcode={d.smsShortcode} />
  );
  const hasSms = Boolean(text(d.smsKeyword) || text(d.smsShortcode));

  if (!hasApply && !hasSms) {
    return null;
  }

  const apply = hasApply && (
    <div className="rounded-card bg-surface p-[22px] lg:px-9 lg:py-8">
      {heading && (
        <h3
          className={cx(
            "text-[19px] leading-[1.25] text-content lg:text-heading-sm lg:leading-[1.3]",
            hasBody && "mb-2 lg:mb-2.5"
          )}
        >
          {heading}
        </h3>
      )}
      {hasBody && (
        <div
          className="kroc-prose text-[13px] leading-[1.6] lg:text-[14.5px] lg:leading-[1.65] [&_p]:mb-2.5 [&_p:last-child]:mb-0"
          dangerouslySetInnerHTML={bodyMarkup}
        ></div>
      )}
    </div>
  );

  if (hasApply && hasSms) {
    return (
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[7fr_5fr] lg:items-stretch lg:gap-4">
        {apply}
        {sms}
      </div>
    );
  }

  return apply || sms;
}
