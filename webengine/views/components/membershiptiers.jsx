// MembershipTiers — block: membership_tiers (blocks catalog §3.1). The 9
// membership price rows on 6.15 Membership, in a 3-up grid, with the Joiner's
// Fee fine print centred beneath.
//
// Supersedes the Cards half of v5 §21 [rate_cards], which was modelled but
// never designed. No Display Mode field: the Comparison Table half is its own
// block ([membership_family_play]). No Columns field either — nothing asks for
// one, so 3-up is the layout.
//
// Prices are authored here rather than read from TractionRec: TR does model
// them (Membership_Type -> Product -> Price Level), but the integration needs
// a proxy service that does not exist yet.
//
// Loads after cards.jsx (TierCard), catalog.jsx (krocMoney) and
// featuredpages.jsx (krocSortRows).
function MembershipTiers(props) {
  const d = props.data || {};

  const rows = []
    .concat(d.tiers || [])
    .flat()
    .filter(Boolean);

  const cards = krocSortRows(rows)
    .map((r) => {
      // Currency arrives as "126.00" / 126; krocMoney also passes through a
      // hand-typed "$126" and renders a zero-priced tier as Free. A period
      // only reads correctly against an amount — "Free/mo" does not.
      const amount = Number(String(r.price == null ? "" : r.price).replace(/[^0-9.]/g, ""));
      return {
        name: String(r.tier_name || "").trim(),
        note: String(r.age_note || "").trim(),
        price: krocMoney(r.price),
        period: amount > 0 ? String(r.period || "").trim() || "/mo" : ""
      };
    })
    .filter((c) => c.name);

  if (!cards.length) {
    return null;
  }

  return (
    <div>
      {(d.eyebrow || d.heading) && (
        <div className="mb-4.5">
          {d.eyebrow && (
            <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-primary">
              {d.eyebrow}
            </div>
          )}
          {d.heading && <h3 className="text-heading-md text-content">{d.heading}</h3>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <TierCard key={c.name + i} card={c} />
        ))}
      </div>
      {d.finePrint && (
        <p className="mt-4 whitespace-pre-line text-center text-[12.5px] text-content-muted">
          {d.finePrint}
        </p>
      )}
    </div>
  );
}
