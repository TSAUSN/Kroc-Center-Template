// DayPassPasses — block: day_pass_passes (blocks catalog §3.2, where the model
// is called `[daypass_passes]`). The Youth / Adult pass cards on 6.16 Day Pass.
//
// Supersedes part of v5 §21 [rate_cards]. No heading field: the design goes
// straight from the green band into the cards, and nothing asks for one.
//
// The grid is 2-up inside a 960px box, per the Figma frame ("2-up price cards,
// centered max 960"). A third pass would wrap to a 2+1 — the design only ever
// shows two.
//
// A row with a `tractionrec_id` reads its price and ages from Traction Rec
// (membershipdata.jsx) and its typed ones are ignored; `audience` / `label` are
// optional overrides of the name. A row without one renders as typed. The
// button never uses the row's cta_link: krocTrMembershipPurchaseUrl gives the
// Traction Rec link, for now Globals' Membership Purchase URL.
//
// Loads after cards.jsx (PassCard), catalog.jsx (krocMoney, krocExternalUrl),
// featuredpages.jsx (krocSortRows) and membershipdata.jsx.

// "Youth Day Pass" -> Youth + Day Pass, the card's two weights. A name that
// does not end in "Day Pass" is all audience.
const krocTrPassName = (t) => {
  const name = krocTrMembershipName(t);
  const m = /^(.*\S)\s+(day pass)$/i.exec(name);
  return m ? { audience: m[1], label: m[2] } : { audience: name, label: "" };
};
function DayPassPasses(props) {
  const d = props.data || {};
  const tr = d.tractionrec || {};
  // No rows at all means the file is missing: every row renders as typed.
  const hasTr = Object.keys(tr).length > 0;

  const cards = krocSortRows(
    []
      .concat(d.passes || [])
      .flat()
      .filter(Boolean)
  )
    .map((r) => {
      const card = {
        audience: String(r.audience || "").trim(),
        label: String(r.label || "").trim(),
        // Currency arrives as "15.00" / 15; krocMoney renders a zero as Free.
        price: krocMoney(r.price),
        ages: String(r.ages || "").trim(),
        ctaLabel: String(r.cta_label || "").trim(),
        ctaUrl: krocTrMembershipPurchaseUrl(null, d.purchaseUrl)
      };
      const trId = krocTrText(r.tractionrec_id);
      if (!trId || !hasTr) {
        return card;
      }
      const t = tr[trId];
      // Not in the file = no longer sold online: hide it, not a stale price.
      if (!t) {
        console.warn("KROC: day pass " + trId + " is not sold online; card hidden");
        return null;
      }
      const name = krocTrPassName(t);
      return {
        ...card,
        audience: card.audience || name.audience,
        label: card.audience ? card.label : name.label,
        price: krocMoney((krocTrMembershipPrice(t) || {}).amount),
        ages: krocTrMembershipAges(t),
        ctaUrl: krocTrMembershipPurchaseUrl(t, d.purchaseUrl)
      };
    })
    .filter((c) => c && c.audience);

  if (!cards.length) {
    return null;
  }

  return (
    <div className="mx-auto max-w-240">
      <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2">
        {cards.map((c, i) => (
          <PassCard key={c.audience + i} card={c} />
        ))}
      </div>
    </div>
  );
}
