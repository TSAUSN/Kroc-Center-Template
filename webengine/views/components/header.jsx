const HEADER_DATA = {
  logo: "{{!globals.logo.getImage()}}".trim(),
  region: "{{!globals.facility_name}}".trim() || "KROC Center",
  regionShort: "{{!globals.facility_name}}".trim() || "KROC Center",
  generalHours: "{{!globals.general_hours}}".trim(),
  phone: "{{!globals.phone}}".trim(),
  utilityLinks: [
    { label: "Careers", href: "#" },
    { label: "Donate", href: "#" },
    { label: "Hours & Closures", href: "#" }
  ],
  ctas: {
    member: { label: "Become a Member", href: "#" },
    classes: { label: "Purchase Classes", href: "#" }
  }
};

// static until wired to [program_categories]
const PROGRAM_CATEGORIES = [
  { label: "Aquatics", href: "#", icon: "#i-water" },
  { label: "Group Fitness", href: "#", icon: "#i-dumbbell" },
  { label: "Youth Programs", href: "#", icon: "#i-users" },
  { label: "Arts & Crafts", href: "#", icon: "#i-palette" },
  { label: "Music & Dance", href: "#", icon: "#i-music" },
  { label: "Sports & Rec", href: "#", icon: "#i-ball" },
  { label: "Health & Wellness", href: "#", icon: "#i-heart" },
  { label: "Aging Well (55+)", href: "#", icon: "#i-sun" }
];

// static until [event_categories] exists
const EVENT_CATEGORIES = [
  { label: "Community Events", icon: "#i-users" },
  { label: "Fundraisers", icon: "#i-heart" },
  { label: "Holiday & Seasonal", icon: "#i-gift" },
  { label: "Performances", icon: "#i-ticket" },
  { label: "Workshops", icon: "#i-book" },
  { label: "Sports Tournaments", icon: "#i-trophy" },
  { label: "Family Days", icon: "#i-star" },
  { label: "Special Events", icon: "#i-cal" }
];

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "#" },
  { label: "Membership", href: "#" },
  {
    label: "Classes",
    href: "#",
    mega: {
      index: { label: "All Classes", href: "#" },
      items: PROGRAM_CATEGORIES
    }
  },
  {
    label: "Events",
    href: "#",
    mega: {
      index: { label: "All Events", href: "#" },
      items: EVENT_CATEGORIES
    }
  },
  { label: "Rentals", href: "#" },
  { label: "Church", href: "#" }
];

function SiteHeader() {
  const d = HEADER_DATA;
  const [open, setOpen] = React.useState(false);
  const [openMega, setOpenMega] = React.useState(null);
  const [openSub, setOpenSub] = React.useState(null);
  const headerRef = React.useRef(null);

  React.useEffect(() => {
    if (!openMega) {
      return;
    }
    const onDoc = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setOpenMega(null);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenMega(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMega]);

  const mega = NAV_ITEMS.find((n) => n.label === openMega && n.mega);

  return (
    <React.Fragment>
      {/* ─── DESKTOP ──────────────────────────────────────────────────────── */}
      <header
        ref={headerRef}
        className="relative z-40 mx-4 hidden flex-col rounded-b-card bg-surface shadow-[0_6px_24px_rgba(0,0,0,0.06)] lg:flex"
      >
        {/* utility bar */}
        <div className="flex items-center justify-between gap-6 px-6 py-2 text-body-sm text-content-muted">
          <span className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 text-primary" id="#i-pin" />
            {d.region}
          </span>
          <nav className="flex items-center gap-2.5">
            {d.utilityLinks.map((link, i) => (
              <React.Fragment key={link.label}>
                {i > 0 && <span className="text-[#c8c8cf]">|</span>}
                <a
                  href={link.href}
                  className="underline decoration-primary underline-offset-2 hover:text-content"
                >
                  {link.label}
                </a>
              </React.Fragment>
            ))}
          </nav>
        </div>
        {/* main bar (mega panel anchors to this) */}
        <div className="relative flex items-center gap-6 border-t border-[#eee] px-6 py-3">
          <a href="/" className="flex-none" aria-label={SITE_NAME}>
            {d.logo ? (
              <img src={d.logo} alt={SITE_NAME} className="h-12 w-auto" />
            ) : (
              <span className="text-title-xl font-bold tracking-tight text-primary">
                {SITE_NAME}
              </span>
            )}
          </a>
          <nav className="flex flex-1 items-center gap-[22px] text-body-md text-content">
            {NAV_ITEMS.map((item) => {
              const isOpen = openMega === item.label;
              if (item.mega) {
                return (
                  <a
                    key={item.label}
                    role="button"
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    className={cx(
                      "inline-flex cursor-pointer items-center gap-1 py-1.5",
                      isOpen ? "text-primary" : "hover:text-primary"
                    )}
                    onClick={() => setOpenMega(isOpen ? null : item.label)}
                  >
                    {item.label}
                    <Icon
                      className={cx(
                        "h-2.5 w-2.5 transition-transform duration-200",
                        isOpen ? "rotate-180 text-primary" : "text-content-muted"
                      )}
                      id="#i-chev"
                    />
                  </a>
                );
              }
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className={cx(
                    "py-1.5",
                    isActive(item.href)
                      ? "relative text-primary after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary"
                      : "hover:text-primary"
                  )}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <div className="flex items-center gap-2.5">
            <a href={d.ctas.member.href} className="btn btn-info btn-sm">
              {d.ctas.member.label}
            </a>
            <a href={d.ctas.classes.href} className="btn btn-primary btn-sm">
              {d.ctas.classes.label}
            </a>
          </div>

          {/* mega panel (NAV-2) */}
          {mega && (
            <div
              className="absolute inset-x-2 top-[calc(100%+6px)] z-30 rounded-2xl bg-surface px-6 pb-6 pt-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
              role="region"
              aria-label={mega.label + " menu"}
            >
              <div className="mb-4 flex items-center justify-between border-b border-[#ececec] pb-3">
                <span className="text-[15px] font-semibold text-content">{mega.label}</span>
                <a
                  href={mega.mega.index.href}
                  className="inline-flex items-center gap-1 text-[13.5px] font-medium text-primary hover:underline"
                >
                  {mega.mega.index.label} <Icon className="h-[15px] w-[15px]" id="#i-arrowur" />
                </a>
              </div>
              <div className="grid grid-cols-3 gap-x-6 gap-y-2">
                {mega.mega.items.map((it) => (
                  <a
                    key={it.label}
                    href={it.href || "#"}
                    className="flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-body-md text-content hover:bg-surface-muted"
                  >
                    <span className="inline-flex flex-none text-primary">
                      <Icon className="h-5 w-5" id={it.icon} />
                    </span>
                    <span>{it.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ─── MOBILE: top bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 rounded-b-card bg-surface shadow-[0_6px_22px_rgba(0,0,0,0.07)] lg:hidden">
        <div className="flex items-center justify-between gap-2.5 border-b border-[#f0f0f2] px-[18px] py-1.5 text-[11px] text-content-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <Icon className="h-3 w-3 flex-none text-primary" id="#i-pin" />
            <span className="truncate">{d.regionShort}</span>
          </span>
          <a href="#" className="whitespace-nowrap underline decoration-primary underline-offset-2">
            Hours &amp; Closures
          </a>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <a href="/" className="flex-none" aria-label={SITE_NAME}>
            {d.logo ? (
              <img src={d.logo} alt={SITE_NAME} className="h-9 w-auto" />
            ) : (
              <span className="text-title-lg font-bold tracking-tight text-primary">
                {SITE_NAME}
              </span>
            )}
          </a>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-surface-muted text-content"
              aria-label="Search"
            >
              <Icon className="h-5 w-5" id="#i-search" />
            </button>
            <a
              href={d.ctas.member.href}
              className="btn btn-primary inline-flex h-[42px] rounded-full px-4 text-[13.5px]"
            >
              {d.ctas.member.label}
            </a>
            <button
              type="button"
              className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-surface-muted text-content"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Icon className="h-5 w-5" id="#i-menu" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── MOBILE: scrim + slide-up nav drawer (React-driven) ──────────── */}
      <div
        className={cx(
          "fixed inset-0 z-[90] bg-[rgba(18,18,18,0.55)] transition-opacity duration-300 lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
      ></div>
      <aside
        className={cx(
          "fixed inset-x-0 bottom-0 z-[95] flex h-[86%] flex-col overflow-hidden rounded-t-3xl bg-surface shadow-[0_0_24px_rgba(28,27,31,0.18)] transition-transform duration-300 lg:hidden",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex justify-center py-3">
          <span className="h-[5px] w-11 rounded-full bg-[rgba(28,27,31,0.28)]"></span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-7">
          <div className="flex items-center justify-between py-2">
            {d.logo ? (
              <img src={d.logo} alt={SITE_NAME} className="h-9 w-auto" />
            ) : (
              <span className="text-title-lg font-bold tracking-tight text-primary">
                {SITE_NAME}
              </span>
            )}
            <button
              type="button"
              className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-surface-muted text-content"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <Icon className="h-[18px] w-[18px]" id="#i-close" />
            </button>
          </div>
          <ul className="mt-2">
            {NAV_ITEMS.map((item) => {
              const subOpen = openSub === item.label;
              return (
                <li key={item.label} className="border-b border-[#f0f0f2]">
                  {item.mega ? (
                    <React.Fragment>
                      <a
                        role="button"
                        aria-expanded={subOpen}
                        className={cx(
                          "flex cursor-pointer items-center justify-between py-4 text-[19px]",
                          subOpen ? "text-primary" : "text-content"
                        )}
                        onClick={() => setOpenSub(subOpen ? null : item.label)}
                      >
                        {item.label}
                        <Icon
                          className={cx(
                            "h-[18px] w-[18px] transition-transform duration-200",
                            subOpen ? "rotate-180 text-primary" : "text-[#b6b6bb]"
                          )}
                          id="#i-chev"
                        />
                      </a>
                      {subOpen && (
                        <div className="pb-3">
                          <a
                            href={item.mega.index.href}
                            className="flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-body-md text-primary"
                            onClick={() => setOpen(false)}
                          >
                            {item.mega.index.label} <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
                          </a>
                          {item.mega.items.map((it) => (
                            <a
                              key={it.label}
                              href={it.href || "#"}
                              className="flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-body-md text-content"
                              onClick={() => setOpen(false)}
                            >
                              <span className="inline-flex flex-none text-primary">
                                <Icon className="h-5 w-5" id={it.icon} />
                              </span>
                              {it.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  ) : (
                    <a
                      href={item.href}
                      className={cx(
                        "flex items-center justify-between py-4 text-[19px]",
                        isActive(item.href) ? "text-primary" : "text-content"
                      )}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <a href={d.ctas.member.href} className="btn btn-info">
              {d.ctas.member.label}
            </a>
            <a href={d.ctas.classes.href} className="btn btn-primary">
              {d.ctas.classes.label}
            </a>
          </div>
          <div className="mt-4 flex items-center gap-4 border-t border-[#f0f0f2] pt-4 text-content">
            <SocialLinks iconClass="h-5 w-5" />
          </div>
        </div>
      </aside>
    </React.Fragment>
  );
}
