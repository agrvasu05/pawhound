import Link from "next/link";
import Image from "next/image";
import { getAllArticles, getBreedImage, type Article } from "@/lib/articles";
import AdSlot from "@/components/AdSlot";
import FreebieBanner from "@/components/FreebieBanner";
import { LogoMark } from "@/components/Logo";

export const metadata = {
  alternates: { canonical: "/" },
};

// Display labels + ordering for each niche section. New trending niches sit on
// top; dog guides are pushed to the bottom.
// Home/cozy is the site's identity now (2026-07 refocus): decor + cozy living
// lead, printables-adjacent niches follow, and the retired niches (beauty,
// fashion, dogs) sink to the bottom while their archive pages age out.
const NICHE_META: Record<string, { label: string; blurb: string; order: number }> = {
  "home decor": { label: "Home Decor & Styling", blurb: "Wall art, room ideas, and decor inspiration.", order: 0 },
  home: { label: "Home & Cozy Living", blurb: "Small-space wins, cozy corners, and budget makeovers.", order: 1 },
  "aesthetic art & printables": { label: "Printables & Aesthetic Art", blurb: "Instant-download art and printables.", order: 2 },
  wellness: { label: "Wellness & Self-Care", blurb: "Routines, planners, and calm-living ideas.", order: 3 },
  "gifts & occasions": { label: "Gifts & Occasions", blurb: "Graduation, parties, and giftable finds.", order: 4 },
  beauty: { label: "Beauty & Nails", blurb: "Trending nail, hair, and beauty looks.", order: 80 },
  fashion: { label: "Fashion & Outfit Ideas", blurb: "Trending looks, capsule wardrobes, and styling guides.", order: 85 },
  dogs: { label: "Dog Breed Guides", blurb: "Find the breed that actually fits your life.", order: 90 },
};

function nicheOf(a: Article) {
  return a.niche || "dogs";
}

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
            alt={article.topic_title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
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
  const articles = getAllArticles().filter((a) => a.picks.length >= 3);

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
              <a
                key={niche}
                href={`#${niche}`}
                className="rounded-full border border-emerald-200 bg-white/70 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-700 hover:text-white"
              >
                {NICHE_META[niche]?.label ?? niche}
              </a>
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
                  <span className="whitespace-nowrap text-sm font-medium text-stone-400">
                    {items.length} guide{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((article) => (
                    <ArticleCard key={article.topic_slug} article={article} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
