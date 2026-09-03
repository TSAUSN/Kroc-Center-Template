function ContactLine(props) {
  if (!props.value) {
    return null;
  }
  return (
    <a
      href={props.kind === "mail" ? "mailto:" + props.value : "tel:" + props.value}
      className={cx(
        "flex items-center gap-2 text-[12.5px]",
        props.center && "justify-center text-[13px]",
        props.kind === "mail" ? "mb-2.5 text-brand-link" : "text-content-muted"
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-none" id={props.kind === "mail" ? "#i-mail" : "#i-phone"} />
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
        <ContactLine kind="mail" value={p.email} />
        <ContactLine kind="phone" value={p.phone} />
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
          <div className="my-5 h-px bg-[#e4e4e7]"></div>
          <ContactLine kind="mail" value={p.email} center />
          <ContactLine kind="phone" value={p.phone} center />
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
        </div>
      </div>
    </div>
  );
}

function PeopleBlock(props) {
  const d = props.data || {};
  const people = []
    .concat(d.people || [])
    .flat()
    .sort((a, b) => parseInt(a.sort_order || 0, 10) - parseInt(b.sort_order || 0, 10));
  if (!people.length) {
    return null;
  }

  const layout = (d.layout || "cards").toLowerCase();

  if (layout === "featured") {
    return <PersonFeature person={people[0]} heading={d.featureHeading} leadIn={d.leadIn} />;
  }

  return (
    <div>
      {d.title && <h3 className="mb-[18px] text-heading-md text-content">{d.title}</h3>}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {people.map((p) => (
          <PersonCard key={p.name} person={p} />
        ))}
      </div>
    </div>
  );
}
