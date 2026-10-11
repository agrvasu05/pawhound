export const metadata = {
  title: "About Value Finds Daily",
  description:
    "Who we are, how we make our cozy-home guides and printables, and the editorial standards behind every list on Value Finds Daily.",
  alternates: { canonical: "/about" },
};

export default function About() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10 prose prose-stone">
      <h1>About Value Finds Daily</h1>

      <p>
        Value Finds Daily is about one thing: making a home feel calm, cozy,
        and organized without spending a fortune. We publish practical,
        honest guides — decor ideas, small-space wins, organization systems —
        and we design the printable wall art and planners in our{" "}
        <a href="/shop">shop</a> to go with them. Most of what&apos;s online
        on these topics is shallow, contradictory, or written mainly to sell
        you something. We try to be the opposite — specific, useful, and
        upfront about how we reach our conclusions.
      </p>

      <h2>Who writes the guides</h2>
      <p>
        The guides are written under the pen name{" "}
        <a href="/author/elena-marsh">Elena Marsh</a>. One byline, one set of
        standards: every page says who a pick suits, who should skip it, and
        what the trade-off is.
      </p>

      <h2>How the lists are made</h2>
      <p>
        Dog breed rankings start from a structured dataset of 150 breeds — size,
        energy, shedding, barking, trainability, lifespan, and how each breed
        tends to do with children, cats and other dogs — and are then ordered for
        the situation a guide is about (an apartment, a first-time owner, a
        family with allergies). The comparison table on each guide shows the
        data the ranking used.
      </p>
      <p>
        Home and cozy-living guides name specific, widely sold products and say
        what each one is good and bad at. We don&apos;t claim to have tested
        products we haven&apos;t, and we date every guide so you can see how
        current it is. Our printables are designed in-house.
      </p>

      <h2>Editorial independence</h2>
      <p>
        We don&apos;t accept payment to include an item or to move it up a
        ranking. Our placements reflect our own assessment, full stop. The site
        is supported by advertising, which is clearly labeled and kept separate
        from editorial content — advertisers never see or influence our rankings
        before publication.
      </p>

      <h2>Accuracy and corrections</h2>
      <p>
        We aim to get the details right and we keep guides current as standards
        and recommendations change — that&apos;s what the &ldquo;Last
        updated&rdquo; date on each article reflects. If you spot something that
        looks wrong or out of date, please tell us and we&apos;ll review and fix
        it.
      </p>

      <h2>Contact</h2>
      <p>
        Have a question, a correction, or feedback? Email{" "}
        <a href="mailto:hello@valuefindsdaily.com">hello@valuefindsdaily.com</a>
        . We read everything.
      </p>
    </main>
  );
}
