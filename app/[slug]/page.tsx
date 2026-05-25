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

  const sortedPicks = [...article.picks].sort((a, b) => b.rank - a.rank);

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <Link
        href="/"
        className="text-sm text-stone-500 hover:text-stone-900 mb-6 inline-block"
      >
        ← All guides
      </Link>

      <h1
        className="text-4xl md:text-5xl font-bold mb-6 leading-tight"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {article.topic_title}
      </h1>

      <p className="text-lg text-stone-700 mb-8 leading-relaxed">
        {article.intro}
      </p>

      <Link
        href={`/${article.topic_slug}/${sortedPicks[0].rank}`}
        className="inline-block bg-emerald-700 hover:bg-emerald-800 text-white px-8 py-4 rounded-full font-semibold text-lg mb-12"
      >
        Start the countdown from #{sortedPicks[0].rank} →
      </Link>

      <AdSlot type="native" className="my-8" />

      <h2
        className="text-2xl font-bold mb-6"
        style={{ fontFamily: "Georgia, serif" }}
      >
        All {sortedPicks.length} breeds
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sortedPicks.map((pick) => (
          <Link
            key={pick.rank}
            href={`/${article.topic_slug}/${pick.rank}`}
            className="group relative aspect-square rounded-xl overflow-hidden bg-stone-200"
          >
            <Image
              src={getBreedImage(pick.breed)}
              alt={pick.breed}
              fill
              className="object-cover group-hover:scale-105 transition"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent p-3 flex flex-col justify-end">
              <span className="text-white text-xs font-bold">#{pick.rank}</span>
              <span className="text-white font-semibold leading-tight">
                {pick.breed}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
