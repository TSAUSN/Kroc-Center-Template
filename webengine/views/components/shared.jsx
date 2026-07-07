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
