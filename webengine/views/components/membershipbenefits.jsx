// MembershipBenefitsBand — block: membership_benefits_band (blocks catalog
// §3.1). Navy band on 6.15 Membership: eyebrow + title + body + two CTAs on the
// left, the benefits checklist on the right.
//
// Background is deliberately NOT a field. The only palette request on record
// (Figma 25:6, ticket BLK-1) is against [intro_band]; nothing asks
// for one here, and who owns the palette is still open (FC4/FC29). Navy is
// hardcoded until someone asks — at which point this takes Background + Ink
// (X8) together, since 7 of 11 palette colours fail AA behind white text.
//
// Loads after catalog.jsx (krocExternalUrl) and featuredpages.jsx
// (krocSortRows); CheckList comes from shared.jsx.
function MembershipBenefitsBand(props) {
  const d = props.data || {};

  const rows = []
    .concat(d.checklist || [])
    .flat()
    .filter(Boolean);

  const items = krocSortRows(rows)
    .map((r) => String(r.item || "").trim())
    .filter(Boolean);

  // The primary button is the membership purchase: its link comes from
  // krocTrMembershipPurchaseUrl (block view), never primary_cta_url, and with
  // no link there is no button.
  const ctas = [
    { label: d.primaryCtaLabel, url: d.primaryCtaUrl, className: "btn-light", purchase: true },
    { label: d.secondaryCtaLabel, url: d.secondaryCtaUrl, className: "btn-outline-light" }
  ].filter((c) => c.label && (c.url || !c.purchase));

  // A band with no title is an unfinished block, not an empty state.
  if (!d.title) {
    return null;
  }

  return (
    <div
      className={cx(
        "rounded-card bg-secondary px-7 py-9 text-content-ondark lg:px-12 lg:py-11",
        items.length
          ? "grid grid-cols-1 gap-8 lg:grid-cols-[5fr_7fr] lg:items-center lg:gap-10"
          : ""
      )}
    >
      <div className={items.length ? "" : "max-w-[720px]"}>
        {d.eyebrow && (
          <div className="mb-2.5 text-[12px] font-medium uppercase tracking-[0.14em] text-[rgba(255,255,255,0.72)]">
            {d.eyebrow}
          </div>
        )}
        <h3 className="mb-4 text-heading-md">{d.title}</h3>
        {d.bodyHtml && (
          <div
            className="mb-6 text-[15px] leading-relaxed text-[rgba(255,255,255,0.85)]"
            dangerouslySetInnerHTML={d.bodyHtml}
          ></div>
        )}
        {ctas.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {ctas.map((c) => (
              <a
                key={c.label}
                href={krocExternalUrl(c.url) || "#"}
                className={cx("btn", c.className)}
              >
                {c.label}
              </a>
            ))}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <CheckList items={items} columns={d.columns === "1" ? 1 : 2} tone="ondark" />
      )}
    </div>
  );
}
