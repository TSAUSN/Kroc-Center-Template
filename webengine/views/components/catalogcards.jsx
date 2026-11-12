// Catalog cards: ProgramCard (categories + programs), ClassCard, the day-banded
// ClassList, and the expandable CourseRow. Loaded after catalogdata.jsx.
// Pure presentation — every prop comes from the krocTr*ToCard adapters there.

// The prototype's CategoryCard face, reused for Programs: icon (or photo) +
// title + summary + a secondary CTA. Whole card is the link target.
function ProgramCard(props) {
  const c = props.card || {};
  const cta = props.ctaLabel || "View Program";
  return (
    <a
      href={c.url || undefined}
      className="group flex flex-col overflow-hidden rounded-card bg-surface transition hover:shadow-card"
    >
      <div className="flex flex-1 flex-col px-6 pb-6 pt-6">
        <span className="mb-4 inline-flex h-14 w-14 flex-none items-center justify-center rounded-[14px] bg-primary-subtle text-primary">
          <CatalogIcon url={c.iconUrl} name={c.title} />
        </span>
        <h3 className="mb-2 text-[20px] leading-[1.3] text-content">{c.title}</h3>
        {c.summary && (
          <p className="line-clamp-3 text-[13.5px] leading-[1.55] text-content-muted">
            {c.summary}
          </p>
        )}
        <span className="btn btn-secondary btn-sm mt-5 self-start">{cta}</span>
      </div>
    </a>
  );
}

function ClassPrice(props) {
  return (
    <div>
      <div className="text-[11px] uppercase text-content-muted">{props.label}</div>
      <div className="text-[14px] text-content">{props.value}</div>
    </div>
  );
}

// Member / Public, or a single Price when the product has one untyped level.
function ClassPrices(props) {
  const c = props.item || {};
  const single = !!c.price && !c.memberPrice && !c.publicPrice;
  if (!c.memberPrice && !c.publicPrice && !c.price) {
    return null;
  }
  return (
    <div className={cx("flex gap-[18px]", props.className)}>
      {single && <ClassPrice label="Price" value={c.price} />}
      {!!c.memberPrice && <ClassPrice label="Members" value={c.memberPrice} />}
      {!!c.publicPrice && <ClassPrice label="Public" value={c.publicPrice} />}
    </div>
  );
}

// Green when registration is open (spots left, unlimited, or a waitlist with
// room), grey when full or not offered online.
function AvailabilityPill(props) {
  const c = props.item || {};
  if (!c.availability) {
    return null;
  }
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-[11px] py-[5px] text-[12px]",
        c.isOpen ? "bg-success/10 text-success" : "bg-surface-muted text-content-muted"
      )}
    >
      {c.availability}
    </span>
  );
}

// The single Class card: 16:9 hero (or a navy colour-cover when the class has
// no image) with the type pill overlaid, then the leaf-class schema — dates,
// day/time, ages, instructor, location, availability, Member/Public prices.
// A class with a Description is clickable and opens a marketing modal.
function ClassCard(props) {
  const c = props.item || {};
  const [modal, setModal] = React.useState(false);
  // Measure the text, not the markup — an "empty" rich text can still be <p></p>.
  const canOpen = krocTextLength(c.desc) > 0;
  const descHtml = { __html: c.desc };
  const dayTime = [c.day, c.time].filter(Boolean).join(" · ");

  const meta = [
    c.dates && ["#i-cal", c.dates],
    dayTime && ["#i-clock", dayTime],
    c.ages && ["#i-users", c.ages],
    c.instructor && ["#i-star", c.instructor],
    c.location && ["#i-pin", c.location]
  ].filter(Boolean);

  React.useEffect(() => {
    if (!modal) {
      return undefined;
    }
    const onKey = (e) => {
      if (e.key === "Escape") {
        setModal(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  const metaRows = meta.length > 0 && (
    <div className="flex flex-col gap-2 text-[13px] text-content-muted">
      {meta.map((m) => (
        <div key={m[0] + m[1]} className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 flex-none" id={m[0]} />
          {m[1]}
        </div>
      ))}
    </div>
  );

  const availPill = !!c.availability && <AvailabilityPill item={c} />;
  const hasPrices = !!c.memberPrice || !!c.publicPrice || !!c.price;

  const enroll = c.isOpen ? (
    <a
      href={c.enrollUrl || c.url || undefined}
      onClick={(e) => e.stopPropagation()}
      className="btn btn-primary btn-sm"
    >
      {c.enrollLabel || "Enroll"}
    </a>
  ) : (
    <span className="btn btn-sm cursor-default bg-surface-muted text-content-muted">
      Enrollment Closed
    </span>
  );

  const openModal = (e) => {
    e.stopPropagation();
    setModal(true);
  };

  const modalNode =
    modal &&
    ReactDOM.createPortal(
      <div
        onClick={() => setModal(false)}
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(28,27,31,0.5)] p-6"
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[520px] rounded-card bg-surface px-9 py-8 shadow-card"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setModal(false)}
            className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-surface-muted text-content"
          >
            <Icon className="h-4 w-4" id="#i-close" />
          </button>
          {!!c.kind && (
            <span className="inline-flex rounded-full bg-primary px-[11px] py-[5px] text-[12px] text-content-ondark">
              {c.kind}
            </span>
          )}
          <h3 className="mb-2.5 mt-3 text-heading-sm text-content">{c.title}</h3>
          {metaRows && <div className="mb-4">{metaRows}</div>}
          {availPill && <div className="mb-4">{availPill}</div>}
          {hasPrices && <ClassPrices item={c} className="mb-[18px]" />}
          <div
            className="kroc-prose mb-6 text-[14.5px] leading-[1.65] text-content"
            dangerouslySetInnerHTML={descHtml}
          ></div>
          <div className="flex gap-3">
            {c.isOpen && (
              <a href={c.enrollUrl || c.url || undefined} className="btn btn-primary">
                {c.enrollLabel || "Enroll"}
              </a>
            )}
            <button
              type="button"
              onClick={() => setModal(false)}
              className="btn btn-outline-primary"
            >
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div
      onClick={canOpen ? () => setModal(true) : undefined}
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      onKeyDown={
        canOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setModal(true);
              }
            }
          : undefined
      }
      className={cx(
        "flex flex-col overflow-hidden rounded-card bg-surface",
        props.bordered && "border border-black/10",
        canOpen && "cursor-pointer transition hover:shadow-card"
      )}
    >
      {c.image ? (
        <div className="relative aspect-video w-full bg-surface-muted">
          <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {!!c.kind && (
            <span className="absolute left-3.5 top-3.5 z-10 inline-flex rounded-full bg-primary px-[11px] py-[5px] text-[12px] text-content-ondark">
              {c.kind}
            </span>
          )}
        </div>
      ) : (
        <div className="relative flex aspect-video w-full items-end bg-secondary px-5 py-[18px]">
          {!!c.kind && (
            <span className="absolute left-3.5 top-3.5 inline-flex rounded-full bg-primary px-[11px] py-[5px] text-[12px] text-content-ondark">
              {c.kind}
            </span>
          )}
          <h4 className="text-[22px] leading-[1.15] text-content-ondark">{c.title}</h4>
        </div>
      )}

      <div className="flex flex-1 flex-col px-5 py-[18px]">
        {!!c.image && <h4 className="mb-3 text-[17px] leading-[1.25] text-content">{c.title}</h4>}
        {metaRows}
        {availPill && <div className="mb-[18px] mt-3">{availPill}</div>}
        <div className="mt-auto border-t border-black/5 pt-3.5">
          {hasPrices && <ClassPrices item={c} className="mb-3.5" />}
          <div className="flex items-center gap-3">
            {enroll}
            {canOpen && (
              <button
                type="button"
                onClick={openModal}
                className="cursor-pointer border-0 bg-transparent text-[13px] text-brand-link"
              >
                Details
              </button>
            )}
          </div>
        </div>
      </div>

      {modalNode}
    </div>
  );
}

// A collapsible day band (navy header) + its class grid. Open by default.
function DayGroup(props) {
  const [open, setOpen] = React.useState(true);
  const count = props.count || 0;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cx(
          "flex w-full cursor-pointer items-center gap-3 rounded-[8px] border-0 bg-secondary px-4 py-2 text-left text-[13px] font-semibold tracking-[0.04em] text-content-ondark",
          open && "mb-3.5"
        )}
      >
        <span className="flex-1">{props.label}</span>
        <span className="text-[12px] font-normal opacity-70">
          {count} {count === 1 ? "class" : "classes"}
        </span>
        <span className={cx("inline-flex transition", open && "rotate-180")}>
          <Icon className="h-4 w-4" id="#i-chev" />
        </span>
      </button>
      {open && props.children}
    </div>
  );
}

// Classes for one Course, banded by the days they meet, in calendar order.
// A class meeting Monday and Wednesday gets one "Monday & Wednesday" band
// rather than a card in each (Decision B assumed one day per class; 65% of
// Traction Rec options meet on more). Undated classes trail as "Schedule".
// `bordered` is for cards sitting on a white surface (the Program-detail
// course row) — on the page background they separate on their own.
function ClassList(props) {
  const classes = krocTrSortClasses([].concat(props.classes || []).filter(Boolean));
  const order = [];
  const byDay = {};
  classes.forEach((c) => {
    const label = c.day || "Schedule";
    if (!byDay[label]) {
      byDay[label] = [];
      order.push(label);
    }
    byDay[label].push(c);
  });

  return (
    <div className="flex flex-col gap-[22px]">
      {order.map((label) => (
        <DayGroup key={label} label={label} count={byDay[label].length}>
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {byDay[label].map((c) => (
              <ClassCard key={c.id || c.title} item={c} bordered={props.bordered} />
            ))}
          </div>
        </DayGroup>
      ))}
    </div>
  );
}

// A Course as an expandable row — recreates the client's TractionRec catalog UI.
// The row header carries the rolled-up age range and the class count; expanding
// reveals the Course Description (clamped to 3 lines behind Show more) and the
// day-banded Classes.
function CourseRow(props) {
  const c = props.course || {};
  const classes = [].concat(props.classes || []).filter(Boolean);
  const [open, setOpen] = React.useState(!!props.defaultOpen);
  const [more, setMore] = React.useState(false);
  const ageRange = krocRollUp(classes, "ages");
  const ready = props.classesReady !== false;
  const descLength = krocTextLength(c.description);
  const hasDesc = descLength > 0;
  const longCopy = descLength > 180;
  const descHtml = { __html: c.description };

  let countLabel = "";
  if (ready) {
    countLabel = classes.length
      ? classes.length + (classes.length === 1 ? " class" : " classes")
      : "Schedule coming soon";
  }

  return (
    <div className="overflow-hidden rounded-card bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 border-0 bg-transparent px-5 py-4 text-left"
      >
        <span
          className={cx(
            "inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary-subtle text-primary transition",
            open && "rotate-180"
          )}
        >
          <Icon className="h-4 w-4" id="#i-chev" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] text-content">{c.title}</span>
            {!!ageRange && (
              <span className="inline-flex rounded-full bg-surface-muted px-[11px] py-[5px] text-[12px] text-content-muted">
                {ageRange}
              </span>
            )}
          </span>
        </span>
        <span className="whitespace-nowrap text-[13px] text-content-muted">{countLabel}</span>
      </button>

      {open && (
        <div className="border-t border-black/5 p-5">
          {hasDesc && (
            <div className="mb-[18px]">
              <div
                className={cx(
                  "kroc-prose text-[13.5px] leading-[1.55] text-content",
                  longCopy && !more && "line-clamp-3"
                )}
                dangerouslySetInnerHTML={descHtml}
              ></div>
              {longCopy && (
                <button
                  type="button"
                  onClick={() => setMore((m) => !m)}
                  aria-expanded={more}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent text-[13px] text-primary"
                >
                  {more ? "Show less" : "Show more"}
                  <span className={cx("inline-flex transition", more && "rotate-180")}>
                    <Icon className="h-3.5 w-3.5" id="#i-chev" />
                  </span>
                </button>
              )}
            </div>
          )}

          {!ready && (
            <div className="rounded-card bg-surface-muted px-5 py-[18px] text-center text-[14px] text-content-muted">
              Loading classes…
            </div>
          )}
          {ready && classes.length > 0 && <ClassList classes={classes} bordered />}
          {ready && classes.length === 0 && (
            <div className="rounded-card bg-surface-muted px-5 py-[18px] text-center text-[14px] text-content-muted">
              Class dates for this course haven’t been posted yet — check back soon.
            </div>
          )}

          {!!c.url && (
            <div className="mt-4">
              <a
                href={c.url}
                className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
              >
                View full course details <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
