function IntroBand(props) {
  const d = props.data || {};
  const layout = String(d.layout_variant || "").toLowerCase();
  const hasPhoto = layout.indexOf("no") !== 0 && !!d.image;

  const ctas = (light) => (
    <div className="flex flex-wrap gap-3">
      {d.primary_cta_label && (
        <a
          href={d.primary_cta_url || "#"}
          className={cx("btn", light ? "btn-light" : "btn-primary")}
        >
          {d.primary_cta_label}
        </a>
      )}
      {d.secondary_cta_label && (
        <a
          href={d.secondary_cta_url || "#"}
          className={cx("btn", light ? "btn-outline-light" : "btn-outline-primary")}
        >
          {d.secondary_cta_label}
        </a>
      )}
    </div>
  );

  if (hasPhoto) {
    return (
      <div className="grid grid-cols-1 overflow-hidden rounded-card bg-surface lg:grid-cols-[7fr_5fr]">
        <div className="flex flex-col justify-center px-6 py-8 lg:px-12 lg:py-11">
          {d.eyebrow && (
            <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-primary">
              {d.eyebrow}
            </div>
          )}
          <h3 className="mb-3.5 text-heading-md text-content">{d.title}</h3>
          {d.body && (
            <p className="mb-[22px] whitespace-pre-line text-[15px] leading-relaxed text-content">
              {d.body}
            </p>
          )}
          {ctas(false)}
        </div>
        <div className="relative min-h-[320px]">
          <img
            src={d.image}
            alt={d.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
    );
  }

  const bg =
    String(d.background_color || "").toLowerCase() === "navy" ? "bg-secondary" : "bg-primary";
  return (
    <div className={cx("rounded-card px-7 py-9 text-content-ondark lg:px-14 lg:py-12", bg)}>
      <div className="max-w-[720px]">
        {d.eyebrow && (
          <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-[rgba(255,255,255,0.72)]">
            {d.eyebrow}
          </div>
        )}
        <h3 className="mb-3.5 text-heading-md">{d.title}</h3>
        {d.body && (
          <p className="mb-6 whitespace-pre-line text-body-lg leading-relaxed text-[rgba(255,255,255,0.85)]">
            {d.body}
          </p>
        )}
        {ctas(true)}
      </div>
    </div>
  );
}
