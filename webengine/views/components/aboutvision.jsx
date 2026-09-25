// AboutVision — block: about_vision (blocks catalog §3.3). "Our Vision" on
// 6.17 About Us: 4:5 service photo left, title + vision copy + a red-check
// commitment list right.
//
// Mirror of IntroBand's photo variant, not a copy of it: that one is 7fr/5fr
// with the photo RIGHT, this is 5fr/7fr with the photo LEFT. Same shape, other
// hand — which is why the catalog files them as merge candidates rather than
// one block.
//
// Check colour is pinned red here rather than exposed as the catalog's "Check
// Colour" field: the colour varies between blocks (red here, green on Family
// Play and Careers Benefits) and never within one, so it belongs in the
// template the way the background does.
//
// The image fills its column and crops to cover — a 4:5 source is guidance for
// the asset, not a guarantee the slot can make, since the column height is set
// by however long the copy runs.
//
// Loads after shared.jsx (CheckList) and featuredpages.jsx (krocSortRows).
function AboutVision(props) {
  const d = props.data || {};

  const items = krocSortRows(
    []
      .concat(d.checklist || [])
      .flat()
      .filter(Boolean)
  )
    .map((r) => String(r.item || "").trim())
    .filter(Boolean);

  // A section with no title is an unfinished block, not an empty state.
  if (!d.title) {
    return null;
  }

  const copy = (
    <div className="px-7 py-8 lg:px-11 lg:py-10">
      <h3 className="mb-3.5 text-heading-md text-content">{d.title}</h3>
      {d.bodyHtml && d.bodyHtml.__html && (
        <div
          className="kroc-prose mb-4 [&_p:last-child]:mb-0"
          dangerouslySetInnerHTML={d.bodyHtml}
        ></div>
      )}
      <CheckList items={items} tone="red" />
    </div>
  );

  if (!d.image) {
    return <div className="rounded-card bg-surface">{copy}</div>;
  }

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-card bg-surface lg:grid-cols-[5fr_7fr]">
      <div className="relative min-h-[320px] lg:min-h-[420px]">
        <img
          src={d.image}
          alt={d.imageAlt || ""}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      {copy}
    </div>
  );
}
