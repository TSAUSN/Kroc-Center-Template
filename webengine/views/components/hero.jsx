// HeroBlock — block: hero (v5 V3 `[hero_block]`, blocks library §7.24).
// The one reusable hero. The prototype hand-drew 15 of these and componentised
// a 16th; this replaces all of them, so every difference between those 16 is
// either a field here or deliberately dropped.
//
// There is NO display-style variant. A Zesty variant is a content item of this
// model, so every variant shares this schema — the design therefore has to be
// driven by WHICH FIELDS ARE FILLED, not by a style flag. Four presence rules:
//   badge_icon / badge_text -> the chip above the heading
//   show_social_links       -> the circle row (from globals.social_handles)
//   either CTA label        -> the button row
//   media                   -> image | video | color
// The Rentals "Save the Arts" treatment (gold Jenson eyebrow, letterspaced
// heading, warning CTA) is deliberately NOT carried over — it was the only
// thing that would have needed a real variant, and it was dropped so Rentals
// renders as a plain centred image hero like everything else.
//
// Subheading ink is PURE white, not the prototype's 92%. On a colour band 92%
// costs about half a point of contrast, which is the difference between green
// passing and failing AA (4.79 vs 4.31). Same call as the Day Pass band.
//
// Background palette is restricted to the four tokens that clear AA against
// the 17px subheading: navy 13.36, dark 14.63, red-300 5.37, green 4.79. The
// brand red #ef3e42 is NOT offered — it lands at 3.48 — even though the
// prototype's own HeroBlock defaults to it. `red` maps to the darker #c5000e,
// which still reads as KROC red. Amber (1.86) and danger (3.85) are excluded.
// That is why there is no X8 Ink control: the unsafe choices are simply absent.
//
// Loads after shared.jsx (cx, Icon, SocialLinks, SOCIAL_LINKS), catalog.jsx
// (krocExternalUrl) and aboutjoankrocstory.jsx (krocYouTubeId).

// Dropdown values arrive as whatever the manager stored; the GraphQL schema
// types every dropdown as String, so nothing here can assume an exact casing.
// Normalise to a lowercase hyphen token the way gallery.jsx/donation.jsx do.
const krocHeroToken = (v, fallback) =>
  String(v == null ? "" : v)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-") || fallback;

const KROC_HERO_BG = {
  navy: "bg-secondary",
  dark: "bg-brand-ink",
  ink: "bg-brand-ink",
  red: "bg-brand-red-300",
  green: "bg-success"
};

// compact 260/280 · standard mobile 340 then 3:1 · tall 560/440 (video needs
// the room — the play affordance sits above the copy)
const KROC_HERO_H = {
  compact: "min-h-65 lg:min-h-70",
  standard: "min-h-85 lg:min-h-0 lg:aspect-[3/1]",
  tall: "min-h-140 lg:min-h-110"
};

function HeroBlock(props) {
  const d = props.data || {};
  const [playing, setPlaying] = React.useState(false);

  const media = krocHeroToken(d.media, "image");
  const align = krocHeroToken(d.alignment, "left");
  const height = krocHeroToken(d.height, "standard");
  const artwork = krocHeroToken(d.artworkMode, "responsive");
  const centered = align === "center";
  const videoId = krocYouTubeId(d.videoUrl);

  // A hero with no heading is an unfinished block, not an empty state.
  if (!d.heading) {
    return null;
  }

  const ctas = [
    { label: d.primaryCtaLabel, url: d.primaryCtaUrl, className: "btn-light" },
    { label: d.secondaryCtaLabel, url: d.secondaryCtaUrl, className: "btn-outline-light" }
  ].filter((c) => c.label);

  const hasSocial = typeof SOCIAL_LINKS !== "undefined" && SOCIAL_LINKS.length > 0;
  const showSocial = krocHeroToken(d.showSocialLinks, "") === "1" && hasSocial;

  // One chip, two shapes: a 48px tile when it is only an image (the catalog
  // pages' category icon) and a pill once there is text (the tag page's
  // "#youth"). The tag pill's monospace is dropped — one chip, one typeface.
  let badge = null;
  if (d.badgeText) {
    badge = (
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] lg:mb-3.5">
        {d.badgeIcon && (
          <img src={d.badgeIcon} alt="" className="h-[18px] w-[18px] object-contain" />
        )}
        <span>{d.badgeText}</span>
      </div>
    );
  } else if (d.badgeIcon) {
    badge = (
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-[10px] bg-white/12 lg:mb-3.5">
        <img src={d.badgeIcon} alt="" className="h-6 w-6 object-contain" />
      </div>
    );
  }

  const copy = (
    <React.Fragment>
      {badge}
      {d.eyebrow && (
        <div className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-white/78">
          {d.eyebrow}
        </div>
      )}
      <h1
        className={cx(
          "mb-3 text-[27px] leading-[1.12] tracking-[-0.01em] text-content-ondark",
          "lg:mb-3.5 lg:text-heading-xl lg:leading-[1.1]",
          centered && "mx-auto max-w-190"
        )}
      >
        {d.heading}
      </h1>
      {d.subheading && (
        <p
          className={cx(
            "max-w-160 text-[15px] leading-[1.6] whitespace-pre-line text-content-ondark lg:text-[17px]",
            centered && "mx-auto"
          )}
        >
          {d.subheading}
        </p>
      )}
      {ctas.length > 0 && (
        <div
          className={cx(
            "mt-4 grid gap-2 lg:mt-6 lg:flex lg:flex-wrap lg:gap-3",
            centered && "lg:justify-center"
          )}
        >
          {ctas.map((c) => (
            <a
              key={c.label}
              href={krocExternalUrl(c.url) || "#"}
              className={cx("btn btn-block lg:btn-lg lg:w-auto", c.className)}
            >
              {c.label}
            </a>
          ))}
        </div>
      )}
      {showSocial && (
        <div
          className={cx(
            "mt-5 flex flex-wrap gap-2",
            "[&_a]:h-9 [&_a]:w-9 [&_a]:justify-center [&_a]:rounded-full [&_a]:bg-white/15 [&_a]:text-white",
            "[&_a:hover]:bg-white/25 [&_a:hover]:text-white",
            centered && "justify-center"
          )}
        >
          <SocialLinks iconClass="h-4 w-4" />
        </div>
      )}
    </React.Fragment>
  );

  // Colour band — no photo, no scrim, so it is a padded block rather than the
  // aspect-ratio plate the image hero uses.
  if (media === "color") {
    return (
      <div
        className={cx(
          "rounded-card px-6 py-[30px] text-content-ondark lg:px-12 lg:py-14",
          KROC_HERO_BG[krocHeroToken(d.backgroundColor, "navy")] || KROC_HERO_BG.navy,
          centered && "text-center"
        )}
      >
        {copy}
      </div>
    );
  }

  const poster = d.imageDesktop || d.imageMobile;

  return (
    <div
      className={cx(
        "relative flex overflow-hidden rounded-card bg-[#404044] p-[22px] text-content-ondark lg:p-12",
        KROC_HERO_H[height] || KROC_HERO_H.standard,
        centered || height === "compact" ? "items-center" : "items-end",
        centered && "justify-center text-center"
      )}
    >
      {playing && videoId ? (
        <iframe
          title={d.heading}
          src={"https://www.youtube.com/embed/" + videoId + "?autoplay=1"}
          className="absolute inset-0 z-3 block h-full w-full border-0"
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>
      ) : (
        <React.Fragment>
          {poster && (
            // Artwork Mode is not cosmetic: a pre-designed pair is art-directed
            // (800x1000 portrait on mobile against 1400x420 desktop), so it must
            // swap the asset rather than scale the desktop file. `responsive`
            // ships one asset and lets object-cover do the work.
            <picture>
              {artwork === "pre-designed" && d.imageMobile && (
                <source media="(max-width: 1023px)" srcSet={d.imageMobile} />
              )}
              <img
                src={poster}
                alt={d.imageAlt || ""}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </picture>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/85 to-black/15 lg:to-black/20"></div>
          {media === "video" && videoId && (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={"Play video: " + d.heading}
              className="absolute top-[34%] left-1/2 z-3 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-content transition hover:bg-white"
            >
              <Icon className="h-6.5 w-6.5" id="#i-play" />
            </button>
          )}
          <div className={cx("relative z-2 w-full lg:max-w-190", centered && "lg:mx-auto")}>
            {copy}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}
