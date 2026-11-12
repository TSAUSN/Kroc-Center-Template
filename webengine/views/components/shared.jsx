const SITE_NAME = "{{!globals.site_name}}" || "KROC";
const PAGE_ZUID = "{{!page.zuid}}";

const SOCIAL_ICONS = {
  facebook: "#i-fb",
  x: "#i-x",
  twitter: "#i-x",
  linkedin: "#i-li",
  instagram: "#i-ig",
  youtube: "#i-yt"
};

const SOCIAL_LINKS = [].concat({{ globals.social_handles }}).map((s) => ({
  label: s.platform,
  href: s.platform_url || "#",
  icon: SOCIAL_ICONS[(s.platform || "").toLowerCase()] || "#i-arrowur"
}));

const CURRENT_PATH = window.location.pathname;

const cx = (...parts) => parts.filter(Boolean).join(" ");
const isActive = (href) => href !== "#" && href === CURRENT_PATH;

function Icon(props) {
  return (
    <svg className={props.className}>
      <use href={props.id} />
    </svg>
  );
}

function SocialLinks(props) {
  return (
    <React.Fragment>
      {SOCIAL_LINKS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          aria-label={s.label}
          className="inline-flex items-center hover:text-primary"
        >
          <Icon className={props.iconClass} id={s.icon} />
        </a>
      ))}
    </React.Fragment>
  );
}

// Shared check list — Membership Benefits / Family Play, About Vision, Careers
// Benefits (7 instances across 4 pages). `tone` picks the check colour so the
// same list works on a colour band and on a white card:
//   "ondark" white (colour bands) · "red" (About Vision) · "navy" · default green.
// It is a prop, not a content field — the colour varies between blocks, never
// within one, so each block pins its own the way it pins its background. The
// one exception is [card_grid], where each card's Accent picks navy or red.
function CheckList(props) {
  const items = (props.items || []).filter(Boolean);

  if (!items.length) {
    return null;
  }

  const ondark = props.tone === "ondark";
  const checkColor = ondark
    ? "text-white"
    : props.tone === "red"
      ? "text-primary"
      : props.tone === "navy"
        ? "text-secondary"
        : "text-success";

  // Multi-column flow, not `grid-cols-2`: a grid shares row heights across both
  // columns, so one wrapped item punches a matching hole in its neighbour and
  // the checks stop being evenly spaced. Columns flow independently, so items
  // read down column 1 then column 2 — authored repeater order, top to bottom.
  return (
    <ul
      className={cx(
        "-mb-2.5 list-none gap-x-7 p-0",
        props.columns === 2 ? "columns-1 sm:columns-2" : "columns-1"
      )}
    >
      {items.map((item, i) => (
        <li
          key={i}
          className={cx(
            "mb-2.5 flex break-inside-avoid items-start gap-2.5 text-[14.5px] leading-normal",
            ondark ? "text-[rgba(255,255,255,0.92)]" : "text-content"
          )}
        >
          <Icon className={cx("mt-0.5 h-4.5 w-4.5 shrink-0", checkColor)} id="#i-check" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
