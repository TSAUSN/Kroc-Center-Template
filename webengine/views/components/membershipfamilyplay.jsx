// Comparison table for [membership_family_play_comparison]. Local to this
// block — it is the only 3-column comparison in the 41-block catalog. Follows
// the ClassFinderTable idiom in catalog.jsx: overflow-x-auto wrapper + shared
// th/td class constants, so the three columns scroll rather than crush on a
// phone.
//
// Two colours in the design have no token: the darker header cell (#001844)
// and the highlighted Family Play column (#F4F8FF). Rather than invent palette
// values — the token source forbids it — both are derived from `secondary`:
// black/20 over navy lands on #001A45, and secondary/5 over white on #F2F4F7.
// rows = [{ benefit, standard, familyPlay }]
function ComparisonTable(props) {
  const rows = props.rows || [];
  const heads = props.headings || [];
  const th = "px-[22px] py-4 text-[14.5px] font-medium";
  const td = "px-[22px] py-3.5 text-[14.5px]";

  if (!rows.length) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-black/10">
      <table className="w-full min-w-160 border-collapse">
        {heads.some(Boolean) && (
          <thead>
            <tr className="bg-secondary text-content-ondark">
              <th className={cx(th, "text-left")}>{heads[0]}</th>
              <th className={cx(th, "text-center")}>{heads[1]}</th>
              <th className={cx(th, "bg-black/20 text-center")}>{heads[2]}</th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.benefit + i} className="border-t border-black/5 even:bg-black/2">
              <td className={cx(td, "font-medium text-content")}>{r.benefit}</td>
              <td className={cx(td, "text-center text-content-muted")}>{r.standard}</td>
              <td className={cx(td, "bg-secondary/5 text-center font-medium text-secondary")}>
                {r.familyPlay}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// MembershipFamilyPlay — block: membership_family_play_comparison (blocks
// catalog §3.1, where the model is named `[membership_family_play]`).
// White card on 6.15 Membership: eyebrow, title, body, a 2-column green
// checklist, the Standard-vs-Family-Play comparison table, a serif accent
// line, and one centred CTA.
//
// Supersedes the Comparison Table half of v5 §21 [rate_cards] — the values are
// prose ("$5/child (drop-in)", "Included", "—"), which is why they are text
// sub-fields and why this could never be a WYSIWYG.
//
// One checklist repeater, not the catalog's "Checklist A + Checklist B": the
// shared CheckList already balances two columns, so a single list renders the
// same 3/3 split without the editor hand-balancing two.
//
// Loads after shared.jsx (CheckList), catalog.jsx (krocExternalUrl) and
// featuredpages.jsx (krocSortRows).
function MembershipFamilyPlay(props) {
  const d = props.data || {};

  const items = krocSortRows(
    []
      .concat(d.checklist || [])
      .flat()
      .filter(Boolean)
  )
    .map((r) => String(r.item || "").trim())
    .filter(Boolean);

  const rows = krocSortRows(
    []
      .concat(d.comparison || [])
      .flat()
      .filter(Boolean)
  )
    .map((r) => ({
      benefit: String(r.benefit || "").trim(),
      standard: String(r.standard_plan || "").trim(),
      familyPlay: String(r.family_play || "").trim()
    }))
    .filter((r) => r.benefit);

  // A card with no title is an unfinished block, not an empty state.
  if (!d.title) {
    return null;
  }

  const heads = (d.headings || []).map((h) => String(h || "").trim());
  // "Benefit" is the one generic column label; the other two name membership
  // products and differ per centre, so they are left exactly as authored.
  if (rows.length && (heads[1] || heads[2])) {
    heads[0] = heads[0] || "Benefit";
  }

  return (
    <div className="rounded-card bg-surface px-7 py-9 lg:px-12 lg:py-10">
      {d.eyebrow && (
        <div className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-primary">
          {d.eyebrow}
        </div>
      )}
      <h3 className="mb-3.5 text-heading-md text-content">{d.title}</h3>
      {d.bodyHtml && d.bodyHtml.__html && (
        <div
          className="mb-6 max-w-190 text-[15px] leading-relaxed text-content"
          dangerouslySetInnerHTML={d.bodyHtml}
        ></div>
      )}
      {items.length > 0 && (
        <div className="mb-7">
          <CheckList items={items} columns={2} />
        </div>
      )}
      <ComparisonTable rows={rows} headings={heads} />
      {d.footnote && (
        <p className="mt-5.5 text-center font-serif text-[18px] text-secondary">{d.footnote}</p>
      )}
      {d.ctaLabel && (
        <div className="mt-5.5 flex justify-center">
          <a href={krocExternalUrl(d.ctaUrl) || "#"} className="btn btn-primary">
            {d.ctaLabel}
          </a>
        </div>
      )}
    </div>
  );
}
