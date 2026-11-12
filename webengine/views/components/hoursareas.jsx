// HoursAreas — block: hours_areas (blocks catalog §3.8, ticket 2472). "Hours
// by Area" on 6.22 Hours of Operation (Erin's "Hours of Operation module for
// different areas of Kroc", 💬1871728292): a grid of compact cards — area
// name, live Open/Closed pill, a note, and day/time rows.
//
// Its own block, not a [facility_section] layout (catalog F6): that block is
// one big photo-carousel card per facility, one item each, while this is six
// small cards in one grid. The fields line up; the layout doesn't.
//
// The ticket's Hours repeater would nest inside Areas, which Zesty disallows,
// so each area's Hours is Multi Line Text, one row per line as "Day | Time"
// (split on the first "|"). Rows parse like [hours_general]'s (shared
// krocParseDays / krocParseTimes / krocHoursStatus in hoursgeneral.jsx), so
// the pill is computed and there is no Status Mode — the same call as there;
// "Closed" as a row's time covers a closed day. No Columns field: columns
// follow the card count like [card_grid] (6 -> 3-up); mobile stacks.
//
// Desktop and mobile are separate designs and both are followed: the eyebrow
// ("Different areas, different schedules") is desktop-only, the pill reads
// "Open now" / "Closed now" on desktop and "Open" / "Closed" on mobile, and
// the type steps 19/500 -> 19/400 for the area and 12.5 -> 11.5px for the
// note. The eyebrow is red-300 #C5000E (11px; #EF3E42 fails AA).
//
// Loads after hoursgeneral.jsx (krocHoursRow, krocHoursStatus, useKrocNow,
// KrocStatusPill).
const krocParseHoursLines = (v) =>
  String(v == null ? "" : v)
    .split(/\r?\n/)
    .map((line) => {
      const bar = line.indexOf("|");
      const day = (bar === -1 ? line : line.slice(0, bar)).trim();
      const time = bar === -1 ? "" : line.slice(bar + 1).trim();
      return krocHoursRow(day, time);
    })
    .filter((r) => r.day || r.time);

function HoursAreas(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();
  const now = useKrocNow();

  const eyebrow = text(d.eyebrow);
  const heading = text(d.heading);
  const areas = []
    .concat(d.areas || [])
    .flat()
    .filter(Boolean)
    .map((r) => {
      const rows = krocParseHoursLines(r.hours);
      return { area: text(r.area), note: text(r.note), rows, status: krocHoursStatus(rows, now) };
    })
    .filter((a) => a.area || a.rows.length > 0);

  if (areas.length === 0) {
    return null;
  }

  const n = areas.length;
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
      <div className={cx("grid grid-cols-1 gap-3 lg:gap-4", cols)}>
        {areas.map((a, i) => (
          <div
            key={a.area + i}
            className="flex flex-col rounded-card bg-surface p-[18px] lg:px-[26px] lg:py-6"
          >
            {(a.area || a.status) && (
              <div
                className={cx(
                  "flex items-center justify-between gap-2.5 lg:gap-3",
                  a.note ? "mb-1" : "mb-2.5 lg:mb-3"
                )}
              >
                {a.area && (
                  <h3 className="text-[19px] leading-[1.25] text-content lg:font-medium">
                    {a.area}
                  </h3>
                )}
                {a.status && (
                  <KrocStatusPill
                    tone={a.status.open ? "open" : "closed"}
                    short={a.status.open ? "Open" : "Closed"}
                    long={a.status.open ? "Open now" : "Closed now"}
                  />
                )}
              </div>
            )}
            {a.note && (
              <div className="mb-2.5 text-[11.5px] leading-[1.45] text-content-muted lg:mb-3 lg:text-[12.5px]">
                {a.note}
              </div>
            )}
            {a.rows.length > 0 && (
              <dl className="m-0">
                {a.rows.map((r, j) => (
                  <div
                    key={r.day + j}
                    className={cx(
                      "flex justify-between gap-3 py-2 text-[13.5px] text-content-muted lg:gap-4 lg:py-[9px]",
                      j > 0 && "border-t border-brand-area"
                    )}
                  >
                    <dt>{r.day}</dt>
                    <dd className="m-0 whitespace-nowrap">{r.time}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
