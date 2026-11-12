// CareersJobs — block: careers_jobs (blocks catalog §3.6, ticket 2459). The
// job listings on 6.20 Careers: one white card per department (Kroc Center,
// Family Services & Shelter, Family Store), each with a location line and its
// open roles as links to the postings. Sits under the "Careers Open Positions"
// [intro_band] variant.
//
// The ticket's shape (Departments {…, Roles repeater {Title, Link}}) nests a
// repeater, which Zesty disallows. The department stays the row because the
// icon and location belong to it; Roles is Multi Line Text, one role per line
// as "Title | link". The link half goes through krocExternalUrl (a missing
// https:// is added); a line without a link renders as plain text.
//
// Icon: Erin asked for optional icons on these cards ("one card being Aquatic
// positions, one card Fitness positions", B5, 💬1871731526) and placed them
// "centered above the title" (T16). No design draws it, so it is taken
// literally: a 44px (48 desktop) Media icon centred above the name, the rest of
// the card left-aligned as designed. Media sub-fields are bare ZUIDs, resolved
// by useKrocMediaUrls (cardgrid.jsx); the slot keeps its size while loading.
//
// Role links render red-300 #C5000E, not the design's --kroc-red #EF3E42 —
// that red on white is 3.86:1 and fails AA at 15px; red-300 is 6.21:1.
// Columns follow the department count like [card_grid] (1 -> full, 2 or 4 ->
// 2-up, else 3-up); mobile stacks. Desktop and mobile are separate designs and
// both are followed (20 vs 28 padding, 19 vs 21px name, 11.5 vs 13px location).
//
// Loads after catalog.jsx (krocExternalUrl), shared.jsx (Icon) and
// cardgrid.jsx (krocMediaZuid, krocMediaDirectUrl, useKrocMediaUrls).
const krocParseRoles = (v) =>
  String(v == null ? "" : v)
    .split(/\r?\n/)
    .map((line) => {
      const bar = line.lastIndexOf("|");
      const title = (bar === -1 ? line : line.slice(0, bar)).trim();
      const url = bar === -1 ? "" : krocExternalUrl(line.slice(bar + 1).trim());
      return { title, url };
    })
    .filter((r) => r.title);

function CareersJobs(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const departments = []
    .concat(d.departments || [])
    .flat()
    .filter(Boolean)
    .map((r) => ({
      name: text(r.department),
      location: text(r.location),
      icon: r.icon,
      roles: krocParseRoles(r.roles)
    }))
    .filter((r) => r.name || r.roles.length > 0);

  const urls = useKrocMediaUrls(departments.map((r) => krocMediaZuid(r.icon)));
  const iconUrl = (v) => krocMediaDirectUrl(v) || urls[krocMediaZuid(v)] || "";

  if (departments.length === 0) {
    return null;
  }

  const n = departments.length;
  const cols = n === 1 ? "" : n % 2 === 0 && n % 3 !== 0 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  return (
    <div className={cx("grid grid-cols-1 gap-3.5 lg:gap-4", cols)}>
      {departments.map((r, i) => {
        const icon = r.icon ? iconUrl(r.icon) : "";
        return (
          <div key={r.name + i} className="rounded-card bg-surface p-5 lg:p-7">
            {r.icon && (
              <div className="mx-auto mb-3.5 h-11 w-11 lg:mb-4 lg:h-12 lg:w-12">
                {icon && <img src={icon} alt="" className="h-full w-full object-contain" />}
              </div>
            )}
            {r.name && (
              <h3 className="mb-0.5 text-[19px] leading-[1.25] text-content lg:text-[21px] lg:font-medium">
                {r.name}
              </h3>
            )}
            {r.location && (
              <div className="text-[11.5px] leading-[1.45] text-content-muted lg:text-[13px]">
                {r.location}
              </div>
            )}
            {r.roles.length > 0 && (
              <ul
                className={cx(
                  "flex list-none flex-col gap-[9px] p-0 lg:gap-2.5",
                  (r.name || r.location) && "mt-3 lg:mt-4"
                )}
              >
                {r.roles.map((role, j) => {
                  const body = (
                    <React.Fragment>
                      <Icon className="h-3.5 w-3.5 flex-none" id="#i-arrowur" />
                      <span>{role.title}</span>
                    </React.Fragment>
                  );
                  const line =
                    "inline-flex items-center gap-2 text-[14.5px] leading-snug lg:text-[15px]";
                  return (
                    <li key={role.title + j}>
                      {role.url ? (
                        <a
                          href={role.url}
                          className={cx(line, "text-brand-red-300 hover:underline")}
                        >
                          {body}
                        </a>
                      ) : (
                        <span className={cx(line, "text-content")}>{body}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
