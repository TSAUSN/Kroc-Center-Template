// PeopleBlock — block: people. Layouts (the `layout_variant` dropdown):
//   cards     4-up portrait cards ("Meet the Team")
//   featured  1-up card with a profile panel + bio ("Hello from the …")
//   contact   compact horizontal cards, round photo left, no bio — 6.20 Careers
//             "Questions?" (variant "Careers HR Contacts", ticket 2463, filed in
//             the catalog as [careers_hr_contacts]). A layout here rather than a
//             model: its fields (photo, name, role, email) are exactly this
//             repeater's, and only the arrangement differs.
//
// Email follows D-17 / SCHEMA-39 in every layout: the address is
// never printed; the mailto sits behind "Contact {first name}" ("Contact us"
// without a name). Phone stays visible. The cards and featured layouts follow
// the prototype's fixed versions (button after the phone line / at the end of
// the bio column). The contact layout keeps its own link style but the D-17
// label on both surfaces: desktop drew the raw address, mobile "Email Us", and
// two identical "Email Us" links in one section don't say whom they reach.
//
// Headshots are repeater Media, so bare ZUIDs, resolved client-side by
// useKrocMediaUrls (cardgrid.jsx, which loads first). Before that, the
// component read a `headshot` key the data never had, so no photo ever showed.
//
// Contact columns follow the card count like [card_grid] (1 -> full, 2 or 4 ->
// 2-up, else 3-up); mobile stacks. The section heading is the block's
// `block_name`, as in the cards layout. Desktop and mobile are separate designs
// and both are followed (84 vs 64px photo, 19 vs 17px name, 14 vs 11.5px role).
const krocFirstName = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)[0];

function ContactLink(props) {
  const first = krocFirstName(props.name);
  return (
    <a
      href={"mailto:" + props.email}
      className={cx("btn btn-primary", props.small && "btn-sm", props.className)}
    >
      <Icon className="h-[13px] w-[13px] flex-none" id="#i-mail" />
      {first ? "Contact " + first : "Contact us"}
    </a>
  );
}

function PhoneLine(props) {
  if (!props.value) {
    return null;
  }
  return (
    <a
      href={"tel:" + props.value}
      className={cx(
        "flex items-center gap-2 text-[12.5px] text-content-muted",
        props.center && "justify-center text-[13px]",
        props.className
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-none" id="#i-phone" />
      {props.value}
    </a>
  );
}

function PersonCard(props) {
  const p = props.person;
  return (
    <div className="overflow-hidden rounded-card bg-surface">
      {p.headshot ? (
        <img
          src={p.headshot}
          alt={p.name}
          className="aspect-square w-full bg-surface-muted object-cover"
        />
      ) : (
        <div className="aspect-square w-full bg-surface-muted"></div>
      )}
      <div className="px-5 py-4">
        <div className="text-[17px] text-content">{p.name}</div>
        <div className="mb-2.5 text-[13px] text-content-muted">{p.role}</div>
        {p.bio && <p className="mb-3 text-[13px] leading-normal text-content">{p.bio}</p>}
        <PhoneLine value={p.phone} className="mb-2.5" />
        {p.email && <ContactLink name={p.name} email={p.email} small />}
      </div>
    </div>
  );
}

function PersonFeature(props) {
  const p = props.person;
  return (
    <div className="rounded-card bg-surface p-6 lg:px-12 lg:py-11">
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[300px_1fr] lg:gap-11">
        {/* profile panel */}
        <div className="rounded-2xl bg-[#f6f6f8] px-[26px] py-[30px] text-center">
          {p.headshot ? (
            <img
              src={p.headshot}
              alt={p.name}
              className="mx-auto mb-[18px] h-[150px] w-[150px] rounded-full bg-[#e6e6e9] object-cover"
            />
          ) : (
            <div className="mx-auto mb-[18px] h-[150px] w-[150px] rounded-full bg-[#e6e6e9]"></div>
          )}
          <div className="mb-2 text-[19px] font-semibold text-content">{p.name}</div>
          {p.role && (
            <span className="inline-block rounded-full bg-[rgba(0,32,86,0.08)] px-3 py-1 text-[12.5px] font-semibold text-secondary">
              {p.role}
            </span>
          )}
          {p.phone && (
            <React.Fragment>
              <div className="my-5 h-px bg-[#e4e4e7]"></div>
              <PhoneLine value={p.phone} center />
            </React.Fragment>
          )}
        </div>
        {/* greeting + bio */}
        <div>
          {props.heading && (
            <h3 className="mb-[18px] text-[28px] font-normal tracking-[-0.01em] text-content-muted">
              {props.heading}
            </h3>
          )}
          {props.leadIn && (
            <p className="mb-3 text-body-lg font-semibold text-content">{props.leadIn}</p>
          )}
          {p.bio && <p className="text-[15.5px] leading-[1.7] text-content">{p.bio}</p>}
          {p.email && <ContactLink name={p.name} email={p.email} className="mt-[22px]" />}
        </div>
      </div>
    </div>
  );
}

function PersonContact(props) {
  const p = props.person;
  const first = krocFirstName(p.name);
  return (
    <div className="flex items-center gap-4 rounded-card bg-surface px-5 py-[18px] lg:gap-5 lg:px-7 lg:py-6">
      {p.hasPhoto && (
        <div className="h-16 w-16 flex-none overflow-hidden rounded-full bg-surface-muted lg:h-[84px] lg:w-[84px]">
          {p.headshot && <img src={p.headshot} alt="" className="h-full w-full object-cover" />}
        </div>
      )}
      <div className="min-w-0">
        {p.name && (
          <div className="text-[17px] leading-[1.3] font-medium text-content lg:text-[19px]">
            {p.name}
          </div>
        )}
        {p.role && (
          <div className="text-[11.5px] leading-[1.45] text-content-muted lg:text-[14px]">
            {p.role}
          </div>
        )}
        {(p.phone || p.email) && (
          <div className="mt-1.5 flex flex-col items-start gap-1 lg:mt-2.5">
            <PhoneLine value={p.phone} className="lg:text-[14px]" />
            {p.email && (
              <a
                href={"mailto:" + p.email}
                className="inline-flex items-center gap-[7px] text-[13px] text-brand-link underline decoration-primary lg:gap-2 lg:text-[14px]"
              >
                <Icon
                  className="h-[13px] w-[13px] flex-none text-primary lg:h-[15px] lg:w-[15px]"
                  id="#i-mail"
                />
                {first ? "Contact " + first : "Contact us"}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PeopleBlock(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();
  const rows = []
    .concat(d.people || [])
    .flat()
    .filter(Boolean)
    .sort((a, b) => parseInt(a.sort_order || 0, 10) - parseInt(b.sort_order || 0, 10));

  const urls = useKrocMediaUrls(rows.map((r) => krocMediaZuid(r.headshot_image)));

  const people = rows
    .map((r) => ({
      name: text(r.name),
      role: text(r.role),
      bio: text(r.bio),
      email: text(r.email),
      phone: text(r.phone),
      hasPhoto: text(r.headshot_image) !== "",
      headshot: krocMediaDirectUrl(r.headshot_image) || urls[krocMediaZuid(r.headshot_image)] || ""
    }))
    .filter((p) => p.name || p.role || p.email || p.phone);
  if (!people.length) {
    return null;
  }

  const layout = text(d.layout).toLowerCase();

  if (layout === "featured") {
    return <PersonFeature person={people[0]} heading={d.featureHeading} leadIn={d.leadIn} />;
  }

  if (layout.indexOf("contact") !== -1) {
    const n = people.length;
    const cols = n === 1 ? "" : n % 2 === 0 && n % 3 !== 0 ? "lg:grid-cols-2" : "lg:grid-cols-3";
    const title = text(d.title);
    return (
      <div className={cx(title && "lg:pt-4")}>
        {title && (
          <h2 className="mb-3.5 text-[22px] leading-[1.2] text-content lg:mb-[18px] lg:text-heading-md lg:leading-[1.25]">
            {title}
          </h2>
        )}
        <div className={cx("grid grid-cols-1 gap-3 lg:gap-4", cols)}>
          {people.map((p, i) => (
            <PersonContact key={p.name + i} person={p} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {d.title && <h3 className="mb-[18px] text-heading-md text-content">{d.title}</h3>}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {people.map((p, i) => (
          <PersonCard key={p.name + i} person={p} />
        ))}
      </div>
    </div>
  );
}
