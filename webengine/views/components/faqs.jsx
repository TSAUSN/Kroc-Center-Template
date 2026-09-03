function FaqList(props) {
  const items = props.items || [];
  const [open, setOpen] = React.useState(0);

  return (
    <div>
      {props.title && <h3 className="mb-4 text-heading-md text-content">{props.title}</h3>}
      <div className="overflow-hidden rounded-card bg-surface">
        {items.map((item, i) => (
          <div key={i} className={cx(i > 0 && "border-t border-[#eaeaee]")}>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? -1 : i)}
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-7 py-[22px] text-left text-body-lg text-content"
            >
              <span>{item.question}</span>
              <span
                className={cx(
                  "inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-surface-muted text-body-md transition-transform duration-200",
                  open === i && "rotate-45"
                )}
              >
                +
              </span>
            </button>
            {open === i && (
              <div
                className="max-w-[680px] px-7 pb-6 text-[14.5px] leading-[1.65] text-content"
                dangerouslySetInnerHTML={item.answerHtml}
              ></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
