function FeaturedStories(props) {
  const d = props.data || {};

  // toJson() resolves media/relationship fields to { type, totalItems, data: [...] }
  const order = String(d.zuids || "")
    .split(",")
    .map((z) => z.trim());
  const cards = []
    .concat(d.stories || [])
    .flat()
    .filter(Boolean)
    .map(krocStoryToCard)
    .sort((a, b) => order.indexOf(a.zuid) - order.indexOf(b.zuid));

  if (!cards.length) {
    return null;
  }

  const title = d.title || "Kroc Highlights";

  // "grid" forces a wrapping multi-row grid; otherwise use the smart rail that
  // only scrolls (and shows controls) when the cards overflow one row.
  const grid =
    String(d.displayMode || "")
      .toLowerCase()
      .indexOf("grid") !== -1;

  if (grid) {
    return (
      <div>
        <div className="mb-[18px] flex items-baseline justify-between">
          <h3 className="text-heading-md text-content">{title}</h3>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <StoryCard key={c.zuid || c.title} card={c} />
          ))}
        </div>
      </div>
    );
  }

  return <StoryCarousel title={title} cards={cards} />;
}
