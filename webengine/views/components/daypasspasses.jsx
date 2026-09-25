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
// Loads after cards.jsx (PassCard), catalog.jsx (krocMoney, krocExternalUrl)
// and featuredpages.jsx (krocSortRows).
function DayPassPasses(props) {
  const d = props.data || {};

  const cards = krocSortRows(
    []
      .concat(d.passes || [])
      .flat()
      .filter(Boolean)
  )
    .map((r) => ({
      audience: String(r.audience || "").trim(),
      label: String(r.label || "").trim(),
      // Currency arrives as "15.00" / 15; krocMoney renders a zero as Free.
      price: krocMoney(r.price),
      ages: String(r.ages || "").trim(),
      ctaLabel: String(r.cta_label || "").trim(),
      ctaUrl: krocExternalUrl(r.cta_url)
    }))
    .filter((c) => c.audience);

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
