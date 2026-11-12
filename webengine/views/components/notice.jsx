// Notice — block: notice. An inline info callout in the page flow: navy-50
// tint, navy info icon, one WYSIWYG body. First variant: "App & Portal
// Two-Password Notice" on 6.23 App & Portal (ticket 2475, filed in the catalog
// as [appportal_notice]) — "Two systems, two passwords", the page's real user
// problem, said plainly and early.
//
// General because the shape isn't App & Portal-specific. Distinct from
// [global_site_alert_banner]: that one is site-wide, dismissible and one per
// site; this sits in the flow where it's placed. Dropped from the ticket:
// Tone (Info/Warning/Brand) and Icon — only Info is drawn as a block (the
// Membership "About Holds" tint the ticket cites is a box inside the holds
// form, with an eyebrow and no icon, not this callout), and the icon is the
// sprite's info glyph. Body is WYSIWYG for the bold lead sentence.
//
// Desktop and mobile are separate designs and both are followed (20/24 vs
// 16/18 padding, 22 vs 20px icon, 14.5 vs 13px body).
function Notice(props) {
  const d = props.data || {};
  const html = String(d.body == null ? "" : d.body).trim();
  const hasBody = html.replace(/<[^>]*>|&nbsp;/g, "").trim() !== "";
  const markup = { __html: html };

  if (!hasBody) {
    return null;
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-[14px] bg-brand-navy-50 px-[18px] py-4 lg:gap-4 lg:rounded-2xl lg:px-6 lg:py-5"
    >
      <Icon
        className="mt-px h-5 w-5 flex-none text-secondary lg:h-[22px] lg:w-[22px]"
        id="#i-info"
      />
      <div
        className="kroc-prose text-[13px] leading-[1.6] lg:text-[14.5px] lg:leading-[1.65] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold"
        dangerouslySetInnerHTML={markup}
      ></div>
    </div>
  );
}
