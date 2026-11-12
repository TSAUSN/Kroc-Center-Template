// Quote — block: quote. A member or donor quote in a white card, with an
// optional photo or YouTube video beside it: the prototype's MemberQuote.
// Variants: "Membership Member Story" (6.15, Edward Fletcher) and "Donate
// Donor Impact" (6.21, Clothe a Child).
//
// v5 placed this as a 1-up Quote layout of [featured_stories], taking its photo
// from a related [stories] entry, but [stories] has no quote field, so it is a
// small standalone block (2026-11-09): eyebrow, quote, attribution, photo,
// video URL. Video is Erin's ask (💬1871698744, "the option" of video instead
// of a photo); it takes the media slot, parsed by krocYouTubeId, so any YouTube
// link shape works. Presence-driven: video, else photo, else no media column
// and the quote runs full width.
//
// The quote is set in the serif (Adobe Jenson Pro, which falls back to Georgia
// until the font is added) at 26px desktop / 20px mobile. Desktop and mobile
// are separate designs and both are followed: 5fr/7fr with media left on
// desktop, media 3:2 on top on mobile. The eyebrow is red-300 #C5000E (11px;
// #EF3E42 fails AA).
//
// Loads after aboutjoankrocstory.jsx (krocYouTubeId).
function Quote(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const eyebrow = text(d.eyebrow);
  const quote = text(d.quote);
  const attribution = text(d.attribution);
  const photo = text(d.photo);
  const videoId = krocYouTubeId(d.videoUrl);

  if (!quote) {
    return null;
  }

  const hasMedia = Boolean(videoId || photo);
  const media = videoId ? (
    <div className="relative aspect-[3/2] bg-black lg:aspect-auto lg:min-h-[300px]">
      <iframe
        title={attribution ? "Video: " + attribution : "Video"}
        src={"https://www.youtube.com/embed/" + videoId}
        className="absolute inset-0 block h-full w-full border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
  ) : (
    photo && (
      <div className="relative aspect-[3/2] bg-surface-muted lg:aspect-auto lg:min-h-[300px]">
        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    )
  );

  return (
    <figure
      className={cx(
        "m-0 overflow-hidden rounded-card bg-surface",
        hasMedia && "lg:grid lg:grid-cols-[5fr_7fr]"
      )}
    >
      {media}
      <div className="flex flex-col justify-center p-5 lg:px-12 lg:py-11">
        {eyebrow && (
          <div className="mb-2.5 text-[11px] tracking-[.14em] text-brand-red-300 uppercase lg:mb-3.5">
            {eyebrow}
          </div>
        )}
        <blockquote className="m-0 font-serif text-[20px] leading-[1.4] text-content lg:text-[26px] lg:leading-[1.35]">
          {quote}
        </blockquote>
        {attribution && (
          <figcaption className="mt-3.5 text-[13px] text-content-muted lg:mt-5 lg:text-[14px]">
            {attribution}
          </figcaption>
        )}
      </div>
    </figure>
  );
}
