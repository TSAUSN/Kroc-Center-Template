const SA_MISSION =
  "The Salvation Army, an international movement, is an evangelical part of the universal Christian Church. Its message is based on the Bible. Its ministry is motivated by the love of God. Its mission is to preach the gospel of Jesus Christ and to meet human needs in His name without discrimination.";

const FOOTER_LINKS = []
  .concat({{ globals.footer_links }})
  .map((l) => ({ label: l.site_name, href: l.site_url }));

const TERRITORY_LINKS = []
  .concat({{ globals.territory_links }})
  .map((l) => ({ label: l.territory_name, href: l.territory_url }));

const AFFILIATE_DEFAULTS = [
  { label: "KrocCenters.org", href: "#" },
  { label: "Thrift and Donate Goods", href: "#" },
  { label: "National Recreation", href: "#" },
  { label: "Donate", href: "#" }
];

const QUICK_LINK_DEFAULTS = [
  { label: "Home", href: "/" },
  { label: "Ways To Give", href: "#" },
  { label: "About Us", href: "#" },
  { label: "Careers", href: "#" },
  { label: "Classes", href: "#" },
  { label: "Volunteer", href: "#" },
  { label: "Accessibility", href: "#" }
];

const FOOTER_DATA = {
  heroImage: "{{!globals.connect_band_hero_image.getImage()}}".trim(),
  logo: "{{!globals.logo.getImage()}}".trim(),
  address: "{{!globals.address}}".trim(),
  phone: "{{!globals.phone}}".trim(),
  email: "{{!globals.email}}".trim(),
  newsletterUrl: "{{!globals.newsletter_signup_url}}".trim(),
  quickLinks: FOOTER_LINKS,
  affiliates: TERRITORY_LINKS,
  version: "v1.0"
};

if (!FOOTER_DATA.quickLinks.length) {
  FOOTER_DATA.quickLinks = QUICK_LINK_DEFAULTS;
}
if (!FOOTER_DATA.affiliates.length) {
  FOOTER_DATA.affiliates = AFFILIATE_DEFAULTS;
}

const rawMission = "{{!globals.mission_statement}}".trim();
FOOTER_DATA.mission = rawMission && rawMission.charAt(0) !== "{" ? rawMission : SA_MISSION;

function SiteFooter() {
  const f = FOOTER_DATA;

  const heroStyle = f.heroImage
    ? {
        backgroundImage: "url(" + f.heroImage + ")",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }
    : null;

  const metaLine = [f.address, f.phone, f.email, "Privacy Policy", "© The Salvation Army"]
    .filter(Boolean)
    .join(" · ");

  return (
    <footer className="bg-background">
      <section className="mx-4 mb-8 mt-9 lg:mt-12">
        {/* Hero band — connect_band_hero_image behind a dark scrim */}
        <div
          className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-card bg-[#3b3b3f] bg-cover bg-center p-6 text-content-ondark lg:min-h-0 lg:aspect-[1400/366] lg:p-10"
          style={heroStyle}
        >
          <div className="absolute inset-0 bg-[rgba(28,27,31,0.3)]"></div>
          <div className="relative z-1 flex items-start justify-between">
            {f.logo ? (
              <img src={f.logo} alt={SITE_NAME} className="h-16 w-auto rounded-lg bg-white p-1.5" />
            ) : (
              <span className="rounded-lg bg-white px-2 py-1 text-title-lg font-bold tracking-tight text-primary">
                {SITE_NAME}
              </span>
            )}
          </div>
          <div className="relative z-1 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="text-[34px] leading-[1.05] lg:text-[54px]">Connect With Us</h2>
            <div className="flex items-center gap-3.5 self-start rounded-2xl bg-surface py-3 pl-5 pr-3 text-content lg:self-auto">
              <span className="hidden text-body-md lg:inline">Having Issues?</span>
              <a href="#" className="btn btn-primary btn-sm">
                Contact Us
              </a>
            </div>
          </div>
        </div>

        {/* Newsletter callout (vendor form link — no inline inputs) + mission */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[7fr_5fr]">
          <div className="flex flex-col items-start gap-5 rounded-2xl bg-surface p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-7 lg:px-7">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2.5">
                <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-primary-subtle text-primary">
                  <Icon className="h-[18px] w-[18px]" id="#i-mail" />
                </span>
                <h5 className="text-body-xl text-content">Sign Up for KROC Updates</h5>
              </div>
              <p className="max-w-[46ch] text-[13.5px] leading-normal text-content-muted">
                Classes, events, and community news — straight to your inbox. Sign-ups are handled
                by our email partner.
              </p>
            </div>
            <a
              href={f.newsletterUrl || "#"}
              className="btn btn-primary flex-none whitespace-nowrap"
            >
              Sign Up for Updates <Icon className="h-[15px] w-[15px]" id="#i-arrowur" />
            </a>
          </div>
          <div className="rounded-2xl bg-primary p-6 text-content-ondark lg:px-7">
            <h5 className="mb-3 text-body-xl">The Salvation Army Mission</h5>
            <p className="text-body-md leading-relaxed">{f.mission}</p>
          </div>
        </div>

        {/* Quick links */}
        <nav className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-5 py-3.5 text-body-md">
          {f.quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={cx(
                "rounded-full px-4 py-2",
                isActive(link.href)
                  ? "bg-primary text-content-ondark"
                  : "text-content hover:bg-surface-muted"
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Meta row */}
        <div className="mt-3 grid grid-cols-1 items-center gap-4 rounded-2xl bg-surface px-5 py-4 text-center text-body-sm text-content-muted lg:grid-cols-[auto_1fr_auto] lg:gap-6 lg:px-6">
          <div className="flex justify-center gap-3.5 text-content lg:justify-start">
            <SocialLinks iconClass="h-[18px] w-[18px]" />
          </div>
          <div className="text-center">{metaLine}</div>
          <div className="lg:text-right">{f.version}</div>
        </div>

        {/* Affiliates */}
        <div className="mt-3 flex flex-wrap items-center gap-x-7 gap-y-2 rounded-2xl bg-surface px-5 py-3.5 text-body-sm text-content-muted">
          <span className="text-content">Affiliate Links</span>
          {f.affiliates.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="inline-flex items-center gap-1 text-primary"
            >
              {link.label} <Icon className="h-3 w-3" id="#i-arrowur" />
            </a>
          ))}
        </div>
      </section>
    </footer>
  );
}
