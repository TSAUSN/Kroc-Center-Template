// HoursGeneral — block: hours_general (blocks catalog §3.8, ticket 2470). The
// building's opening hours on 6.22 Hours of Operation (Erin's "General Hours
// of Operation", 💬1871728292): heading + live Open/Closed pill, a seasonal
// label, day/time rows with today emphasised, and a footnote — plus the red
// Closure Alerts card beside it ("Text KROCINFO to 833.200.7028").
//
// ONE block for what the catalog filed as two ([hours_general] +
// [hours_alerts], ticket 2471, merged) on the [careers_apply]
// precedent: desktop draws both cards in one 7fr/5fr row, mobile stacks them.
// Alert fields carry their half (`alerts_*`); the card is KrocSmsCard
// (careersapply.jsx) in its "alerts" variant. Either half alone runs full
// width.
//
// Day Label and Time Range stay text, as the ticket has them, and are parsed
// here for today's row and the pill: day names or abbreviations, ranges
// ("Monday–Friday", "Fri–Sat"), lists ("Sat & Sun"), Weekdays / Weekends /
// Daily; times as "5:00 AM – 8:00 PM", "5am-8pm", or "Closed". A row that
// doesn't parse still renders — it just can't be today or drive the pill, and
// with no parseable row for today there is no pill. Dropped from the ticket:
// Status Mode / Status Message (no requester; the design's pill is computed),
// Season Start / End (the label is text), and Closed (Boolean) ("Closed" in
// Time Range says it).
//
// ⚠ "Now" is the visitor's clock: Globals' `timezone` dropdown has no options,
// so the centre's own zone can't be read. Fine for local visitors.
//
// Contrast: the seasonal label is red-300 #C5000E (13px; #EF3E42 fails), the
// pill colours are the design's (open 4.76:1, closed 5.65:1). Desktop and
// mobile are separate designs and both are followed (pill reads "Open now —
// until 8:00 PM" on desktop, "Open now" on mobile).
//
// The parsers, krocHoursStatus, useKrocNow and KrocStatusPill are shared with
// [hours_areas] (hoursareas.jsx, which loads after this file).
//
// Loads after careersapply.jsx (KrocSmsCard) and catalog.jsx (krocExternalUrl).
const KROC_DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// "Monday–Friday" / "Sat & Sun" / "Weekdays" -> [1,2,3,4,5]; [] when unknown.
const krocParseDays = (label) => {
  const s = String(label || "").toLowerCase();
  if (/\b(daily|every ?day)\b/.test(s)) {
    return [0, 1, 2, 3, 4, 5, 6];
  }
  if (/\bweekdays?\b/.test(s)) {
    return [1, 2, 3, 4, 5];
  }
  if (/\bweekends?\b/.test(s)) {
    return [0, 6];
  }
  const tokens =
    s.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*|[–—-]|\bto\b|\bthrough\b|\bthru\b/g) || [];
  const days = [];
  let rangeFrom = null;
  tokens.forEach((t) => {
    const idx = KROC_DAY_NAMES.indexOf(t.slice(0, 3));
    if (idx === -1) {
      rangeFrom = days.length ? days[days.length - 1] : null;
      return;
    }
    if (rangeFrom !== null) {
      for (let d = (rangeFrom + 1) % 7; d !== idx; d = (d + 1) % 7) {
        days.push(d);
      }
      rangeFrom = null;
    }
    days.push(idx);
  });
  return days;
};

// "5:00 AM – 8:00 PM" -> { open: 300, close: 1200 }; "Closed" -> { closed: true }.
const krocParseTimes = (range) => {
  const s = String(range || "");
  if (/closed/i.test(s)) {
    return { closed: true };
  }
  const re = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\b\.?/gi;
  const found = [];
  let m;
  while ((m = re.exec(s)) && found.length < 2) {
    const h = (parseInt(m[1], 10) % 12) + (m[3].toLowerCase() === "p" ? 12 : 0);
    found.push({ minutes: h * 60 + parseInt(m[2] || "0", 10) });
  }
  if (found.length < 2) {
    return null;
  }
  // A close at or before the open runs past midnight ("5 PM – 1 AM").
  const close = found[1].minutes <= found[0].minutes ? found[1].minutes + 1440 : found[1].minutes;
  return { open: found[0].minutes, close };
};

// Prints a parsed close time the way the design does ("8:00 PM").
const krocFormatClock = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const mm = String(minutes % 60).padStart(2, "0");
  return ((h + 11) % 12) + 1 + ":" + mm + " " + (h < 12 ? "AM" : "PM");
};

// A day/time row with both halves parsed.
const krocHoursRow = (day, time) => ({
  day,
  time,
  days: krocParseDays(day),
  times: krocParseTimes(time)
});

// Open or closed right now, from rows built by krocHoursRow: open if one of
// today's parsed rows spans now ({ open: true, close }); closed if today is
// known (a parsed row says Closed or none spans now); null when no row for
// today parses, so the caller shows no pill.
const krocHoursStatus = (rows, now) => {
  const today = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  const known = rows.filter((r) => r.times && r.days.indexOf(today) !== -1);
  if (!known.length) {
    return null;
  }
  const openRow = known.find(
    (r) => !r.times.closed && minute >= r.times.open && minute < r.times.close
  );
  return openRow ? { open: true, close: openRow.times.close } : { open: false };
};

// The current time, re-read each minute so a pill flips at opening/closing.
function useKrocNow() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function KrocStatusPill(props) {
  const closed = props.tone === "closed";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11px] font-medium lg:gap-1.5 lg:px-[11px] lg:py-1 lg:text-[12px]",
        closed ? "bg-[#fbeaea] text-[#b42318]" : "bg-[#e7f4ea] text-[#1e7a34]"
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full lg:h-[7px] lg:w-[7px]",
          closed ? "bg-[#b42318]" : "bg-[#28a745]"
        )}
      ></span>
      {props.short && props.long ? (
        <React.Fragment>
          <span className="lg:hidden">{props.short}</span>
          <span className="hidden lg:inline">{props.long}</span>
        </React.Fragment>
      ) : (
        props.short || props.long
      )}
    </span>
  );
}

function HoursGeneral(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const now = useKrocNow();

  const heading = text(d.heading);
  const seasonal = text(d.seasonalLabel);
  const footnote = text(d.footnote);
  const today = now.getDay();

  const rows = []
    .concat(d.hours || [])
    .flat()
    .filter(Boolean)
    .map((r) => {
      const day = text(r.day_label);
      const time = text(r.time_range);
      return krocHoursRow(day, time);
    })
    .filter((r) => r.day || r.time);
  const todays = rows.filter((r) => r.days.indexOf(today) !== -1);
  const status = krocHoursStatus(rows, now);
  const pill = status && {
    tone: status.open ? "open" : "closed",
    short: status.open ? "Open now" : "Closed now",
    long: status.open ? "Open now — until " + krocFormatClock(status.close) : ""
  };

  const hasHours = Boolean(heading || rows.length);
  const sms = (
    <KrocSmsCard
      variant="alerts"
      eyebrow={d.alertsEyebrow}
      heading={d.alertsHeading}
      keyword={d.alertsKeyword}
      shortcode={d.alertsShortcode}
      ctaLabel={d.alertsCtaLabel}
      ctaLink={d.alertsCtaLink}
    />
  );
  const hasSms = Boolean(text(d.alertsKeyword) || text(d.alertsShortcode));

  if (!hasHours && !hasSms) {
    return null;
  }

  const hours = hasHours && (
    <div className="rounded-card bg-surface p-[22px] lg:px-9 lg:py-8">
      {(heading || pill) && (
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5 lg:gap-3">
          {heading && (
            <h2 className="text-[22px] leading-[1.2] text-content lg:text-heading-sm lg:leading-[1.3]">
              {heading}
            </h2>
          )}
          {pill && <KrocStatusPill tone={pill.tone} short={pill.short} long={pill.long} />}
        </div>
      )}
      {seasonal && (
        <div className="mb-3 text-[11px] tracking-[.14em] text-brand-red-300 uppercase lg:mb-4 lg:text-[13px] lg:tracking-[.08em]">
          {seasonal}
        </div>
      )}
      {rows.length > 0 && (
        <dl className="m-0">
          {rows.map((r, i) => {
            const isToday = todays.indexOf(r) !== -1;
            return (
              <div
                key={r.day + i}
                className={cx(
                  "flex justify-between gap-3 py-2 text-[13.5px] lg:gap-4 lg:py-[9px] lg:text-[14.5px]",
                  i > 0 && "border-t border-brand-area",
                  isToday ? "font-medium text-content" : "text-content-muted"
                )}
              >
                <dt>{r.day}</dt>
                <dd className="m-0 whitespace-nowrap">{r.time}</dd>
              </div>
            );
          })}
        </dl>
      )}
      {footnote && (
        <p className="mt-3.5 text-[11.5px] leading-[1.6] whitespace-pre-line text-content-muted lg:mt-4 lg:text-[13px]">
          {footnote}
        </p>
      )}
    </div>
  );

  if (hasHours && hasSms) {
    return (
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[7fr_5fr] lg:items-stretch lg:gap-4">
        {hours}
        {sms}
      </div>
    );
  }

  return hours || sms;
}
