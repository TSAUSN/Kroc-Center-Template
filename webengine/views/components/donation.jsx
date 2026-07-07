function DonationBlock(props) {
  const d = props.data || {};
  if (!d.title) {
    return null;
  }

  const variant = (d.variant || "red").toLowerCase();
  const bg =
    variant === "navy" ? "bg-secondary" : variant === "dark" ? "bg-[#1c1b1f]" : "bg-primary";

  return (
    <div
      className={cx(
        "grid grid-cols-1 items-center gap-6 overflow-hidden rounded-card p-8 text-content-ondark lg:grid-cols-[3fr_2fr] lg:gap-8 lg:p-12",
        bg
      )}
    >
      <div>
        <h2 className="mb-2.5 text-[32px] leading-[1.15] tracking-[-0.01em] lg:text-[48px]">
          {d.title}
        </h2>
        {d.body && <p className="max-w-[540px] text-body-lg opacity-90">{d.body}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <a href={d.primaryUrl || "#"} className="btn btn-light">
          {d.primaryCta || "Donate Now"}
        </a>
        {d.secondaryCta && (
          <a href={d.secondaryUrl || "#"} className="btn btn-outline-light">
            {d.secondaryCta}
          </a>
        )}
      </div>
    </div>
  );
}
