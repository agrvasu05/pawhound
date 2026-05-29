import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getArticle, getAllArticles, getBreedImage } from "@/lib/articles";
import AdSlot from "@/components/AdSlot";

export async function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.topic_slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  const topBreed = article.picks.find((p) => p.rank === 1);
  return {
    title: article.topic_title,
    description: article.intro.slice(0, 160),
    alternates: { canonical: `/${slug}` },
    openGraph: {
      title: article.topic_title,
      description: article.intro.slice(0, 160),
      images: topBreed ? [getBreedImage(topBreed.breed)] : [],
    },
  };
}

export default async function ArticleHub({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const total = article.picks.length;
  const itemNoun = article.item_noun ?? "breeds";
  const itemSingular = itemNoun.replace(/s$/, "");
  const isDogs = (article.niche ?? "dogs") === "dogs";

  // Count down from the highest rank to #1.
  const ranked = [...article.picks].sort((a, b) => b.rank - a.rank);
  const topPick = article.picks.find((p) => p.rank === 1);

  const author = article.author ?? "the Value Finds Daily Editorial Team";
  const updatedLabel = article.updated_at
    ? new Date(`${article.updated_at}T00:00:00`).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const faqs = article.faqs ?? [];

  // ItemList structured data — tells search engines this is a real ranked list.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: article.topic_title,
    description: article.intro.slice(0, 200),
    numberOfItems: total,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: article.picks.map((p) => ({
      "@type": "ListItem",
      position: p.rank,
      name: p.breed,
    })),
  };

  // FAQPage structured data — eligible for rich results, a strong E-E-A-T signal.
  const faqJsonLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/"
        className="text-sm text-stone-500 hover:text-stone-900 mb-6 inline-block"
      >
        ← All guides
      </Link>

      <h1
        className="text-4xl md:text-5xl font-bold mb-4 leading-tight"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {article.topic_title}
      </h1>

      <p className="text-sm font-medium text-emerald-700 mb-2">
        {total} {itemNoun} ranked · counting down to #1
      </p>

      <p className="mb-6 text-sm text-stone-500">
        By <span className="font-medium text-stone-700">{author}</span>
        {updatedLabel ? <> · Last updated {updatedLabel}</> : null}
      </p>

      <p className="text-lg text-stone-700 mb-6 leading-relaxed">
        {article.intro}
      </p>

      <div className="rounded-xl bg-stone-50 border border-stone-200 px-5 py-4 mb-8 text-sm text-stone-600 leading-relaxed">
        <strong className="text-stone-800">How we ranked these:</strong> every{" "}
        {itemSingular} below was chosen for real-world fit —{" "}
        {isDogs
          ? "temperament, energy level, grooming needs, and how well it suits everyday households"
          : "practicality, style, value, and how easily it works in a real home"}
        . We count down from #{total} to our #1 pick, so keep scrolling for the
        top spot.
      </div>

      {/* Quick jump list — scannable overview + internal anchors */}
      <nav className="mb-10 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          The full ranking
        </h2>
        <ol className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {ranked.map((pick) => (
            <li key={pick.rank}>
              <a
                href={`#item-${pick.rank}`}
                className="flex items-baseline gap-2 py-1 text-stone-700 transition hover:text-emerald-700"
              >
                <span className="w-7 shrink-0 text-right font-bold text-emerald-700">
                  #{pick.rank}
                </span>
                <span className="truncate">{pick.breed}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <AdSlot className="my-8" />

      {/* Full ranked entries */}
      {ranked.map((pick, i) => (
        <div key={pick.rank}>
          <article
            id={`item-${pick.rank}`}
            className="scroll-mt-24 mb-10 border-b border-stone-100 pb-10"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-lg font-bold text-white">
                {pick.rank}
              </span>
              <h2
                className="text-2xl md:text-3xl font-bold leading-tight"
                style={{ fontFamily: "var(--font-display), Georgia, serif" }}
              >
                {pick.breed}
              </h2>
            </div>

            <div className="relative mb-5 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-stone-100">
              <Image
                src={getBreedImage(pick.breed)}
                alt={pick.breed}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
              />
            </div>

            {pick.best_for && (
              <p className="mb-4 inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-800">
                Best for: {pick.best_for}
              </p>
            )}

            <div className="prose prose-stone prose-lg max-w-none">
              <p>{pick.description}</p>
            </div>

            {pick.quirky_fact && (
              <div className="mt-5 rounded-r-lg border-l-4 border-amber-400 bg-amber-50 px-5 py-4">
                <p className="text-stone-800">
                  <strong>Did you know?</strong> {pick.quirky_fact}
                </p>
              </div>
            )}
          </article>

          {/* Ad after every 3rd entry (but not right before the conclusion) */}
          {(i + 1) % 3 === 0 && i < ranked.length - 1 && (
            <AdSlot className="my-8" />
          )}
        </div>
      ))}

      {/* Conclusion */}
      <section className="mt-2 rounded-2xl bg-emerald-50/60 border border-emerald-100 p-6">
        <h2
          className="mb-3 text-2xl font-bold"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          The bottom line
        </h2>
        <p className="text-stone-700 leading-relaxed">
          {topPick ? (
            <>
              Our #1 pick is <strong>{topPick.breed}</strong>
              {topPick.best_for ? ` — ${topPick.best_for.toLowerCase()}` : ""}.
              Still, the right choice comes down to your space, routine, and what
              you value most. Any {itemSingular} on this list is a solid place to
              start.
            </>
          ) : (
            <>
              Any {itemSingular} on this list is a solid place to start — the
              best choice comes down to your space, routine, and what you value
              most.
            </>
          )}
        </p>
        <p className="mt-4">
          <Link
            href={`/${slug}/${total}`}
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Prefer to flip through one at a time? View as a slideshow →
          </Link>
        </p>
      </section>

      {faqs.length > 0 && (
        <>
          {faqJsonLd && (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
          )}
          <section className="mt-12">
            <h2
              className="mb-6 text-2xl md:text-3xl font-bold"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
            >
              Frequently asked questions
            </h2>
            <dl className="divide-y divide-stone-200 border-t border-stone-200">
              {faqs.map((faq, i) => (
                <div key={i} className="py-5">
                  <dt className="mb-2 text-lg font-semibold text-stone-900">
                    {faq.question}
                  </dt>
                  <dd className="text-stone-700 leading-relaxed">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}

      <AdSlot className="my-8" />
    </main>
  );
}
