// RichText — block: rich_text. One authored WYSIWYG region in a white card.
// First variant: "Careers Territorial Information" (ticket 2464, filed in the
// catalog as [careers_territorial]) — the ADA / EEO / VEVRAA section at the
// foot of 6.20 Careers.
//
// One field, as Erin asked: "a WYSIWYG editor at the bottom for customizable
// Territorial information" (C4, 💬1871730462). The single WYSIWYG was chosen
// over the ticket's Title + Icon Columns + Sections + Links,
// and the model is general (`rich_text`, not `careers_territorial`) because
// nothing in it is Careers-specific.
//
// Styling is .kroc-rt (src/tailwind.css), the prototype's rich-text region:
// headings, paragraphs, lists and links take the design's scale with no
// per-element markup. The three-column icon row is HTML in the field — a
// <div class="rt-cols"> of <div>s, each an <div class="ico"><img></div> over a
// <p> — as on the source page (salvationarmyusa.org, also a Zesty build), where
// the whole section is one rich-text field with that row pasted in as HTML. ⚠
// Unverified: whether the Manager's editor keeps those classes on save; the
// variant was written through the API. If it strips them, the row falls back
// to stacked paragraphs and the icons to plain images.
//
// ⚠ F9: the copy is identical on every Kroc site, and legal text, so 26
// per-page copies drift. Built per-page like [about_joan_kroc_story]; a
// territory/national source would change where the record lives, not this
// component.
//
// Desktop and mobile are separate designs and both are followed (44/48 vs
// 22px padding; the type scale lives in .kroc-rt).
function RichText(props) {
  const d = props.data || {};
  const html = String(d.body == null ? "" : d.body).trim();
  // An emptied WYSIWYG can still hold "<p></p>"; treat tag-only as empty
  // unless it carries an image.
  const hasBody = html.replace(/<(?!img)[^>]*>|&nbsp;/g, "").trim() !== "";
  const markup = { __html: html };

  if (!hasBody) {
    return null;
  }

  return (
    <div className="rounded-card bg-surface p-[22px] lg:px-12 lg:py-11">
      <div className="kroc-rt" dangerouslySetInnerHTML={markup}></div>
    </div>
  );
}
