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
  const lastBreed = article.picks.find((p) => p.rank === totalBreeds);
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

      {/* Preview card — shows the last ranked breed clearly to kick off the countdown */}
      {lastBreed && (
        <div className="rounded-2xl overflow-hidden mb-8 border border-stone-200 shadow-sm bg-white">
          <div className="relative h-48 md:h-64 w-full">
            <Image
              src={getBreedImage(lastBreed.breed)}
              alt={lastBreed.breed}
              fill
              className="object-cover"
            />
            <div className="absolute top-3 left-3 bg-stone-800/80 text-white text-xs font-bold px-3 py-1 rounded-full">
              #{totalBreeds} on our list
            </div>
          </div>
          <div className="p-5">
            <h2 className="text-xl font-bold mb-1">{lastBreed.breed}</h2>
            <p className="text-stone-600 text-sm leading-relaxed mb-4">
              {lastBreed.description.slice(0, 120)}…
            </p>
            <HubCTAButton
              href={`/${article.topic_slug}/${startRank}`}
              directLink={directLink}
              className="inline-block bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-3 rounded-full font-semibold text-base transition"
            >
              See all {totalBreeds} breeds ranked →
            </HubCTAButton>
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
