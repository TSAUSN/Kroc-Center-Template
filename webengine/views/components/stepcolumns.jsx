// StepColumns — block: step_columns. Side-by-side numbered steppers, each in
// a white card with a heading, a note, its steps, and its own attachments
// (buttons, a document card, a footer line). First variant: "App & Portal
// Setup Steps" on 6.23 App & Portal (ticket 2476, filed in the catalog as
// [appportal_steps]): Community Portal login beside Kroc Connect app setup,
// replacing the reference page's run-on bulleted lists.
//
// General (`step_columns`) because nothing in it is App & Portal-specific.
// The ticket nests a Steps repeater in a Columns repeater, which Zesty
// disallows, and the steps carry links and bold ("Community Portal login
// page", "Copy the PIN — don't click the link"), so Steps is a WYSIWYG: a
// numbered list, each item a step (top-level paragraphs count too), drawn as
// the prototype's Stepper by .kroc-steps (src/tailwind.css).
//
// The ticket's "Attached Document -> [documents]" is a relation, which a
// repeater can't hold, so the document card is Title + Description + Link
// (a media-library URL); its kind label ("PDF") comes from the link's
// extension. The design's file size is dropped: nothing can read it. Footer
// Note is per column (the design puts the help-desk line in the app column)
// and WYSIWYG for its bold phone number. Note Is a Caution shows the note in
// red (the portal's "claim it, don't create a second one"); otherwise muted.
//
// Accent (navy | red) colours the step numbers and the buttons: CTA 1 filled,
// CTA 2 outlined. Red is red-300 #C5000E throughout (white or red text at
// 12-14.5px on #EF3E42 / white fails AA). No Columns field: columns follow
// the count like [card_grid]. Desktop and mobile are separate designs and
// both are followed (eyebrow desktop-only; full-width buttons on mobile).
//
// Loads after shared.jsx (Icon, cx) and catalog.jsx (krocExternalUrl).
const KROC_DOC_KINDS = {
  pdf: "PDF",
  doc: "DOC",
  docx: "DOC",
  xls: "XLS",
  xlsx: "XLS",
  ppt: "PPT",
  pptx: "PPT",
  zip: "ZIP"
};
const krocDocKind = (url) => {
  const ext = String(url || "")
    .split(/[?#]/)[0]
    .split(".")
    .pop()
    .toLowerCase();
  return KROC_DOC_KINDS[ext] || "";
};

// One document as a card link. tone "inset" (default) is the grey card inside a
// [step_columns] column; "card" is the white card of [document_block]'s list,
// which also takes the mobile design's smaller size (38px chip, 13px title).
// download: the link forces a download (?download=true, which the media host
// answers with Content-Disposition: attachment) and shows the download glyph;
// otherwise it opens in a new tab with the arrow.
function KrocDocumentCard(props) {
  const kind = krocDocKind(props.link);
  const card = props.tone === "card";
  const link = props.link || "";
  const href =
    link && props.download ? link + (link.indexOf("?") === -1 ? "?" : "&") + "download=true" : link;
  const tab = props.download ? {} : { target: "_blank", rel: "noopener noreferrer" };
  return (
    <a
      href={href || undefined}
      {...tab}
      aria-label={
        props.title +
        (kind ? " — " + kind : "") +
        (props.download ? ", downloads" : ", opens in a new tab")
      }
      className={cx(
        "flex gap-4 no-underline transition-shadow hover:shadow-[0_6px_22px_rgba(0,0,0,0.07)]",
        card
          ? "items-center gap-[13px] rounded-card bg-surface px-4 py-3.5 lg:items-start lg:gap-4 lg:rounded-2xl lg:px-[22px] lg:py-5"
          : "items-start rounded-2xl bg-surface-muted px-[22px] py-5"
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "flex flex-none items-center justify-center bg-brand-red-50 text-primary",
          card
            ? "h-[38px] w-[38px] rounded-[10px] lg:h-11 lg:w-11 lg:rounded-xl"
            : "h-11 w-11 rounded-xl"
        )}
      >
        <Icon className={cx(card ? "h-[18px] w-[18px] lg:h-5 lg:w-5" : "h-5 w-5")} id="#i-doc" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            "block leading-[1.35] text-content",
            card ? "text-[13px] lg:mb-[3px] lg:text-[15px]" : "mb-[3px] text-[15px]"
          )}
        >
          {props.title}
        </span>
        {props.description && (
          <span
            className={cx(
              "block leading-normal text-content-muted",
              card
                ? "mt-0.5 text-[11.5px] lg:mt-0 lg:mb-[5px] lg:text-[13px]"
                : "mb-[5px] text-[13px]"
            )}
          >
            {props.description}
          </span>
        )}
        {kind && (
          <span
            className={cx(
              "block tracking-[.04em] text-content-muted",
              card ? "mt-0.5 text-[11.5px] lg:mt-0 lg:text-[12px]" : "text-[12px]"
            )}
          >
            {kind}
          </span>
        )}
      </span>
      <Icon
        className="h-4 w-4 flex-none text-content-muted"
        id={props.download ? "#i-download" : "#i-arrowur"}
      />
    </a>
  );
}

function StepColumns(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();
  const filled = (html) =>
    text(html)
      .replace(/<[^>]*>|&nbsp;/g, "")
      .trim() !== "";

  const eyebrow = text(d.eyebrow);
  const heading = text(d.heading);
  const columns = []
    .concat(d.columns || [])
    .flat()
    .filter(Boolean)
    .map((c) => ({
      heading: text(c.heading),
      note: text(c.note),
      caution: String(c.note_caution) === "1" || c.note_caution === true,
      red: text(c.accent).toLowerCase() === "red",
      steps: filled(c.steps) ? { __html: text(c.steps) } : null,
      cta1: { label: text(c.cta_1_label), link: krocExternalUrl(text(c.cta_1_link)) },
      cta2: { label: text(c.cta_2_label), link: krocExternalUrl(text(c.cta_2_link)) },
      doc: {
        title: text(c.document_title),
        description: text(c.document_description),
        link: krocExternalUrl(text(c.document_link))
      },
      footer: filled(c.footer_note) ? { __html: text(c.footer_note) } : null
    }))
    .filter((c) => c.heading || c.steps);

  if (columns.length === 0) {
    return null;
  }

  const n = columns.length;
  const cols = n === 1 ? "" : n % 2 === 0 && n % 3 !== 0 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  return (
    <div className={cx(heading && "lg:pt-4")}>
      {(heading || eyebrow) && (
        <div className="mb-3.5 lg:mb-[18px]">
          {eyebrow && (
            <div className="mb-2 hidden text-[11px] tracking-[.14em] text-brand-red-300 uppercase lg:block">
              {eyebrow}
            </div>
          )}
          {heading && (
            <h2 className="text-[22px] leading-[1.2] text-content lg:text-heading-md lg:leading-[1.25]">
              {heading}
            </h2>
          )}
        </div>
      )}
      <div className={cx("grid grid-cols-1 gap-3.5 lg:items-stretch lg:gap-4", cols)}>
        {columns.map((c, i) => {
          const hasCtas = Boolean(c.cta1.label || c.cta2.label);
          return (
            <div
              key={c.heading + i}
              className="flex flex-col rounded-card bg-surface p-[22px] lg:px-9 lg:py-8"
            >
              {c.heading && (
                <h3 className="mb-1 text-[19px] leading-[1.25] text-content lg:mb-1.5 lg:text-heading-sm lg:leading-[1.3]">
                  {c.heading}
                </h3>
              )}
              {c.note && (
                <p
                  className={cx(
                    "mb-4 text-[11.5px] leading-[1.55] lg:mb-5 lg:text-[13.5px]",
                    c.caution ? "text-brand-red-300" : "text-content-muted"
                  )}
                >
                  {c.note}
                </p>
              )}
              {c.steps && (
                <div
                  className={cx("kroc-steps", c.red && "red")}
                  dangerouslySetInnerHTML={c.steps}
                ></div>
              )}
              {hasCtas && (
                <div className="mt-[18px] grid gap-2 lg:mt-6 lg:flex lg:flex-wrap lg:gap-3">
                  {c.cta1.label && (
                    <a
                      href={c.cta1.link || undefined}
                      className={cx(
                        "btn btn-sm",
                        c.red
                          ? "btn-primary bg-brand-red-300 hover:bg-brand-red-300/90"
                          : "btn-secondary"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
                      {c.cta1.label}
                    </a>
                  )}
                  {c.cta2.label && (
                    <a
                      href={c.cta2.link || undefined}
                      className={cx(
                        "btn btn-sm border bg-transparent",
                        c.red
                          ? "border-brand-red-300 text-brand-red-300 hover:bg-brand-red-300 hover:text-white"
                          : "border-secondary text-secondary hover:bg-secondary hover:text-white"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
                      {c.cta2.label}
                    </a>
                  )}
                </div>
              )}
              {c.doc.title && (
                <div className="mt-[18px] lg:mt-auto lg:pt-6">
                  <KrocDocumentCard
                    title={c.doc.title}
                    description={c.doc.description}
                    link={c.doc.link}
                  />
                </div>
              )}
              {c.footer && (
                <div
                  className="kroc-prose mt-4 border-t border-brand-area pt-3.5 text-[11.5px] leading-[1.6] text-content-muted lg:mt-5 lg:pt-5 lg:text-[13.5px] [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-content"
                  dangerouslySetInnerHTML={c.footer}
                ></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
