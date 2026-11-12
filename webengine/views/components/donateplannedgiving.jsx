// DonatePlannedGiving — block: donate_planned_giving (blocks catalog §3.7,
// ticket 2465). The two non-campaign cards on 6.21 Donate Hub: "Your Act of
// Generosity, Our Longevity" (planned giving: body, phone, email, Learn More)
// beside "Donate Used Goods" (body + local thrift organisations).
//
// ONE block for what the catalog filed as two ([donate_planned_giving] +
// [donate_used_goods], ticket 2466, merged) on the
// [church_ministries] precedent: desktop draws both in one 1fr/1fr row,
// mobile stacks them. Fields carry their half (`planned_giving_*`,
// `used_goods_*`). Each half is presence-driven (its heading or body opens
// it); either alone runs full width. Deliberately page content, not
// [donation_campaigns] rows — neither has a Classy link.
//
// Email follows D-17 / SCHEMA-39: the address is never
// printed; the mail link reads "Email us". Phone stays visible and dials.
//
// Organisation links are External URL (a repeater can't hold a relation), run
// through krocExternalUrl; a row without one prints its name as text. Address
// and phone share the line under the name, as both designs draw them.
//
// The Learn More button differs between the designs: red outline on desktop,
// navy fill on mobile, so it is rendered twice and display-toggled. The
// outline is red-300 #C5000E, not --kroc-red: #EF3E42 text on white is 3.86:1
// and fails AA at 13px. Desktop and mobile are separate designs and both are
// followed.
//
// Loads after shared.jsx (Icon, cx) and catalog.jsx (krocExternalUrl).
function DonatePlannedGiving(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const pg = {
    heading: text(d.pgHeading),
    body: text(d.pgBody),
    phone: text(d.pgPhone),
    email: text(d.pgEmail),
    ctaLabel: text(d.pgCtaLabel),
    ctaLink: krocExternalUrl(text(d.pgCtaLink))
  };
  const ug = { heading: text(d.ugHeading), body: text(d.ugBody) };
  const orgs = []
    .concat(d.ugOrganisations || [])
    .flat()
    .filter(Boolean)
    .map((r) => ({
      name: text(r.name),
      link: krocExternalUrl(text(r.link)),
      address: text(r.address),
      phone: text(r.phone)
    }))
    .filter((r) => r.name);

  const hasPg = Boolean(pg.heading || pg.body);
  const hasUg = Boolean(ug.heading || ug.body);
  if (!hasPg && !hasUg) {
    return null;
  }

  const head = (t, more) =>
    t && (
      <h3
        className={cx(
          "text-[19px] leading-[1.25] text-content lg:text-heading-sm lg:leading-[1.3]",
          more && "mb-2 lg:mb-2.5"
        )}
      >
        {t}
      </h3>
    );
  const para = (t, more) =>
    t && (
      <p
        className={cx(
          "text-[13px] leading-[1.6] whitespace-pre-line text-content lg:text-[14.5px] lg:leading-[1.65]",
          more && "mb-3 lg:mb-4"
        )}
      >
        {t}
      </p>
    );

  const hasContacts = Boolean(pg.phone || pg.email);
  const planned = hasPg && (
    <div className="flex flex-col rounded-card bg-surface p-[22px] lg:px-9 lg:py-8">
      {head(pg.heading, pg.body || hasContacts || pg.ctaLabel)}
      {para(pg.body, hasContacts || pg.ctaLabel)}
      {hasContacts && (
        <div
          className={cx(
            "flex flex-col items-start gap-1.5 lg:gap-2",
            pg.ctaLabel && "mb-3.5 lg:mb-5"
          )}
        >
          {pg.phone && (
            <a
              href={"tel:" + pg.phone}
              className="inline-flex items-center gap-2 text-[13px] text-content lg:text-[14px]"
            >
              <Icon
                className="h-[13px] w-[13px] flex-none text-primary lg:h-3.5 lg:w-3.5"
                id="#i-phone"
              />
              {pg.phone}
            </a>
          )}
          {pg.email && (
            <a
              href={"mailto:" + pg.email}
              className="inline-flex items-center gap-2 text-[13px] text-brand-link underline decoration-primary lg:text-[14px]"
            >
              <Icon
                className="h-[13px] w-[13px] flex-none text-primary lg:h-3.5 lg:w-3.5"
                id="#i-mail"
              />
              Email us
            </a>
          )}
        </div>
      )}
      {pg.ctaLabel && (
        <div className="lg:mt-auto">
          <a href={pg.ctaLink || undefined} className="btn btn-secondary btn-sm lg:hidden">
            <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
            {pg.ctaLabel}
          </a>
          <a
            href={pg.ctaLink || undefined}
            className="btn btn-outline-primary btn-sm hidden border-brand-red-300 text-brand-red-300 hover:bg-brand-red-300 hover:text-white lg:inline-flex"
          >
            <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
            {pg.ctaLabel}
          </a>
        </div>
      )}
    </div>
  );

  const used = hasUg && (
    <div className="rounded-card bg-surface p-[22px] lg:px-9 lg:py-8">
      {head(ug.heading, ug.body || orgs.length)}
      {para(ug.body, orgs.length)}
      {orgs.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:gap-3">
          {orgs.map((o, i) => {
            const label = (
              <React.Fragment>
                <Icon className="h-[13px] w-[13px] flex-none" id="#i-arrowur" />
                {o.name}
              </React.Fragment>
            );
            const nameClass =
              "inline-flex items-center gap-[7px] text-[13px] text-brand-link lg:text-[14.5px]";
            return (
              <li key={o.name + i} className="border-t border-brand-area pt-2.5 lg:pt-3">
                {o.link ? (
                  <a href={o.link} className={cx(nameClass, "underline decoration-primary")}>
                    {label}
                  </a>
                ) : (
                  <span className={nameClass}>{label}</span>
                )}
                {(o.address || o.phone) && (
                  <div className="mt-[3px] text-[11.5px] text-content-muted lg:text-[13px]">
                    {o.address}
                    {o.address && o.phone && " · "}
                    {o.phone && <a href={"tel:" + o.phone}>{o.phone}</a>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (hasPg && hasUg) {
    return (
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 lg:items-stretch lg:gap-4">
        {planned}
        {used}
      </div>
    );
  }

  return planned || used;
}
