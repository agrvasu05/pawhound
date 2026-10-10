import Link from "next/link";
import Image from "next/image";
import { getPublishedArticles, getBreedImage, isIndexable, type Article } from "@/lib/articles";
import AdSlot from "@/components/AdSlot";
import FreebieBanner from "@/components/FreebieBanner";
import { LogoMark } from "@/components/Logo";

export const metadata = {
  alternates: { canonical: "/" },
};

import { NICHE_META, nicheOf, nicheSlug, sortNewest } from "@/lib/niches";

// Each section shows its newest guides; the full list lives on /guides/<niche>.
// The homepage used to render all 277 guides (1.5 MB of HTML, 270 images),
// which hurt both load time and crawl focus.
const PER_SECTION = 9;

function ArticleCard({ article }: { article: Article }) {
  const topBreed = article.picks.find((p) => p.rank === 1);
  const imgSrc = topBreed ? getBreedImage(topBreed.breed) : null;
  const itemNoun = article.item_noun ?? "breeds";
  const meta = NICHE_META[nicheOf(article)];

  return (
    <Link
      href={`/${article.topic_slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)" }}
      >
        {imgSrc && (
          <Image
            src={imgSrc}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
        {meta && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-800 shadow-sm backdrop-blur">
            {meta.label}
          </span>
        )}
        <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          {article.picks.length} {itemNoun}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="mb-2 text-lg font-bold leading-snug text-stone-900">
          {article.topic_title}
        </h3>
        <p className="line-clamp-2 text-sm text-stone-500">{article.intro}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 transition group-hover:gap-2">
          See the ranking
          <span aria-hidden>→</span>
        </span>
      </div>
    </Link>
  );
}

export default function Home() {
  // Homepage shows only indexable guides (no duplicates, no off-niche archive).
  const articles = getPublishedArticles().filter((a) => a.picks.length >= 3 && isIndexable(a));

  // Group by niche, ordered by NICHE_META.
  const groups = new Map<string, Article[]>();
  for (const a of articles) {
    const n = nicheOf(a);
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n)!.push(a);
  }
  // Unknown niches default to 50 — above dog guides (90), below the named new niches.
  const sections = [...groups.entries()].sort(
    ([a], [b]) => (NICHE_META[a]?.order ?? 50) - (NICHE_META[b]?.order ?? 50)
  );

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-emerald-900/10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 400px at 50% -10%, #d7f0e1 0%, #f3faf5 45%, #ffffff 80%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:py-20">
          <div className="mb-6 flex justify-center">
            <LogoMark className="h-16 w-16" />
          </div>
          <h1
            className="text-4xl font-black leading-tight tracking-tight text-stone-900 sm:text-5xl"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            A cozier home,
            <span className="text-emerald-700"> one idea at a time.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-stone-600">
            Cozy home decor ideas, small-space wins, and printable wall art &
            planners you can download in seconds.
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href="/shop"
              className="rounded-full bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-emerald-800"
            >
              Shop Printables →
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {sections.map(([niche]) => (
              <Link
                key={niche}
                href={`/guides/${nicheSlug(niche)}`}
                className="rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-700 hover:text-white"
              >
                {NICHE_META[niche]?.label ?? niche}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        <FreebieBanner />
        <AdSlot type="native" className="my-8" />

        {articles.length === 0 ? (
          <div className="py-20 text-center text-stone-400">
            <p className="text-lg">Content generating — check back in a few minutes.</p>
          </div>
        ) : (
          sections.map(([niche, items]) => {
            const meta = NICHE_META[niche];
            return (
              <section key={niche} id={niche} className="scroll-mt-20 py-10">
                <div className="mb-6 flex items-end justify-between border-b border-stone-100 pb-3">
                  <div>
                    <h2
                      className="text-2xl font-bold text-stone-900"
                      style={{ fontFamily: "var(--font-display), Georgia, serif" }}
                    >
                      {meta?.label ?? niche}
                    </h2>
                    {meta?.blurb && (
                      <p className="mt-1 text-sm text-stone-500">{meta.blurb}</p>
                    )}
                  </div>
                  <Link href={`/guides/${nicheSlug(niche)}`} className="whitespace-nowrap text-sm font-medium text-stone-400 hover:text-emerald-700">
                    {items.length} guide{items.length === 1 ? "" : "s"} →
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {sortNewest(items).slice(0, PER_SECTION).map((article) => (
                    <ArticleCard key={article.topic_slug} article={article} />
                  ))}
                </div>
                {items.length > PER_SECTION && (
                  <div className="mt-6 text-center">
                    <Link
                      href={`/guides/${nicheSlug(niche)}`}
                      className="inline-block rounded-full border border-emerald-200 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-700 hover:text-white"
                    >
                      View all {items.length} {meta?.label ?? niche} guides →
                    </Link>
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
