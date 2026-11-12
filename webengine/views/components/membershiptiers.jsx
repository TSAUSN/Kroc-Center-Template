// MembershipTiers — block: membership_tiers (blocks catalog §3.1). The 9
// membership price rows on 6.15 Membership, in a 3-up grid, with the Joiner's
// Fee fine print centred beneath.
//
// Supersedes the Cards half of v5 §21 [rate_cards], which was modelled but
// never designed. No Display Mode field: the Comparison Table half is its own
// block ([membership_family_play]). No Columns field either — nothing asks for
// one, so 3-up is the layout.
//
// A row with a `tractionrec_id` reads its price, period and ages from Traction
// Rec (membershipdata.jsx) and its typed values are ignored; `tier_name` is an
// optional override of the name. A row without one renders as typed.
// `fine_print` may hold "{fee}", filled with Traction Rec's registration fee.
//
// Loads after cards.jsx (TierCard), catalog.jsx (krocMoney),
// featuredpages.jsx (krocSortRows) and membershipdata.jsx.
function MembershipTiers(props) {
  const d = props.data || {};

  const rows = []
    .concat(d.tiers || [])
    .flat()
    .filter(Boolean);

  const tr = d.tractionrec || {};
  // No rows at all means the file is missing (an instance without the sync):
  // then every row falls back to what was typed.
  const hasTr = Object.keys(tr).length > 0;
  const cards = krocSortRows(rows)
    .map((r) => {
      const trId = krocTrText(r.tractionrec_id);
      if (trId && hasTr) {
        const t = tr[trId];
        // Not in the file = no longer sold online. Hide it rather than show a
        // typed price Traction Rec no longer stands behind.
        if (!t) {
          console.warn("KROC: membership " + trId + " is not sold online; card hidden");
          return null;
        }
        const price = krocTrMembershipPrice(t) || {};
        return {
          name: krocTrText(r.tier_name) || krocTrMembershipName(t),
          note: krocTrMembershipAges(t),
          price: krocMoney(price.amount),
          period: Number(price.amount) > 0 ? price.period : "",
          fee: price.fee
        };
      }
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
    .filter((c) => c && c.name);

  if (!cards.length) {
    return null;
  }

  // "{fee}" in the fine print is Traction Rec's registration fee for these cards.
  const finePrint = krocTrFillFee(d.finePrint, krocTrFeeText(cards.map((c) => c.fee)));

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
      {finePrint && (
        <p className="mt-4 whitespace-pre-line text-center text-[12.5px] text-content-muted">
          {finePrint}
        </p>
      )}
    </div>
  );
}
