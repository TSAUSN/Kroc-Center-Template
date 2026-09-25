// AboutImpact — block: about_impact (blocks catalog §3.3). "Our Impact" on
// 6.17 About Us: a photo-backed stat card (5fr) beside a white narrative card
// (7fr) carrying a Donate CTA and the social row.
//
// The section survives the "Remove Impact" decision in meeting_notes.md —
// that one is scoped to the HOMEPAGE ("exclude the our impact section from the
// final homepage layout … not present in other project site examples"). This
// section is still in v4/v5 §39 and in both Figma syncs.
//
// Stat value and caption are real text, not a baked-in graphic. The reference
// site ships its "1 in 3" as a JPEG, which no screen reader can read and no
// editor can change; the catalog calls that out on [donate_impact] and the
// same reasoning applies here.
//
// No "Show Social Row" boolean though the catalog lists one — nobody asked for
// it, and the row already renders from globals.social_handles (the footer's
// source), so a center with no handles shows nothing without needing a toggle.
// If [about_impact] and [donate_impact] are ever merged, that is when a toggle
// earns its place.
//
// Section Title is a field the catalog missed: the design puts a SectionHead
// above both cards on desktop AND mobile, and [featured_pages] / [people]
// already carry a `title` for exactly that.
//
// Section-head leading is explicit (1.2 / 1.25) because the type token pairs
// 34px with a 48px line box, while the design pairs it with 42.5px. On a
// one-line head that is a ~5px spacing difference, not a wrap difference.
// [featured_pages] and [people] use the bare token and so sit ~5px looser than
// the design; left alone here rather than changed under an unrelated ticket.
//
// Desktop and mobile are separate designs, both followed: 5fr/7fr + 54px stat
// + 28px heading + 40x44 padding above lg; stacked + 46px + 19px + 22px below.
//
// Loads after shared.jsx (cx, SocialLinks, SOCIAL_LINKS) and catalog.jsx
// (krocExternalUrl).
function AboutImpact(props) {
  const d = props.data || {};

  // A card with no heading is an unfinished block, not an empty state.
  if (!d.heading) {
    return null;
  }

  const hasStat = Boolean(d.statValue || d.statCaption || d.image);
  const ctaUrl = krocExternalUrl(d.ctaUrl);
  const hasSocial = typeof SOCIAL_LINKS !== "undefined" && SOCIAL_LINKS.length > 0;

  return (
    <div>
      {d.sectionTitle && (
        <h3 className="mb-3.5 text-[22px] leading-[1.2] text-content lg:mb-[18px] lg:text-heading-md lg:leading-[1.25]">
          {d.sectionTitle}
        </h3>
      )}

      <div className={cx("grid grid-cols-1 gap-3 lg:gap-4", hasStat && "lg:grid-cols-[5fr_7fr]")}>
        {hasStat && (
          <div className="relative min-h-55 overflow-hidden rounded-card bg-brand-ink lg:min-h-75">
            {d.image && (
              <img
                src={d.image}
                alt={d.imageAlt || ""}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            {/* Bottom-weighted scrim: the stat sits low in the card, so the
                gradient only has to darken the lower half */}
            <div className="absolute inset-0 bg-linear-to-b from-black/25 to-black/70"></div>
            <div className="absolute right-[22px] bottom-5 left-[22px] lg:right-8 lg:bottom-7 lg:left-8">
              {d.statValue && (
                <div className="text-[46px] leading-none text-content-ondark lg:text-[54px]">
                  {d.statValue}
                </div>
              )}
              {d.statCaption && (
                <div className="mt-1.5 max-w-60 text-[13px] leading-normal text-white/90 lg:mt-2 lg:max-w-65 lg:text-[15px]">
                  {d.statCaption}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col justify-center rounded-card bg-surface p-[22px] lg:px-11 lg:py-10">
          <h4 className="mb-3 text-[19px] leading-[1.25] text-content lg:mb-4 lg:text-heading-sm lg:leading-[1.2]">
            {d.heading}
          </h4>
          {d.bodyHtml && d.bodyHtml.__html && (
            <div
              className={cx(
                "kroc-prose text-[13px] leading-[1.6] text-content-muted",
                "lg:text-[14.5px] lg:leading-[1.65]",
                "mb-4 [&_p]:mb-3 lg:mb-5.5 lg:[&_p]:mb-3.5 [&_p:last-child]:mb-0"
              )}
              dangerouslySetInnerHTML={d.bodyHtml}
            ></div>
          )}
          {(d.ctaLabel || hasSocial) && (
            <div className="flex flex-wrap items-center gap-4">
              {d.ctaLabel && (
                <a href={ctaUrl || "#"} className="btn btn-primary">
                  {d.ctaLabel}
                </a>
              )}
              {hasSocial && (
                <div className="flex gap-3 text-content">
                  <SocialLinks iconClass="h-[18px] w-[18px]" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
