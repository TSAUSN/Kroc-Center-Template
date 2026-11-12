// HoursClosures — block: hours_closures (blocks catalog §3.8, ticket 2473).
// "2026 Facility Closures & Reduced Hours" on 6.22 Hours of Operation (Erin's
// "Facility Closures", 💬1871728292): a white card listing each date, what
// happens, and a Closed or Reduced pill, with the footnotes under a divider.
//
// Kind is a dropdown (closed | reduced) because it picks the pill: Closed is
// the red pill, Reduced the green one, as designed. No kind, no pill. Dropped
// from the ticket: Start / End Date (the date label is text, "Jun 28–30", and
// nothing asked for dated logic such as hiding past entries) and Columns
// (two on desktop, one on mobile, as both designs draw it). Rows keep their
// repeater order and fill the two desktop columns left to right.
//
// Desktop and mobile are separate designs and both are followed: 96px date
// column + muted 14px label on desktop, 68px + 13px ink label on mobile.
//
// Loads after hoursgeneral.jsx (KrocStatusPill).
function HoursClosures(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const heading = text(d.heading);
  const footnotes = text(d.footnotes);
  const items = []
    .concat(d.items || [])
    .flat()
    .filter(Boolean)
    .map((r) => ({
      date: text(r.date_label),
      label: text(r.label),
      kind: text(r.kind).toLowerCase()
    }))
    .filter((r) => r.date || r.label);

  if (items.length === 0 && !footnotes) {
    return null;
  }

  return (
    <div className={cx(heading && "lg:pt-4")}>
      {heading && (
        <h2 className="mb-3.5 text-[22px] leading-[1.2] text-content lg:mb-[18px] lg:text-heading-md lg:leading-[1.25]">
          {heading}
        </h2>
      )}
      <div className="rounded-card bg-surface p-[18px] lg:px-9 lg:py-8">
        {items.length > 0 && (
          <ul className="m-0 grid list-none grid-cols-1 p-0 lg:grid-cols-2 lg:gap-x-10">
            {items.map((r, i) => (
              <li
                key={r.date + r.label + i}
                className={cx(
                  "flex items-start gap-2.5 py-2.5 lg:gap-3.5 lg:py-[11px]",
                  i > 0 && "border-t border-brand-area",
                  i === 1 && "lg:border-t-0"
                )}
              >
                <span className="flex-[0_0_68px] text-[13px] font-medium text-content lg:flex-[0_0_96px] lg:text-[14px]">
                  {r.date}
                </span>
                <span className="flex-1 text-[13px] leading-[1.4] text-content lg:text-[14px] lg:leading-[1.45] lg:text-content-muted">
                  {r.label}
                </span>
                {(r.kind === "closed" || r.kind === "reduced") && (
                  <span className="flex-none">
                    <KrocStatusPill
                      tone={r.kind === "closed" ? "closed" : "open"}
                      short={r.kind === "closed" ? "Closed" : "Reduced"}
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {footnotes && (
          <p
            className={cx(
              "text-[11.5px] leading-[1.7] whitespace-pre-line text-content-muted lg:text-[12.5px]",
              items.length > 0 && "mt-3.5 border-t border-brand-area pt-3 lg:mt-5 lg:pt-4"
            )}
          >
            {footnotes}
          </p>
        )}
      </div>
    </div>
  );
}
