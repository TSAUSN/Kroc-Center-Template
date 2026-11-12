// AnchorLinks — block: anchor_links. A row of pill jump links to sections on
// the same page. First variant: "Hours Section Anchors" on 6.22 Hours of
// Operation (ticket 2469, filed in the catalog as [hours_anchors]): Today's
// Hours / Hours by Area / Closures & Reduced Hours / Activity Schedules /
// Rules & Age Guidelines.
//
// General, not Hours-only, because it also answers morgan's standing ask for
// in-page anchors on any page (💬1857823403). Scroll-only: it owns no content
// and has no state, which is what separates it from [rentals_tabs]. No Style
// field — pills are the only style drawn.
//
// Target Section is the HEADING of the section to jump to, as it reads on the
// page (or "#id"); empty means the label. Blocks carry no anchor ids an editor
// could type, so the link finds its section by heading text: an exact match
// (case and spacing ignored) first, then the first heading that contains the
// target ("Closures & Reduced Hours" finds "2026 Facility Closures & Reduced
// Hours"). The matched heading gets an id from the target, so "#hours-by-area"
// in the address bar works for sharing and on load. A target nothing matches
// is a plain link to that hash.
//
// Mobile: the mobile Hours design has no anchor row; it is kept
// on mobile, wrapping, since a long phone page needs jump links most.
// Headings scroll clear of the sticky mobile header (scroll-margin).
const krocSlug = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const krocHeadingKey = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// The element a target points at: "#id", else a heading on the page by text.
function krocFindSection(target) {
  if (target.charAt(0) === "#") {
    return document.getElementById(target.slice(1));
  }
  const key = krocHeadingKey(target);
  if (!key) {
    return null;
  }
  const heads = Array.prototype.slice.call(
    document.querySelectorAll("main h1, main h2, main h3, main h4")
  );
  return (
    heads.find((h) => krocHeadingKey(h.textContent) === key) ||
    heads.find((h) => krocHeadingKey(h.textContent).indexOf(key) !== -1) ||
    null
  );
}

function AnchorLinks(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const items = []
    .concat(d.items || [])
    .flat()
    .filter(Boolean)
    .map((r) => {
      const label = text(r.label);
      const target = text(r.target) || label;
      const hash = target.charAt(0) === "#" ? target.slice(1) : krocSlug(target);
      return { label, target, hash };
    })
    .filter((r) => r.label && r.hash);

  // Tag each matched heading with its hash id, so shared "#…" links resolve.
  // Blocks mount one by one after the page loads, so retry for a few seconds,
  // then honour a hash in the address bar once its heading exists.
  const key = items.map((r) => r.target).join("|");
  React.useEffect(() => {
    let tries = 0;
    let jumped = false;
    const tag = () => {
      items.forEach((r) => {
        const el = krocFindSection(r.target);
        if (el && !el.id) {
          el.id = r.hash;
        }
        if (el) {
          el.style.scrollMarginTop = window.innerWidth < 1024 ? "96px" : "24px";
        }
      });
      const want = decodeURIComponent(location.hash.slice(1));
      if (!jumped && want && items.some((r) => r.hash === want)) {
        const el = document.getElementById(want);
        if (el) {
          jumped = true;
          el.scrollIntoView({ block: "start" });
        }
      }
    };
    tag();
    const id = setInterval(() => {
      tries += 1;
      tag();
      if (tries >= 10) {
        clearInterval(id);
      }
    }, 400);
    return () => clearInterval(id);
  }, [key]);

  if (items.length === 0) {
    return null;
  }

  const go = (r) => (e) => {
    const el = krocFindSection(r.target);
    if (!el) {
      return;
    }
    e.preventDefault();
    if (!el.id) {
      el.id = r.hash;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", "#" + el.id);
  };

  return (
    <nav aria-label="On this page">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {items.map((r, i) => (
          <li key={r.hash + i}>
            <a
              href={"#" + r.hash}
              onClick={go(r)}
              className="inline-block rounded-full border border-[#e6e6ea] bg-surface px-3.5 py-[7px] text-[13px] whitespace-nowrap text-brand-link hover:border-brand-link"
            >
              {r.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
