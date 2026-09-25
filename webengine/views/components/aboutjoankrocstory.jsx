// AboutJoanKrocStory — block: about_joan_kroc_story (blocks catalog §3.3, where
// the model is called `[about_joan_kroc]` — the Zesty ref ID carries `_story`).
// The founding story on 6.17 About Us: Ray & Joan Kroc photo full-bleed behind
// a scrim, a two-line heading, body copy in two columns, and a YouTube embed.
//
// Built as a rich-text band rather than a bespoke primitive because that is
// what the source is: kroccenter.org's #joan-kroc section is ONE freeTextArea
// (WYSIWYG) with a CSS background photo and an .embed-container iframe. Erin
// asked for "text, photo and video" (2026-08-04) and this is those three.
//
// No Scrim boolean, though the catalog lists one. Nobody requested it — the
// word appears only in our own field list and in a Figma note describing the
// grey placeholder fill. And it is not a design option: the type is white and
// sits directly on a photograph, so scrim-off is an unreadable state. The
// gradient is pinned here the way the background is pinned on the other bands.
//
// Title is two text fields, not the catalog's WYSIWYG. The design's heading is
// structurally two lines with the second emphasised (the source is an <h1>
// with a <br> and a <strong>), so two fields say exactly that and nothing
// more; a WYSIWYG in a heading slot invites a pasted list or link the layout
// cannot render.
//
// Body is ONE WYSIWYG flowed through CSS multi-column, not two authored
// columns. The source's two col-md-6 divs land one per column from a
// two-paragraph body, and 1 or 3+ paragraphs still balance — where a grid
// would need the editor to hand-split the copy. Same reasoning as CheckList.
//
// Desktop and mobile are separate designs in the prototype, not one scaled:
// 34px/15.5px type and 48x56 padding above lg, 22px/14.5px and 22px padding
// below it. Both are followed rather than letting the desktop scale reflow.
//
// Ink is 88% white per the design. Measured against the worst case (the scrim
// over a pure white photo, i.e. the lightest the band can ever be): 7.50:1,
// clear of AA. Unlike the Day Pass green band, this one has margin to spare.
//
// Loads after shared.jsx (cx).

// YouTube URL -> 11-char id. Accepts watch, youtu.be, /embed/, /shorts/ and a
// bare id, since the field is free text and editors paste whatever the browser
// gave them. `/embed/+` is deliberate: the client's own apex site links
// `youtube.com/embed//fNpMowwn-1I` with a double slash, which still resolves.
const krocYouTubeId = (v) => {
  const s = String(v || "").trim();
  if (!s) {
    return "";
  }
  if (/^[\w-]{11}$/.test(s)) {
    return s;
  }
  const m = s.match(/(?:youtu\.be\/|\/embed\/+|\/shorts\/|\/v\/|[?&]v=)([\w-]{11})/);
  return m ? m[1] : "";
};

function AboutJoanKrocStory(props) {
  const d = props.data || {};
  const videoId = krocYouTubeId(d.videoUrl);

  // A band with no title is an unfinished block, not an empty state.
  if (!d.title) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-card bg-secondary">
      {d.image && (
        <img
          src={d.image}
          alt={d.imageAlt || ""}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Design gradient: navy 82% -> ink 88%, both straight off the palette */}
      <div className="absolute inset-0 bg-linear-to-b from-brand-navy-200/82 to-brand-ink/88"></div>

      <div className="relative p-[22px] lg:px-14 lg:py-12">
        {/* Explicit leading overrides the token's 48px — the design sets 1.2/1.25,
            and this is the only heading in the set deliberately built to wrap.
            The emphasis line goes BLOCK only from lg: the mobile design runs both
            halves together as one sentence, because a forced break at 22px on a
            390px screen strands two or three words on their own line. */}
        <h3 className="mb-[18px] text-[22px] leading-[1.2] text-content-ondark lg:mb-6 lg:text-heading-md lg:leading-[1.25]">
          {d.title}
          {d.titleEmphasis && (
            <React.Fragment>
              {" "}
              <span className="font-medium lg:block">{d.titleEmphasis}</span>
            </React.Fragment>
          )}
        </h3>

        {/* Columns split at sm but the type scale switches at lg, on purpose: one
            column held to lg would run a ~130-character line on a tablet, which
            is the thing multi-column is here to prevent. Line length follows the
            container, type follows the surface design. */}
        {d.bodyHtml && d.bodyHtml.__html && (
          <div
            className={cx(
              "kroc-prose columns-1 gap-x-8 text-[14.5px] text-content-ondark/88 sm:columns-2 lg:text-[15.5px]",
              "[&_a]:border-white/60 [&_a]:text-white",
              "[&_p]:mb-3 lg:[&_p]:mb-3.5",
              "[&_p]:break-inside-avoid [&_p:last-child]:mb-0"
            )}
            dangerouslySetInnerHTML={d.bodyHtml}
          ></div>
        )}

        {videoId && (
          <div className="relative mx-auto mt-[18px] aspect-video w-full max-w-[820px] overflow-hidden rounded-[12px] bg-black lg:mt-7 lg:rounded-[14px]">
            <iframe
              title={d.titleEmphasis || d.title}
              src={"https://www.youtube.com/embed/" + videoId}
              className="absolute inset-0 block h-full w-full border-0"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            ></iframe>
          </div>
        )}
      </div>
    </div>
  );
}
