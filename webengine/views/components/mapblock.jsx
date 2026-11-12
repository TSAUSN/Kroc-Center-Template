// MapBlock — block: map_block (v5 / prototype MapBlock, variant "single"). One
// location in a white card: heading, body, address, Get Directions and an
// optional second button, beside a map. First variant: "About Visit Us" (6.17).
//
// The design draws a stylised map; this embeds a real Google map of the
// address (the keyless maps.google.com embed, lazy-loaded), and Get Directions
// opens Google Maps directions to it, so there is no link to author. Address is
// the block's own field or, when empty, Globals' `address`, so one centre's
// address is typed once. With no address at all there is no map and no
// directions button.
//
// The second button is the design's "View Hours" (D-18, 💬1835758087), as
// optional label + link. The prototype's "locator" variant (the apex site's
// multi-centre finder) is not built: nothing on an instance page uses it.
//
// Desktop and mobile are separate designs and both are followed: copy left and
// map right (1fr 1fr) on desktop; map between the body and the address, with
// full-width buttons, on mobile.
function MapBlock(props) {
  const d = props.data || {};
  const text = (v) => String(v == null ? "" : v).trim();

  const heading = text(d.heading);
  const body = text(d.body);
  const address = text(d.address) || text(d.globalAddress);
  const directions = text(d.directionsLabel) || "Get Directions";
  const second = { label: text(d.secondaryLabel), link: krocExternalUrl(text(d.secondaryLink)) };

  if (!heading && !address) {
    return null;
  }

  const q = encodeURIComponent(address);
  const map = address && (
    <div className="relative aspect-[5/3] overflow-hidden rounded-[14px] bg-surface-muted lg:rounded-2xl">
      <iframe
        title={"Map of " + address}
        src={"https://maps.google.com/maps?q=" + q + "&output=embed"}
        className="absolute inset-0 block h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      ></iframe>
    </div>
  );

  const buttons = address && (
    <div className="grid gap-2 lg:flex lg:flex-wrap lg:gap-2.5">
      <a
        href={"https://www.google.com/maps/dir/?api=1&destination=" + q}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-secondary"
      >
        {directions}
      </a>
      {second.label && (
        <a
          href={second.link || undefined}
          className="btn border border-secondary bg-transparent text-secondary hover:bg-secondary hover:text-white"
        >
          {second.label}
        </a>
      )}
    </div>
  );

  // One map, placed by the grid: between the copy and the address on mobile,
  // in the right column (spanning both text rows) on desktop.
  return (
    <div className="grid grid-cols-1 rounded-card bg-surface p-[22px] lg:grid-cols-2 lg:grid-rows-[1fr_1fr] lg:gap-x-8 lg:p-8">
      <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
        {heading && (
          <h2 className="mb-2.5 text-[22px] leading-[1.2] text-content lg:mb-3 lg:text-heading-md lg:leading-[1.25]">
            {heading}
          </h2>
        )}
        {body && (
          <p className="mb-4 text-[13px] leading-normal whitespace-pre-line text-content lg:mb-5 lg:text-[14.5px]">
            {body}
          </p>
        )}
      </div>
      {map && (
        <div className="mb-3.5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mb-0 lg:self-center">
          {map}
        </div>
      )}
      <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
        {address && (
          <div className="mb-3 text-[15px] leading-normal text-content lg:mb-3.5 lg:text-[14.5px]">
            {address}
          </div>
        )}
        {buttons}
      </div>
    </div>
  );
}
