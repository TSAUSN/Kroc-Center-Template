// ChurchMinistries — block: church_ministries (blocks catalog §3.5). "Weekly
// Ministries" on 6.19 Church, plus the navy "Prayer Request" card beside it.
//
// ONE block for what the catalog filed as two ([church_ministries] +
// [church_prayer_card], merged 2026-09-29). The desktop design draws both in a
// single 7fr/5fr grid; mobile drops the pairing into two stacked sections. Two
// separately placed blocks could express neither, which is also why the
// catalog's "two blocks in a row" question never needed a Freestyle ruling.
//
// The prayer half is presence-driven: its heading or body opens the 7fr/5fr
// grid, and without either the list runs full width. Either half alone takes
// the full width.
//
// Desktop and mobile are separate designs and both are followed, which is why
// this reads as two layouts sharing markup rather than one that scales:
//   - a ministry row puts When INLINE RIGHT of the title on desktop, baseline-
//     aligned, and on its OWN LINE under the title on mobile;
//   - the Prayer heading is a section head ABOVE the navy card on desktop and
//     an h2 INSIDE it on mobile. It is rendered twice, one copy per surface,
//     and both copies hide with display:none, so only one is ever in the
//     accessibility tree.
//
// When is drawn in red-300 #C5000E, not the design's --kroc-red #EF3E42: that
// red on white is 3.86:1 and fails AA for 13px text (11.5px on mobile), where
// red-300 is 6.21:1. Same substitution as [hero] and [church_connect_links].
// Descriptions use text-content-muted, which IS the design's #575757 (7.23:1).
//
// When is plain text on purpose -- the values are recurrences ("3rd Sunday ·
// 4-6:30 PM"), which no Date type can hold.
//
// Loads after featuredpages.jsx (krocSortRows, krocExternalUrl).
function ChurchMinistries(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const rows = krocSortRows(
    []
      .concat(d.ministries || [])
      .flat()
      .filter(Boolean)
  )
    .map((r) => ({ title: text(r.title), when: text(r.when), description: text(r.description) }))
    .filter((r) => r.title);

  const prayerHeading = text(d.prayerHeading);
  const prayerBody = text(d.prayerBody);
  const prayerCta = text(d.prayerCtaLabel);
  const prayerUrl = krocExternalUrl(d.prayerCtaUrl);

  const hasList = rows.length > 0;
  const hasPrayer = Boolean(prayerHeading || prayerBody);

  if (!hasList && !hasPrayer) {
    return null;
  }

  const sectionHead =
    "mb-3.5 text-[22px] leading-[1.2] text-content lg:mb-[18px] lg:text-heading-md lg:leading-[1.25]";

  const list = hasList && (
    <div>
      {d.ministriesHeading && <h3 className={sectionHead}>{d.ministriesHeading}</h3>}
      <div className="overflow-hidden rounded-card bg-surface px-5 py-1 lg:p-0">
        {rows.map((r, i) => (
          <div
            key={r.title + i}
            className={cx(
              "py-3.5 lg:px-6 lg:py-[18px]",
              i > 0 && "border-t border-[#f0f0f2] lg:border-[#eaeaee]"
            )}
          >
            <div className="lg:mb-1 lg:flex lg:flex-wrap lg:items-baseline lg:justify-between lg:gap-3">
              <div className="mb-0.5 text-[17px] leading-[1.3] font-medium text-content lg:mb-0 lg:text-[16px]">
                {r.title}
              </div>
              {r.when && (
                <div className="mb-1 text-[11.5px] leading-[1.45] text-brand-red-300 lg:mb-0 lg:text-[13px]">
                  {r.when}
                </div>
              )}
            </div>
            {r.description && (
              <p className="text-[13px] leading-normal text-content-muted lg:text-[13.5px]">
                {r.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const prayer = hasPrayer && (
    <div>
      {prayerHeading && <h3 className={cx("hidden lg:block", sectionHead)}>{prayerHeading}</h3>}
      <div className="rounded-card bg-secondary px-6 py-[30px] text-content-ondark lg:px-[34px] lg:py-8">
        {prayerHeading && (
          <h3 className="mb-2.5 text-[22px] leading-[1.2] lg:hidden">{prayerHeading}</h3>
        )}
        {prayerBody && (
          <p
            className={cx(
              "whitespace-pre-line text-[13px] leading-[1.6] text-white/90",
              "lg:text-[15px] lg:text-white/88",
              prayerCta ? "mb-4 lg:mb-5" : ""
            )}
          >
            {prayerBody}
          </p>
        )}
        {prayerCta && (
          <a href={prayerUrl || undefined} className="btn btn-light btn-block lg:w-auto">
            {prayerCta}
          </a>
        )}
      </div>
    </div>
  );

  if (hasList && hasPrayer) {
    return (
      <div className="grid grid-cols-1 gap-9 lg:grid-cols-[7fr_5fr] lg:items-start lg:gap-6">
        {list}
        {prayer}
      </div>
    );
  }

  return list || prayer;
}
