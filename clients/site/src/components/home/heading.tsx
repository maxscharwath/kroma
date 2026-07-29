/** A heading whose amber span is marked inline in the catalog with brackets:
 *  `Six conteneurs. [Un seul serveur.]`. Each language brackets its own words, so
 *  a translator writes one whole sentence and no component has to reassemble a
 *  heading from three fragments. Returns the inline content only; the call site
 *  owns the h1/h2 and its type scale. */
export function AccentHeading({ text }: { text: string }) {
  const [pre = '', accent = '', post = ''] = text.split(/[[\]]/);
  if (!accent) return <>{pre}</>;
  return (
    <>
      {pre}
      <span className="text-gradient-amber">{accent}</span>
      {post}
    </>
  );
}

/** The eyebrow + display heading pair the asymmetric home bands share, where the
 *  header sits in one column of a grid rather than centred (the centred variant
 *  is <Section>'s own header). */
export function BandHeading({ eyebrow, heading }: { eyebrow: string; heading: string }) {
  return (
    <>
      <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
        {eyebrow}
      </p>
      <h2 className="text-balance font-display text-3xl font-extrabold leading-[1.05] text-text sm:text-4xl">
        <AccentHeading text={heading} />
      </h2>
    </>
  );
}
