// relationship items link via their routed page when toJson() exposes it
const krocWebPath = (it) => {
  const web = it && it.meta && it.meta.web;
  return (web && (web.path || web.uri || web.url)) || "";
};

function StoryMetaField(props) {
  if (!props.children) {
    return null;
  }
  return (
    <React.Fragment>
      <div className="text-[13px] text-content-muted">{props.label}</div>
      <div className="mb-[18px] text-[15px] text-content">{props.children}</div>
    </React.Fragment>
  );
}

function StorySidebarDivider() {
  return <div className="my-[18px] h-px bg-[#eaeaee]"></div>;
}

function StorySidebar(props) {
  const it = props.item;
  const event = krocFirstOf(it.related_event);
  const category = krocFirstOf(it.related_program_category);

  const onShare = () => {
    if (navigator.share) {
      navigator.share({ title: it.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <aside>
      <StoryMetaField label="Published">{krocFormatDate(it.story_date)}</StoryMetaField>
      <StoryMetaField label="Author">{it.author}</StoryMetaField>
      {it.author_location && (
        <React.Fragment>
          <div className="mb-1 text-[13px] text-content-muted">Location</div>
          <span className="inline-flex items-center gap-1.5 text-[14.5px] text-primary">
            <Icon className="h-3.5 w-3.5 flex-none" id="#i-pin" />
            {it.author_location}
          </span>
        </React.Fragment>
      )}

      {it.donation_link && (
        <React.Fragment>
          <StorySidebarDivider />
          <a href={it.donation_link} className="btn btn-primary btn-block btn-sm">
            Donate to Support This Program
          </a>
        </React.Fragment>
      )}

      {event && (
        <React.Fragment>
          <StorySidebarDivider />
          <div className="mb-2 text-[13px] text-content-muted">Related Event</div>
          <a
            href={krocWebPath(event) || "#"}
            className="block rounded-xl bg-surface-muted px-3.5 py-3"
          >
            <div className="text-[13px] text-content">{event.title}</div>
            {event.event_date && (
              <div className="text-[12px] text-content-muted">
                {krocFormatDate(event.event_date)}
              </div>
            )}
          </a>
        </React.Fragment>
      )}

      {category && (
        <div className="mt-4">
          <div className="mb-2 text-[13px] text-content-muted">Related Program</div>
          <a href={krocWebPath(category) || category.deep_link_url || "#"}>
            {category.category_name}
          </a>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={onShare} className="btn btn-info btn-sm cursor-pointer">
          Share
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn btn-secondary btn-sm cursor-pointer"
        >
          Print
        </button>
      </div>
    </aside>
  );
}

function StoryDetail(props) {
  const d = props.data || {};
  const it = d.item || {};

  const hero = krocFirstOf(it.story_image_desktop) || krocFirstOf(it.story_image_mobile);
  const bodyHtml = { __html: it.story_body || "" };
  const parentUrl = (d.url || "/stories/").replace(/[^/]+\/?$/, "") || "/";

  let tags = [];
  try {
    tags = []
      .concat(JSON.parse(it.hashtag || "[]"))
      .map((t) => t && t.hashtag)
      .filter(Boolean);
  } catch (err) {
    tags = [];
  }

  const pageUrl = encodeURIComponent(window.location.href);
  const shareLinks = [
    {
      icon: "#i-fb",
      label: "Share on Facebook",
      href: "https://www.facebook.com/sharer/sharer.php?u=" + pageUrl
    },
    { icon: "#i-x", label: "Share on X", href: "https://twitter.com/intent/tweet?url=" + pageUrl },
    {
      icon: "#i-li",
      label: "Share on LinkedIn",
      href: "https://www.linkedin.com/sharing/share-offsite/?url=" + pageUrl
    }
  ];

  const recent = []
    .concat(d.recent || [])
    .flat()
    .filter(Boolean)
    .map(krocStoryToCard);

  return (
    <div>
      {/* crumb + share row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <a href={parentUrl} className="inline-flex items-center gap-1.5 text-[13px] text-content">
          <Icon className="h-3.5 w-3.5 flex-none rotate-90" id="#i-chev" />
          Return to all stories
        </a>
        <div className="flex items-center gap-3.5 text-[13px] text-content-muted">
          <span>Share Story</span>
          {shareLinks.map((s) => (
            <a
              key={s.icon}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              className="inline-flex items-center hover:text-primary"
            >
              <Icon className="h-4 w-4" id={s.icon} />
            </a>
          ))}
        </div>
      </div>

      {/* title + 16:9 hero */}
      <h1 className="mb-4 text-[34px] leading-[1.2] tracking-[-0.01em] text-content lg:text-heading-lg">
        {it.title}
      </h1>
      {hero && hero.url ? (
        <img
          src={hero.url + "?width=1400"}
          alt={it.title}
          className="aspect-video w-full rounded-card bg-surface-muted object-cover"
        />
      ) : (
        <div className="aspect-video w-full rounded-card bg-surface-muted"></div>
      )}

      {/* article card: sidebar + body */}
      <div className="mt-6 grid grid-cols-1 gap-8 rounded-card bg-surface p-6 lg:grid-cols-[260px_1fr] lg:gap-12 lg:px-12 lg:py-10">
        <StorySidebar item={it} />
        <div>
          <div className="kroc-prose" dangerouslySetInnerHTML={bodyHtml}></div>

          {it.external_article && (
            <div className="mb-5 mt-6 flex items-center gap-2.5 rounded-xl bg-surface-muted px-4 py-3.5">
              <Icon className="h-4 w-4 flex-none text-content-muted" id="#i-arrowur" />
              <div>
                <div className="mb-0.5 text-[13px] text-content-muted">
                  This story was originally published externally.
                </div>
                <a href={it.external_article} target="_blank" rel="noopener noreferrer">
                  View Original Article →
                </a>
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-[11px] py-[5px] text-[12px] text-content"
                >
                  <span className="h-2 w-2 flex-none rounded-[2px] bg-primary"></span>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* recent stories */}
      {recent.length > 0 && (
        <div className="mt-12">
          <StoryCarousel
            title="Recent Stories"
            cards={recent}
            action={
              <a
                href={parentUrl}
                className="inline-flex items-center gap-1.5 text-[13px] text-content"
              >
                View All <Icon className="h-3.5 w-3.5" id="#i-arrowur" />
              </a>
            }
          />
        </div>
      )}
    </div>
  );
}
