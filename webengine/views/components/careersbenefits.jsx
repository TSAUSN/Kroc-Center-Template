// CareersBenefits — block: careers_benefits (blocks catalog §3.6, ticket 2457).
// The "Our Benefits" card on 6.20 Careers: a heading over a green two-column
// checklist, plus an optional employee-testimonial video under it.
//
// Its own block rather than a variant of [about_vision], decided 2026-10-05
// (Japheth), so the catalog's Columns and Check Colour fields aren't fields:
// green and two columns are this card's design (CheckList's columns-2 is one
// column below sm, which is the mobile design).
//
// Video: morgan asked to show "videos of employee testimonials ... from
// youtube" (2026-07-24, 💬1857887156); Erin settled the source as YouTube for
// video with audio (T10, ticket 2493). No design places it, so it sits under
// the checklist inside the card, framed exactly like [about_joan_kroc_story]'s
// (16:9, up to 820px, centred) and parsed by the same krocYouTubeId, so any
// YouTube link shape works. One video, per Japheth. Presence-driven: no URL,
// no frame; an unparseable URL is treated as none.
//
// Desktop and mobile are separate designs and both are followed: 22px panel +
// 19px heading on mobile, 36/44 padding + 28px heading on desktop.
//
// Loads after shared.jsx (CheckList) and aboutjoankrocstory.jsx (krocYouTubeId).
function CareersBenefits(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const heading = text(d.heading);
  const items = []
    .concat(d.items || [])
    .flat()
    .filter(Boolean)
    .map((r) => text(r.item))
    .filter(Boolean);
  const videoId = krocYouTubeId(d.videoUrl);

  if (!heading && items.length === 0 && !videoId) {
    return null;
  }

  return (
    <div className="rounded-card bg-surface p-[22px] lg:px-11 lg:py-9">
      {heading && (
        <h3 className="mb-3.5 text-[19px] leading-[1.25] text-content lg:mb-[18px] lg:text-heading-sm lg:leading-[1.3]">
          {heading}
        </h3>
      )}
      <CheckList items={items} columns={2} />
      {videoId && (
        <div
          className={cx(
            "relative mx-auto aspect-video w-full max-w-[820px] overflow-hidden rounded-[12px] bg-black lg:rounded-[14px]",
            (heading || items.length > 0) && "mt-[18px] lg:mt-7"
          )}
        >
          <iframe
            title={heading ? heading + " video" : "Video"}
            src={"https://www.youtube.com/embed/" + videoId}
            className="absolute inset-0 block h-full w-full border-0"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          ></iframe>
        </div>
      )}
    </div>
  );
}
