const facilityRows = (v) => {
  if (typeof v === "string") {
    try {
      return [].concat(JSON.parse(v));
    } catch (err) {
      return [];
    }
  }
  return [].concat(v || []).flat();
};

function FacilityPhotos(props) {
  const photos = props.photos;
  const [idx, setIdx] = React.useState(0);
  const go = (d) => setIdx((i) => (i + d + photos.length) % photos.length);

  const arrowCls =
    "absolute top-1/2 z-10 flex h-[34px] w-[34px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,0.92)] text-content shadow-[0_2px_8px_rgba(0,0,0,0.18)]";

  return (
    <div className="relative min-h-[300px] overflow-hidden bg-surface-muted">
      {photos.length > 0 && (
        <img
          src={photos[idx].src}
          alt={photos[idx].alt || ""}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {photos.length > 1 && (
        <React.Fragment>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className={cx(arrowCls, "left-3")}
          >
            <Icon className="h-[18px] w-[18px] rotate-90" id="#i-chev" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            className={cx(arrowCls, "right-3")}
          >
            <Icon className="h-[18px] w-[18px] -rotate-90" id="#i-chev" />
          </button>
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <span
                key={i}
                className={cx(
                  "h-[7px] w-[7px] rounded-full",
                  i === idx ? "bg-white" : "bg-[rgba(255,255,255,0.55)]"
                )}
              ></span>
            ))}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function FacilitySection(props) {
  const d = props.data || {};

  const photos = facilityRows(d.photos).filter((p) => p && p.src);
  const pills = facilityRows(d.feature_pills)
    .map((r) => r && r.feature)
    .filter(Boolean);
  const hours = facilityRows(d.hours_of_operation).filter((r) => r && r.day);

  const side =
    String(d.layout_variant || "")
      .toLowerCase()
      .indexOf("right") !== -1
      ? "right"
      : "left";
  const mode = String(d.status_mode || "").toLowerCase();
  const closed = mode.indexOf("closed") === 0;
  const statusLabel =
    mode === "open"
      ? "Open"
      : mode === "closed_seasonal"
        ? "Closed — Seasonal"
        : mode === "closed_maintenance"
          ? "Closed — Maintenance"
          : null;

  const descriptionHtml = { __html: d.description || "" };

  const photoEl = <FacilityPhotos photos={photos} />;

  const badge = statusLabel && (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-[12px] font-medium",
        closed ? "bg-[#fbeaea] text-[#b42318]" : "bg-[#e7f4ea] text-[#1e7a34]"
      )}
    >
      <span
        className={cx("h-[7px] w-[7px] rounded-full", closed ? "bg-[#b42318]" : "bg-[#28a745]")}
      ></span>
      {statusLabel}
    </span>
  );

  return (
    <div
      className={cx(
        "grid grid-cols-1 overflow-hidden rounded-card bg-surface",
        side === "right" ? "lg:grid-cols-[7fr_5fr]" : "lg:grid-cols-[5fr_7fr]"
      )}
    >
      {side === "left" && photoEl}
      <div className="px-6 py-6 lg:px-10 lg:py-9">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-heading-md text-content">{d.facility_section_name}</h3>
          {badge}
        </div>
        {d.description && (
          <div
            className="mb-4 text-[15px] leading-relaxed text-content [&_p]:mb-2"
            dangerouslySetInnerHTML={descriptionHtml}
          ></div>
        )}
        {pills.length > 0 && (
          <div className="mb-[18px] flex flex-wrap gap-1.5">
            {pills.map((p) => (
              <span
                key={p}
                className="rounded-full bg-surface-muted px-3 py-1 text-[12.5px] text-content"
              >
                {p}
              </span>
            ))}
          </div>
        )}
        {closed && d.status_message ? (
          <div className="mb-5">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#888]">
              Status
            </div>
            <div className="rounded-xl border border-[#f3cccc] bg-[#fbeaea] px-4 py-3 text-[13.5px] leading-normal text-[#8a1f1f]">
              {d.status_message}
            </div>
          </div>
        ) : hours.length > 0 ? (
          <div className="mb-5">
            <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#888]">
              Hours of Operation
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {hours.map((row) => (
                  <tr key={row.day} className="border-b border-[#f0f0f0] align-top">
                    <td className="py-[7px] text-[13px] font-medium text-content">{row.day}</td>
                    <td className="py-[7px] text-right text-[13px] text-content-muted">
                      {String(row.time || "")
                        .split("\n")
                        .map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {d.cta_label && (
          <a href={d.cta_url || "#"} className="btn btn-secondary btn-sm">
            {d.cta_label}
          </a>
        )}
      </div>
      {side === "right" && photoEl}
    </div>
  );
}
