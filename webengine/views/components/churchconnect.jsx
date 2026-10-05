// ChurchConnectLinks — block: church_connect_links (blocks catalog §3.5).
// "Connect with Kroc Church!" on 6.19 Church: a row of coloured link bars,
// label left and an external-arrow right.
//
// NOT [featured_pages] compact, though v4 filed it as a candidate: that mode
// draws a centred 42px icon chip on a white card. These are full-bleed colour
// bars with no icon and no card, so the shape is its own block.
//
// One `style` field, not the catalog's separate Colour + Size. The design uses
// only three of the six combinations those would allow, and the tints are bound
// to the size -- navy-200 never appears small, navy-150 never large -- so the
// pair is really one hierarchy. Style also decides the column count, since the
// design runs large links 2-up and small ones 3-up.
//
// Colour deviates from the design in one place: the large red bar is drawn with
// --kroc-red #EF3E42, which carries white 16px text at 3.86:1 and fails AA
// (16px is not "large text"). It renders as red-300 #C5000E = 6.21:1, the same
// substitution [hero] makes. Tertiary's navy-150 passes at 4.59:1 but with no
// headroom, so the label must stay PURE white -- an rgba tint drops it under
// 4.5, exactly how the Day Pass green band nearly failed.
//
// Links are External URL only: a repeater cannot hold an Internal Link (or any
// relational sub-field), so the catalog's "Internal Link or External URL" is
// not constructible. Authors type absolute URLs and krocExternalUrl normalises
// a missing protocol.
//
// Loads after featuredpages.jsx (krocExternalUrl, krocSortRows).
const KROC_LINK_STYLE = {
  primary: { bg: "bg-brand-red-300", large: true },
  secondary: { bg: "bg-secondary", large: true },
  tertiary: { bg: "bg-brand-navy-150", large: false }
};

function ChurchConnectLinks(props) {
  const d = props.data || {};

  const rows = krocSortRows(
    []
      .concat(d.items || [])
      .flat()
      .filter(Boolean)
  )
    .map((r) => {
      const key = String(r.style || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-");
      return {
        label: String(r.label || "").trim(),
        url: krocExternalUrl(r.link),
        style: KROC_LINK_STYLE[key] ? key : "tertiary"
      };
    })
    .filter((r) => r.label);

  if (rows.length === 0) {
    return null;
  }

  const large = rows.filter((r) => KROC_LINK_STYLE[r.style].large);
  const small = rows.filter((r) => !KROC_LINK_STYLE[r.style].large);

  const bar = (r, i) => {
    const spec = KROC_LINK_STYLE[r.style];
    const Tag = r.url ? "a" : "div";
    return (
      <Tag
        key={r.label + i}
        href={r.url || undefined}
        className={cx(
          "flex items-center justify-between gap-3 rounded-[14px] text-content-ondark",
          spec.bg,
          r.url && "transition hover:opacity-90",
          spec.large
            ? "px-5 py-[18px] text-[15.5px] lg:px-[26px] lg:py-[22px] lg:text-[16px]"
            : "px-[18px] py-[15px] text-[14px] lg:px-[22px] lg:py-[18px] lg:text-[14.5px]"
        )}
      >
        <span>{r.label}</span>
        <Icon
          className={cx(
            "flex-none",
            spec.large
              ? "h-[17px] w-[17px] lg:h-[18px] lg:w-[18px]"
              : "h-[15px] w-[15px] lg:h-4 lg:w-4"
          )}
          id="#i-arrowur"
        />
      </Tag>
    );
  };

  return (
    <div>
      {d.heading && (
        <h3 className="mb-3.5 text-[22px] leading-[1.2] text-content lg:mb-[18px] lg:text-heading-md lg:leading-[1.25]">
          {d.heading}
        </h3>
      )}
      {large.length > 0 && (
        <div
          className={cx(
            "grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-3",
            small.length > 0 && "mb-2.5 lg:mb-3"
          )}
        >
          {large.map(bar)}
        </div>
      )}
      {small.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3 lg:gap-3">{small.map(bar)}</div>
      )}
    </div>
  );
}
