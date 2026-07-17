// Numbered pagination (prototype style): white pill, red active page, windowed
// numbers with ellipses, prev/next chevrons. Pages are 1-based; renders nothing
// when everything fits on one page.
function Pagination(props) {
  const page = props.page || 1;
  const pageCount = props.pageCount || 1;

  if (pageCount <= 1) {
    return null;
  }

  const go = (p) => {
    const next = Math.min(Math.max(p, 1), pageCount);
    if (next !== page && props.onPage) {
      props.onPage(next);
    }
  };

  let nums = [];
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) {
      nums.push(i);
    }
  } else if (page <= 4) {
    nums = [1, 2, 3, 4, 5, "gap", pageCount];
  } else if (page >= pageCount - 3) {
    nums = [1, "gap", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  } else {
    nums = [1, "gap", page - 1, page, page + 1, "gap", pageCount];
  }

  return (
    <nav
      aria-label="Pagination"
      className="inline-flex items-center gap-1 rounded-full bg-white p-1.5"
    >
      {page > 1 && (
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => go(page - 1)}
          className="inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-content hover:bg-surface"
        >
          <Icon className="h-4 w-4 rotate-90" id="#i-chev" />
        </button>
      )}
      {nums.map((n, i) =>
        n === "gap" ? (
          <span key={"gap" + i} className="px-2 text-[14px] text-content-muted">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-current={n === page ? "page" : undefined}
            onClick={() => go(n)}
            className={cx(
              "inline-flex h-9 w-9 flex-none items-center justify-center rounded-full text-[14px]",
              n === page
                ? "bg-primary text-content-ondark"
                : "cursor-pointer text-content hover:bg-surface"
            )}
          >
            {n}
          </button>
        )
      )}
      {page < pageCount && (
        <button
          type="button"
          aria-label="Next page"
          onClick={() => go(page + 1)}
          className="inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full bg-primary text-content-ondark"
        >
          <Icon className="h-4 w-4 -rotate-90" id="#i-chev" />
        </button>
      )}
    </nav>
  );
}
