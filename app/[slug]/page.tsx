import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getArticle, getBreedImage, getPublishedArticles, isIndexable, metaDescription } from "@/lib/articles";
import { getBreed } from "@/lib/breeds";
import { shopHref, dogEssentialsFor } from "@/lib/affiliate";
import { getProductsForArticle, shopAsset } from "@/lib/shop";
import AdSlot from "@/components/AdSlot";
import FreebieBanner from "@/components/FreebieBanner";
import PinItButton from "@/components/PinItButton";
import { nicheMeta, nicheOf, nicheSlug } from "@/lib/niches";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://valuefindsdaily.com";

// Duplicate articles are not pages: public/_redirects 301s them to the one we kept.
export async function generateStaticParams() {
  return getPublishedArticles().map((a) => ({ slug: a.topic_slug }));
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
  const description = metaDescription(article.intro);
  return {
    title: article.topic_title,
    description,
    // Off-niche archive (beauty/fashion): live for old pins, kept out of Google.
    ...(isIndexable(article) ? {} : { robots: { index: false, follow: true } }),
    alternates: { canonical: `/${slug}` },
    openGraph: {
      type: "article",
      title: article.topic_title,
      description,
      images: topBreed ? [getBreedImage(topBreed.breed)] : [],
      ...(article.updated_at
        ? { modifiedTime: `${article.updated_at}T00:00:00Z` }
        : {}),
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
  const products = getProductsForArticle(article.niche, 3);
  const essentials = isDogs ? dogEssentialsFor(article.topic_title) : [];
  const pinMedia = topPick
    ? `${SITE_URL}${getBreedImage(topPick.breed)}`
    : `${SITE_URL}/favicon.ico`;

  // Related guides — internal links (SEO crawl + ranking) and more pageviews.
  const relatedAll = getPublishedArticles().filter(
    (a) => a.topic_slug !== slug && a.picks.length >= 3 && isIndexable(a)
  );
  // Most topically similar guides first (shared title words), same niche
  // preferred — internal links that match intent help both readers and crawl.
  const words = (t: string) =>
    new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !/^(best|ideas|that|with|your|from|2026|2027|breeds?|guide)$/.test(w)));
  const mine = words(article.topic_title);
  const score = (a: { topic_title: string; niche?: string }) => {
    let n = 0;
    for (const w of words(a.topic_title)) if (mine.has(w)) n++;
    return n * 2 + ((a.niche || "dogs") === (article.niche || "dogs") ? 1 : 0);
  };
  const related = [...relatedAll].sort((a, b) => score(b) - score(a)).slice(0, 6);

  // "At a glance" table for dog guides — real attributes from content/breeds.json.
  const glance = isDogs
    ? ranked
        .slice()
        .reverse()
        .map((p) => ({ rank: p.rank, name: p.breed, b: getBreed(p.breed) }))
        .filter((r) => r.b)
    : [];

  // ItemList structured data — tells search engines this is a real ranked list.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: article.topic_title,
    description: metaDescription(article.intro, 200),
    numberOfItems: total,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: article.picks.map((p) => ({
      "@type": "ListItem",
      position: p.rank,
      name: p.breed,
    })),
  };

  const niche = nicheOf(article);
  const nmeta = nicheMeta(niche);
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: nmeta.label, item: `${SITE_URL}/guides/${nicheSlug(niche)}` },
      { "@type": "ListItem", position: 3, name: article.topic_title, item: `${SITE_URL}/${slug}` },
    ],
  };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.topic_title,
    description: metaDescription(article.intro, 200),
    image: topPick ? [`${SITE_URL}${getBreedImage(topPick.breed)}`] : [],
    author: { "@type": "Organization", name: "Value Finds Daily Editorial Team", url: `${SITE_URL}/about` },
    publisher: { "@type": "Organization", name: "Value Finds Daily", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/${slug}`,
    ...(article.updated_at ? { dateModified: `${article.updated_at}T00:00:00Z`, datePublished: `${article.updated_at}T00:00:00Z` } : {}),
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

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-stone-500">
        <Link href="/" className="hover:text-stone-900">Home</Link>
        <span className="mx-2">›</span>
        <Link href={`/guides/${nicheSlug(niche)}`} className="hover:text-stone-900">{nmeta.label}</Link>
      </nav>

      <h1
        className="text-4xl md:text-5xl font-bold mb-4 leading-tight"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {article.topic_title}
      </h1>

      <p className="text-sm font-medium text-emerald-700 mb-2">
        {total} {itemNoun} ranked · counting down to #1
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-stone-500">
        <p>
          By <span className="font-medium text-stone-700">{author}</span>
          {updatedLabel ? <> · Last updated {updatedLabel}</> : null}
        </p>
        <PinItButton
          url={`${SITE_URL}/${slug}`}
          media={pinMedia}
          description={`${article.topic_title} — ${article.intro.slice(0, 120)}`}
        />
      </div>

      <p className="text-lg text-stone-700 mb-6 leading-relaxed">
        {article.intro}
      </p>

      {article.picks.some((p) => p.affiliate_url || p.shop_query) && (
        <p className="-mt-3 mb-6 text-xs text-stone-500">
          This article contains affiliate links. We may earn a small commission
          at no extra cost to you.
        </p>
      )}

      <div className="rounded-xl bg-stone-50 border border-stone-200 px-5 py-4 mb-8 text-sm text-stone-600 leading-relaxed">
        <strong className="text-stone-800">How we ranked these:</strong> every{" "}
        {itemSingular} below was chosen for real-world fit —{" "}
        {isDogs
          ? "temperament, energy level, grooming needs, and how well it suits everyday households"
          : "practicality, style, value, and how easily it works in a real home"}
        . We count down from #{total} to our #1 pick, so keep scrolling for the
        top spot.
      </div>

      {glance.length >= 3 && (
        <section className="mb-10 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="px-5 pt-4 pb-2 text-left text-sm font-semibold uppercase tracking-wide text-stone-500">
              At a glance: {glance.length} breeds compared
            </caption>
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">#</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Breed</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Size</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Energy</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Shedding</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Training</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Barking</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Lifespan</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Kids</th>
              </tr>
            </thead>
            <tbody>
              {glance.map(({ rank, name, b }) => (
                <tr key={rank} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2.5 font-bold text-emerald-700">{rank}</td>
                  <th scope="row" className="px-4 py-2.5 font-medium text-stone-900">
                    <a href={`#item-${rank}`} className="hover:text-emerald-700">{name}</a>
                  </th>
                  <td className="px-4 py-2.5 capitalize">{b!.size}</td>
                  <td className="px-4 py-2.5 capitalize">{b!.energy}</td>
                  <td className="px-4 py-2.5 capitalize">{b!.shedding}</td>
                  <td className="px-4 py-2.5 capitalize">{b!.trainability}</td>
                  <td className="px-4 py-2.5 capitalize">{b!.barking}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{b!.lifespan_min}–{b!.lifespan_max} yrs</td>
                  <td className="px-4 py-2.5">{b!.good_with_kids ? "Yes" : "Caution"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <FreebieBanner />

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

            {/* Affiliate CTA — direct affiliate_url if set, else a Skimlinks-affiliated
                merchant search for the item (auto-converted by the Skimlinks script). */}
            {(() => {
              const href =
                pick.affiliate_url ||
                (pick.shop_query ? shopHref(article.niche, pick.shop_query) : null);
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
                >
                  Shop {pick.breed} →
                </a>
              ) : null;
            })()}
          </article>

          {/* Ad after every 3rd entry (but not right before the conclusion) */}
          {(i + 1) % 3 === 0 && i < ranked.length - 1 && (
            <AdSlot className="my-8" />
          )}
        </div>
      ))}

      {/* Dog-owner essentials — the guides that click best on Pinterest had no
          affiliate links at all. Tagged Amazon searches, earning from day one. */}
      {essentials.length > 0 && (
        <section className="mb-10 rounded-2xl border border-stone-200 bg-stone-50 p-6">
          <h2
            className="mb-1 text-2xl font-bold"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            Bringing one of these home? Start here
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            The first-month essentials we recommend to every new owner. Affiliate links — we may earn a small commission at no extra cost to you.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {essentials.map((e) => (
              <li key={e.query} className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
                <a
                  href={shopHref("dogs", e.query)}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  className="font-semibold text-stone-900 hover:text-emerald-700"
                >
                  {e.label} →
                </a>
                <p className="mt-1 text-sm text-stone-500">{e.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Printables that fit this guide — the guides and the shop used to be
          two separate sites sharing a header. */}
      {products.length > 0 && (
        <section className="mb-10">
          <h2
            className="mb-1 text-2xl font-bold"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            {isDogs ? "Printable art for dog lovers" : "Printables for a cozier home"}
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Instant downloads from our shop — print at home or at any print shop.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {products.map((p) => (
              <Link
                key={p.slug}
                href={`/shop/${p.slug}`}
                className="group block overflow-hidden rounded-xl ring-1 ring-stone-200 transition hover:shadow-lg"
              >
                <div className="relative aspect-[4/5] bg-stone-100">
                  <Image
                    src={shopAsset(p.slug, p.cover)}
                    alt={p.title}
                    fill
                    className="object-cover transition group-hover:scale-105"
                    sizes="(max-width: 640px) 33vw, 220px"
                  />
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium text-stone-800">{p.title}</p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">${p.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

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

      {related.length > 0 && (
        <section className="mt-14 border-t border-stone-100 pt-8">
          <h2
            className="mb-6 text-2xl font-bold"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            More guides you&apos;ll love
          </h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            {related.map((r) => {
              const top = r.picks.find((p) => p.rank === 1);
              return (
                <Link
                  key={r.topic_slug}
                  href={`/${r.topic_slug}`}
                  className="group block overflow-hidden rounded-xl ring-1 ring-stone-200 transition hover:shadow-lg"
                >
                  <div className="relative aspect-[4/3] bg-stone-100">
                    {top && (
                      <Image
                        src={getBreedImage(top.breed)}
                        alt=""
                        fill
                        className="object-cover transition group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, 220px"
                      />
                    )}
                  </div>
                  <p className="line-clamp-2 p-3 text-sm font-medium text-stone-800">
                    {r.topic_title}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <AdSlot className="my-8" />
    </main>
  );
}
