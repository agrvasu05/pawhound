import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getAllArticles, getBreedImage } from "@/lib/articles";
import { nicheFromSlug, nicheMeta, nicheOf, nicheSlug, sortNewest } from "@/lib/niches";
import FreebieBanner from "@/components/FreebieBanner";
import AdSlot from "@/components/AdSlot";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://valuefindsdaily.com";

function allNiches() {
  return [...new Set(getAllArticles().map(nicheOf))];
}

export async function generateStaticParams() {
  return allNiches().map((n) => ({ niche: nicheSlug(n) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ niche: string }>;
}): Promise<Metadata> {
  const { niche: slug } = await params;
  const niche = nicheFromSlug(slug, allNiches());
  if (!niche) return {};
  const meta = nicheMeta(niche);
  const count = getAllArticles().filter((a) => nicheOf(a) === niche && a.picks.length >= 3).length;
  return {
    title: `${meta.label} — ${count} Guides`,
    description: meta.description,
    alternates: { canonical: `/guides/${slug}` },
    openGraph: { title: `${meta.label} | Value Finds Daily`, description: meta.description, type: "website" },
  };
}

export default async function NichePage({ params }: { params: Promise<{ niche: string }> }) {
  const { niche: slug } = await params;
  const niche = nicheFromSlug(slug, allNiches());
  if (!niche) notFound();
  const meta = nicheMeta(niche);
  const articles = sortNewest(getAllArticles().filter((a) => nicheOf(a) === niche && a.picks.length >= 3));

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: meta.label, item: `${SITE_URL}/guides/${slug}` },
    ],
  };
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: meta.label,
    description: meta.description,
    url: `${SITE_URL}/guides/${slug}`,
    hasPart: articles.slice(0, 50).map((a) => ({ "@type": "Article", headline: a.topic_title, url: `${SITE_URL}/${a.topic_slug}` })),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collection) }} />
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-stone-500">
        <Link href="/" className="hover:text-stone-900">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-stone-700">{meta.label}</span>
      </nav>
      <h1
        className="text-4xl font-bold leading-tight md:text-5xl"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {meta.label}
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-stone-600">{meta.description}</p>
      <p className="mt-1 text-sm text-stone-400">{articles.length} guides, newest first</p>

      <FreebieBanner />

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a, i) => {
          const top = a.picks.find((p) => p.rank === 1);
          return (
            <Link
              key={a.topic_slug}
              href={`/${a.topic_slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                {top && (
                  <Image
                    src={getBreedImage(top.breed)}
                    alt={a.topic_title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    loading={i < 6 ? "eager" : "lazy"}
                  />
                )}
                <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">
                  {a.picks.length} {a.item_noun ?? "breeds"}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="mb-2 text-lg font-bold leading-snug text-stone-900">{a.topic_title}</h2>
                <p className="line-clamp-2 text-sm text-stone-500">{a.intro}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <AdSlot className="my-10" />
    </main>
  );
}
