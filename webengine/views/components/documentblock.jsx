// DocumentBlock — block: document_block. Downloadable files as a list of
// cards: each card is a download button for a file uploaded to the media
// library. First variant: "App & Portal Help Documents" on 6.23 App & Portal
// (three PDF guides). v5 calls it [document_block] (V9).
//
// Japheth 2026-11-09: "the help documents is just a button to download the
// uploaded file". So it is v5's V9 without the [documents] dataset: the files
// sit in a repeater {Title, Description, File (Media)}, and there is no Layout,
// Columns or Force Download field — every card downloads. The dataset is what
// v5 wanted for reuse (one handbook on many pages); it can come later without
// changing this card.
//
// A Media sub-field stores a bare ZUID, so each file's URL is resolved by
// useKrocMediaUrls (cardgrid.jsx) through custom-endpoints/media.json, which
// returns a non-image file's plain URL too (checked with a PDF, 2026-11-09).
// The link adds ?download=true, which the media host answers with
// Content-Disposition: attachment. The kind label ("PDF") comes from the file's
// extension. The design's file size is dropped: nothing can read it, and v5
// says to drop it rather than ask editors to type it.
//
// Columns follow the card count like [card_grid] (3 -> 3-up); mobile stacks.
// The card is KrocDocumentCard (stepcolumns.jsx) in its white "card" tone,
// which carries both designs' sizes. A row with no file shows no card.
//
// Loads after cardgrid.jsx (useKrocMediaUrls, krocMediaZuid, krocMediaDirectUrl)
// and stepcolumns.jsx (KrocDocumentCard).
function DocumentBlock(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const heading = text(d.heading);
  const rows = []
    .concat(d.documents || [])
    .flat()
    .filter(Boolean)
    .map((r) => ({ title: text(r.title), description: text(r.description), file: text(r.file) }))
    .filter((r) => r.title && r.file);

  const urls = useKrocMediaUrls(rows.map((r) => krocMediaZuid(r.file)));
  const fileUrl = (v) => krocMediaDirectUrl(v) || urls[krocMediaZuid(v)] || "";

  if (rows.length === 0) {
    return null;
  }

  const n = rows.length;
  const cols = n === 1 ? "" : n % 2 === 0 && n % 3 !== 0 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  return (
    <div className={cx(heading && "lg:pt-4")}>
      {heading && (
        <h2 className="mb-3.5 text-[22px] leading-[1.2] text-content lg:mb-[18px] lg:text-heading-md lg:leading-[1.25]">
          {heading}
        </h2>
      )}
      <div className={cx("grid grid-cols-1 gap-2.5 lg:gap-4", cols)}>
        {rows.map((r, i) => (
          <KrocDocumentCard
            key={r.title + i}
            tone="card"
            download
            title={r.title}
            description={r.description}
            link={fileUrl(r.file)}
          />
        ))}
      </div>
    </div>
  );
}
