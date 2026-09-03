/* mosaic span pattern (prototype): 2x2 · 1x1 · 1x1 · 1x2 · 2x1 · 1x1 · 1x1 */
const MOSAIC_SPANS = ["col-span-2 row-span-2", "", "", "row-span-2", "col-span-2", "", ""];

function GalleryTile(props) {
  return (
    <div
      className={cx("cursor-pointer overflow-hidden rounded-[14px] bg-surface-muted", props.span)}
      onClick={props.onClick}
    >
      <img
        src={props.image.src}
        alt={props.image.alt || ""}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function GalleryLightbox(props) {
  const images = props.images;
  const img = images[props.index];

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        props.onClose();
      }
      if (e.key === "ArrowLeft") {
        props.onMove(-1);
      }
      if (e.key === "ArrowRight") {
        props.onMove(1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const stop = (e) => e.stopPropagation();
  const caption = [img.alt, props.index + 1 + " of " + images.length].filter(Boolean).join(" · ");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(14,14,16,0.85)]"
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={props.onClose}
        className="absolute right-5 top-[18px] flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,0.15)] text-white"
      >
        <Icon className="h-4 w-4" id="#i-close" />
      </button>
      <button
        type="button"
        aria-label="Previous image"
        onClick={(e) => {
          stop(e);
          props.onMove(-1);
        }}
        className="absolute left-5 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,0.15)] text-white"
      >
        <Icon className="h-4 w-4 rotate-90" id="#i-chev" />
      </button>
      <button
        type="button"
        aria-label="Next image"
        onClick={(e) => {
          stop(e);
          props.onMove(1);
        }}
        className="absolute right-5 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,0.15)] text-white"
      >
        <Icon className="h-4 w-4 -rotate-90" id="#i-chev" />
      </button>
      <div className="max-w-[75%]" onClick={stop}>
        <img src={img.src} alt={img.alt || ""} className="max-h-[75vh] w-auto rounded-[14px]" />
        <div className="mt-3 text-center text-[13.5px] text-white opacity-85">{caption}</div>
      </div>
    </div>
  );
}

function GalleryCarousel(props) {
  const trackRef = React.useRef(null);

  const nudge = (dir) => {
    const el = trackRef.current;
    if (el) {
      el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
    }
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto rounded-[14px] scrollbar-none"
      >
        {props.images.map((img, i) => (
          <img
            key={i}
            src={img.src}
            alt={img.alt || ""}
            className="h-[260px] w-auto flex-none cursor-pointer snap-start rounded-[14px] bg-surface-muted object-cover lg:h-[340px]"
            onClick={() => props.onSelect(i)}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="Previous images"
        onClick={() => nudge(-1)}
        className="absolute left-3 top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface text-content shadow-card"
      >
        <Icon className="h-4 w-4 rotate-90" id="#i-chev" />
      </button>
      <button
        type="button"
        aria-label="Next images"
        onClick={() => nudge(1)}
        className="absolute right-3 top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-surface text-content shadow-card"
      >
        <Icon className="h-4 w-4 -rotate-90" id="#i-chev" />
      </button>
    </div>
  );
}

function ImageGallery(props) {
  const d = props.data || {};
  const images = []
    .concat(d.images || [])
    .flat()
    .filter((row) => row && row.src);
  if (!images.length) {
    return null;
  }

  const layout = (d.layout || "mosaic").toLowerCase();

  const [lightbox, setLightbox] = React.useState(-1);
  const move = (dir) => setLightbox((cur) => (cur + dir + images.length) % images.length);

  let body;
  if (layout === "carousel") {
    body = <GalleryCarousel images={images} onSelect={setLightbox} />;
  } else if (layout === "grid") {
    body = (
      <div className="grid auto-rows-[160px] grid-cols-2 gap-2.5 lg:grid-cols-4">
        {images.map((img, i) => (
          <GalleryTile key={i} image={img} onClick={() => setLightbox(i)} />
        ))}
      </div>
    );
  } else {
    /* mosaic — the fixed pattern supports MOSAIC_SPANS.length images */
    body = (
      <div className="grid auto-rows-[160px] grid-flow-dense grid-cols-2 gap-2.5 lg:grid-cols-4">
        {images.slice(0, MOSAIC_SPANS.length).map((img, i) => (
          <GalleryTile key={i} image={img} span={MOSAIC_SPANS[i]} onClick={() => setLightbox(i)} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {d.title && <h3 className="mb-4 text-heading-md text-content">{d.title}</h3>}
      {body}
      {lightbox >= 0 && (
        <GalleryLightbox
          images={images}
          index={lightbox}
          onClose={() => setLightbox(-1)}
          onMove={move}
        />
      )}
    </div>
  );
}
