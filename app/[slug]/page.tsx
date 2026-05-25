import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getArticle, getAllArticles, getBreedImage } from "@/lib/articles";
import AdSlot from "@/components/AdSlot";
import HubCTAButton from "@/components/HubCTAButton";

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

  const totalBreeds = article.picks.length;
  const startRank = totalBreeds;
  const topBreed = article.picks.find((p) => p.rank === 1);
  const directLink = process.env.NEXT_PUBLIC_ADSTERRA_DIRECT_LINK;

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

      <p className="text-lg text-stone-700 mb-6 leading-relaxed">
        {article.intro}
      </p>

      {/* Curiosity teaser — show #1 image blurred so users must click to find out */}
      {topBreed && (
        <div className="relative rounded-2xl overflow-hidden mb-8 border-4 border-emerald-700">
          <div className="relative h-48 md:h-64">
            <Image
              src={getBreedImage(topBreed.breed)}
              alt="The #1 ranked breed"
              fill
              className="object-cover blur-md scale-110"
            />
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center px-4">
              <span className="text-emerald-400 font-bold text-sm uppercase tracking-widest mb-2">
                🏆 Ranked #1
              </span>
              <p className="text-white text-xl md:text-2xl font-bold mb-4">
                Which breed topped our list?
              </p>
              <HubCTAButton
                href={`/${article.topic_slug}/${startRank}`}
                directLink={directLink}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-full font-semibold text-base transition"
              >
                Reveal the ranking →
              </HubCTAButton>
            </div>
          </div>
        </div>
      )}

      <AdSlot type="native" className="my-8" />

      <div className="mt-4 text-center">
        <HubCTAButton
          href={`/${article.topic_slug}/${startRank}`}
          directLink={directLink}
          className="inline-block bg-emerald-700 hover:bg-emerald-800 text-white px-8 py-4 rounded-full font-semibold text-lg transition"
        >
          Start from #{startRank} and count down to #1 →
        </HubCTAButton>
      </div>
    </main>
  );
}
