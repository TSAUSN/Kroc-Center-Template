// Catalog detail bodies: CourseDetail (a Course page), ClassDetail (a Class
// page) and ClassGate (a Class page its course hides). Loaded after
// catalogsections.jsx.
//
// Each page view inlines its own Traction Rec row (and, for a course, its
// classes) at render time, so the main content needs no request. Only the
// siblings and the crumb trail are fetched, in parallel and without blocking.

/* ---------------------------------------------------------------------------
   Course detail — the leaf listing page above the Classes themselves.
--------------------------------------------------------------------------- */

// Sidebar summary. Every row is rolled up from the Course's Classes, so a row
// with nothing behind it is dropped rather than rendered as a blank label, and
// a Course with no Classes at all falls back to a single line.
function CourseGlance(props) {
  const rows = [].concat(props.rows || []).filter((r) => r && r[1]);
  let body = null;
  if (rows.length) {
    // label left / value right on one line: reads as a spec list at 320px in
    // the sidebar, and doesn't strand the values when the grid stacks
    body = (
      <dl className="divide-y divide-black/5">
        {rows.map((r) => (
          <div
            key={r[0]}
            className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
          >
            <dt className="flex-none text-[13px] text-content-muted">{r[0]}</dt>
            <dd className="text-right text-[14.5px] text-content">{r[1]}</dd>
          </div>
        ))}
      </dl>
    );
  } else {
    body = <div className="text-[14px] text-content-muted">Schedule coming soon</div>;
  }
  return (
    <div className="rounded-card bg-surface p-6">
      <div className="mb-3 text-[13px] uppercase tracking-[0.08em] text-content-muted">
        At a glance
      </div>
      {body}
    </div>
  );
}

// Sibling Courses under the same Program, names only. Shows the first
// KROC_OTHER_COURSES rows, then scrolls: a program can carry 28 siblings (Group
// Swim Lessons), which would otherwise run the sidebar far past the page.
const KROC_OTHER_COURSES = 5;

function OtherCourses(props) {
  const list = [].concat(props.courses || []).filter(Boolean);
  const listRef = React.useRef(null);
  const [cap, setCap] = React.useState(null);

  // The cap is MEASURED from the first five rows, not fixed: a long title wraps
  // to two lines, and a fixed height would then show four and a half courses.
  // Re-measured on resize, since the wrap points move with the sidebar width.
  React.useLayoutEffect(() => {
    const measure = () => {
      const el = listRef.current;
      if (!el || el.children.length <= KROC_OTHER_COURSES) {
        setCap(null);
        return;
      }
      const rows = [].slice.call(el.children, 0, KROC_OTHER_COURSES);
      setCap(rows.reduce((sum, row) => sum + row.offsetHeight, 0));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [list.length]);

  if (!list.length) {
    return null;
  }
  const capStyle = cap ? { maxHeight: cap + "px" } : undefined;
  return (
    <div className="mt-6 rounded-card bg-surface p-6">
      <div className="mb-3 text-[13px] uppercase tracking-[0.08em] text-content-muted">
        Other courses
      </div>
      <div ref={listRef} style={capStyle} className="-mr-3 overflow-y-auto pr-3">
        {list.map((c) => (
          <a
            key={c.id || c.title}
            href={c.url || undefined}
            className="block py-1.5 text-[14px] text-content hover:underline"
          >
            {c.title}
          </a>
        ))}
      </div>
    </div>
  );
}

// Course detail body: the About card + sidebar, then the Course's own Classes
// in the same day bands the Program page uses.
//   data.ds  krocDs bundle the page printed: this course (ds.self), its
//            classes, the program's other courses (the sidebar), and the
//            program and category for the crumbs
function CourseDetail(props) {
  const d = props.data || {};
  const ds = d.ds || krocDs(null);
  const course = ds.self ? krocDsCourseToCard(ds.self) : null;
  const classes = course ? krocDsClassesOf(ds, course.id) : [];
  const siblings = course
    ? ds.courses
        .filter((c) => c.program === course.programId && c.zuid !== course.id && krocDsActive(c))
        .map(krocDsCourseToCard)
    : [];

  // Location has no Traction Rec source (no Location object in the org), so
  // that row drops out until one exists.
  const glance = [
    ["Ages", krocRollUp(krocTrSortClasses(classes), "ages")],
    ["Location", krocRollUp(classes, "location")],
    ["Classes", classes.length ? String(classes.length) : ""]
  ];

  const description = course ? course.description : "";
  const hasDesc = krocTextLength(description) > 0;
  const descHtml = { __html: description };

  let classBody = null;
  if (!course) {
    classBody = "Classes couldn’t be loaded right now.";
  } else if (!classes.length) {
    classBody = "Class dates for this course haven’t been posted yet — check back soon.";
  }

  return (
    <div>
      <div className="mb-11 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <div className="rounded-card bg-surface px-6 py-8 sm:px-9">
          <h2 className="mb-3 text-heading-sm text-content">About this course</h2>
          {hasDesc ? (
            <div
              className="kroc-prose text-[15px] leading-[1.6] text-content"
              dangerouslySetInnerHTML={descHtml}
            ></div>
          ) : (
            <p className="text-[15px] text-content-muted">
              A description for this course hasn’t been added yet.
            </p>
          )}
        </div>
        <aside>
          <CourseGlance rows={glance} />
          <OtherCourses courses={siblings} />
        </aside>
      </div>

      <h2 className="mb-[18px] text-heading-md text-content">Classes</h2>
      {classBody ? (
        <div className="rounded-card bg-surface px-6 py-16 text-center text-content-muted">
          {classBody}
        </div>
      ) : (
        <ClassList classes={classes} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Class detail — the dated leaf (TractionRec's Course Session Option).
--------------------------------------------------------------------------- */

function ShareLinks(props) {
  const [copied, setCopied] = React.useState(false);
  const url = props.url || window.location.href;
  const enc = encodeURIComponent(url);
  const links = [
    ["#i-fb", "Share on Facebook", "https://www.facebook.com/sharer/sharer.php?u=" + enc],
    [
      "#i-x",
      "Share on X",
      "https://twitter.com/intent/tweet?url=" +
        enc +
        "&text=" +
        encodeURIComponent(props.title || "")
    ],
    ["#i-li", "Share on LinkedIn", "https://www.linkedin.com/sharing/share-offsite/?url=" + enc]
  ];

  // Instagram has no share URL, so the prototype's fourth icon is a copy-link
  // button instead — the same job, and it actually works.
  const copy = () => {
    if (!navigator.clipboard) {
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      (err) => console.error("KROC: copy link failed", err)
    );
  };

  return (
    <div className="flex items-center gap-3.5 text-[13px] text-content-muted">
      <span>{copied ? "Link copied" : "Share"}</span>
      {links.map((l) => (
        <a
          key={l[0]}
          href={l[2]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l[1]}
          className="text-content-muted hover:text-content"
        >
          <Icon className="h-4 w-4" id={l[0]} />
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy link"
        className="cursor-pointer border-0 bg-transparent p-0 text-content-muted hover:text-content"
      >
        <Icon className="h-4 w-4" id="#i-arrowur" />
      </button>
    </div>
  );
}

// One labelled fact in the Class detail sidebar.
function ClassFact(props) {
  return (
    <div className="mb-3.5">
      <div className="mb-1 text-[13px] text-content-muted">{props.label}</div>
      {props.children}
    </div>
  );
}

// Class detail body: crumbs + share, title, wide hero, then the facts sidebar
// beside the description, then the course's other classes.
//   data.ds        krocDs bundle the page printed: this class (ds.self), the
//                  other classes of its course, and the course, program and
//                  category for the crumbs — every schedule, price and
//                  availability fact
//   data.title     the Zesty title, used only when there is no dataset row
//   data.heroWide / kind / location / tags — Zesty-only, from this page's item
function ClassDetail(props) {
  const d = props.data || {};
  const ds = d.ds || krocDs(null);
  const self = ds.self;
  const c = self ? krocDsClassToCard(self) : { title: d.title || "" };
  c.kind = d.kind || "";
  c.location = d.location || "";
  const siblings = self ? krocDsClassesOf(ds, self.course).filter((x) => x.id !== c.id) : [];

  const schedule = [c.dayPlural, c.time].filter(Boolean);
  const calendarUrl = krocCalendarUrl(c);
  const hasDesc = krocTextLength(c.desc) > 0;
  const descHtml = { __html: c.desc };
  const tags = [].concat(d.tags || []).filter(Boolean);
  const hasPrices = !!c.memberPrice || !!c.publicPrice || !!c.price;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CatalogCrumbs kind="class" trail={krocDsTrail("class", ds)} title={c.title} />
        <ShareLinks title={c.title} />
      </div>

      <h1 className="mb-4 text-heading-md text-content lg:text-heading-lg">{c.title}</h1>

      <div className="relative aspect-16/7 w-full overflow-hidden rounded-card bg-surface-muted">
        {d.heroWide && (
          <img src={d.heroWide} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!!c.kind && (
          <span className="absolute left-3.5 top-3.5 z-10 inline-flex rounded-full bg-primary px-[11px] py-[5px] text-[12px] text-content-ondark">
            {c.kind}
          </span>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-12 rounded-card bg-surface px-6 py-8 sm:px-12 lg:grid-cols-[320px_1fr]">
        <aside>
          {schedule.length > 0 && (
            <ClassFact label="Date & Time">
              {schedule.map((s) => (
                <div key={s} className="text-[16px] text-content">
                  {s}
                </div>
              ))}
            </ClassFact>
          )}

          {!!c.dates && (
            <ClassFact label="Class Dates">
              <div className="flex items-center gap-2 text-[16px] text-content">
                <Icon className="h-3.5 w-3.5 flex-none text-content-muted" id="#i-cal" />
                {c.dates}
              </div>
            </ClassFact>
          )}

          {!!c.instructor && (
            <ClassFact label="Instructor">
              <div className="text-[16px] text-content">{c.instructor}</div>
            </ClassFact>
          )}

          {!!c.ages && (
            <ClassFact label="Ages">
              <span className="inline-flex rounded-full bg-surface-muted px-[11px] py-[5px] text-[12px] text-content-muted">
                {c.ages}
              </span>
            </ClassFact>
          )}

          {hasPrices && <ClassPrices item={c} className="mb-3.5" />}

          {!!c.availability && (
            <ClassFact label="Availability">
              <AvailabilityPill item={c} />
            </ClassFact>
          )}

          {!!c.location && (
            <div className="mt-3.5 border-t border-black/5 pt-3.5">
              <ClassFact label="Location">
                <div className="text-[15px] text-content">{c.location}</div>
              </ClassFact>
            </div>
          )}

          {!!self && (
            <div className="mt-4 border-t border-black/5 pt-4">
              {c.isOpen ? (
                <a href={c.enrollUrl || undefined} className="btn btn-primary btn-block mb-2">
                  {c.enrollLabel === "Join Waitlist" ? "Join Waitlist" : "Register Now"}
                </a>
              ) : (
                <span className="btn btn-block mb-2 cursor-default bg-surface-muted text-content-muted">
                  Enrollment Closed
                </span>
              )}
              {!!calendarUrl && (
                <a
                  href={calendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-info btn-sm btn-block"
                >
                  <Icon className="h-3.5 w-3.5" id="#i-cal" /> Add to Calendar
                </a>
              )}
            </div>
          )}
        </aside>

        <div>
          <h2 className="mb-3 text-heading-sm text-content">About this class</h2>
          {hasDesc ? (
            <div
              className="kroc-prose text-[15px] leading-[1.6] text-content"
              dangerouslySetInnerHTML={descHtml}
            ></div>
          ) : (
            <p className="text-[15px] text-content-muted">
              A description for this class hasn’t been added yet.
            </p>
          )}
          {tags.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <a
                  key={t.label}
                  href={t.url || undefined}
                  className="inline-flex rounded-full bg-surface-muted px-[13px] py-[7px] text-[12.5px] text-content hover:text-primary"
                >
                  {t.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {siblings.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-[18px] text-heading-md text-content">Other classes in this course</h2>
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
            {siblings.map((s) => (
              <ClassCard key={s.id || s.title} item={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// What a class page shows when its course hides class pages
// (krocDsClassGate): a short holding card while it sends the visitor to the
// course page, where every time for the course is listed. replace() keeps the
// class page out of history, so Back doesn't bounce into the redirect again.
// The card is the whole page: the view's other content (its autolayout) is
// hidden, and noindex is set for crawlers that stop at the class URL.
function ClassGate(props) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const host = ref.current && ref.current.parentNode;
    if (host && host.parentNode) {
      Array.from(host.parentNode.children).forEach((n) => {
        if (n !== host && n.tagName !== "SCRIPT") {
          n.hidden = true;
        }
      });
    }
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    window.location.replace(props.url);
  }, [props.url]);

  return (
    <div
      ref={ref}
      role="status"
      className="rounded-card bg-surface px-6 py-16 text-center text-content-muted"
    >
      <h1 className="mb-3 text-heading-sm text-content">Class times are on the course page</h1>
      <p className="mb-6">Taking you there now…</p>
      <a href={props.url} className="btn btn-primary">
        See class times
      </a>
    </div>
  );
}
