// DonateImpact — block: donate_impact (blocks catalog §3.7, ticket 2467). The
// impact-and-thanks card on 6.21 Donate Hub: a "1 in 3" stat (5fr) beside the
// community-collaboration narrative (7fr), and the donor thank-you columns
// (Top Grantors / Top Corporate Donors / Event Sponsors) under a divider.
//
// ONE block for what the catalog filed as two ([donate_impact] +
// [donate_donors], ticket 2468, merged), on the
// [church_ministries] precedent: both surfaces draw the donors inside the
// impact card, which two separately placed blocks can't express.
//
// The ticket's Groups {Heading, Names repeater} nests a repeater, which Zesty
// disallows (its own open question), so Names is Multi Line Text, one name per
// line. No Columns field: columns follow the group count like [card_grid]
// (1 -> full, 2 or 4 -> 2-up, else 3-up); mobile stacks.
//
// Everything is presence-driven: the stat (value or caption) and the body
// share the 5fr/7fr row, either alone runs full width; donor groups without
// anything above lose the divider. Stat value and caption are real text — the
// reference site's "1 in 3" is a JPEG no screen reader can read.
//
// Colour: the stat stays --kroc-red #EF3E42 — at 72px (54 mobile) it is large
// text, where 3.86:1 passes AA. The 11px group headings render red-300 #C5000E
// (6.21:1), as [church_kids]' eyebrow does.
//
// Same stat idea as [about_impact] (merge candidate in the catalog), but that
// one is a photo card beside a narrative card; this is one white card, so they
// stay separate models with the same field names (stat_value, stat_caption,
// body). Desktop and mobile are separate designs and both are followed.
function DonateImpact(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const value = text(d.statValue);
  const caption = text(d.statCaption);
  const bodyHtml = text(d.body);
  const hasBody = bodyHtml.replace(/<[^>]*>|&nbsp;/g, "").trim() !== "";
  const bodyMarkup = { __html: bodyHtml };
  const hasStat = Boolean(value || caption);

  const groups = []
    .concat(d.groups || [])
    .flat()
    .filter(Boolean)
    .map((g) => ({
      heading: text(g.heading),
      names: text(g.names)
        .split(/\r?\n/)
        .map((n) => n.trim())
        .filter(Boolean)
    }))
    .filter((g) => g.heading || g.names.length > 0);

  const hasTop = hasStat || hasBody;
  if (!hasTop && groups.length === 0) {
    return null;
  }

  const n = groups.length;
  const cols = n === 1 ? "" : n % 2 === 0 && n % 3 !== 0 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  const stat = hasStat && (
    <div className="text-center">
      {value && <div className="text-[54px] leading-none text-primary lg:text-[72px]">{value}</div>}
      {caption && (
        <div
          className={cx(
            "text-[13px] leading-normal text-content lg:text-[15.5px] lg:leading-[1.55]",
            value && "mt-2 lg:mt-3"
          )}
        >
          {caption}
        </div>
      )}
    </div>
  );

  const body = hasBody && (
    <div
      className="kroc-prose text-[13px] leading-[1.7] lg:text-[15px] [&_p]:mb-2.5 [&_p:last-child]:mb-0"
      dangerouslySetInnerHTML={bodyMarkup}
    ></div>
  );

  return (
    <div className="rounded-card bg-surface p-[22px] lg:px-12 lg:py-11">
      {hasTop && (
        <div
          className={cx(
            "grid grid-cols-1 gap-[18px]",
            hasStat && hasBody && "lg:grid-cols-[5fr_7fr] lg:items-center lg:gap-9"
          )}
        >
          {stat}
          {body}
        </div>
      )}
      {groups.length > 0 && (
        <div
          className={cx(
            "grid grid-cols-1 gap-4 lg:gap-7",
            cols,
            hasTop && "mt-[18px] border-t border-brand-area pt-4 lg:mt-8 lg:pt-7"
          )}
        >
          {groups.map((g, i) => (
            <div key={g.heading + i}>
              {g.heading && (
                <h3 className="mb-2 text-[11px] font-normal tracking-[.14em] text-brand-red-300 uppercase lg:mb-3">
                  {g.heading}
                </h3>
              )}
              {g.names.length > 0 && (
                <ul className="flex list-none flex-col gap-[5px] p-0 lg:gap-1.5">
                  {g.names.map((name, j) => (
                    <li key={name + j} className="text-[13px] text-content lg:text-[13.5px]">
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
