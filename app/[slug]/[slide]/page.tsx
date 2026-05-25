import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getArticle, getAllArticles, getBreedImage } from "@/lib/articles";
import AdSlot from "@/components/AdSlot";
import NextButton from "@/components/NextButton";

export async function generateStaticParams() {
  const params: { slug: string; slide: string }[] = [];
  for (const a of getAllArticles()) {
    for (const p of a.picks) {
      params.push({ slug: a.topic_slug, slide: String(p.rank) });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; slide: string }>;
}): Promise<Metadata> {
  const { slug, slide } = await params;
  const article = getArticle(slug);
  const pick = article?.picks.find((p) => p.rank === parseInt(slide));
  if (!article || !pick) return {};
  return {
    title: `#${pick.rank}: ${pick.breed} — ${article.topic_title}`,
    description: pick.description.slice(0, 160),
  };
}

export default async function Slide({
  params,
}: {
  params: Promise<{ slug: string; slide: string }>;
}) {
  const { slug, slide } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const currentRank = parseInt(slide);
  const pick = article.picks.find((p) => p.rank === currentRank);
  if (!pick) notFound();

  const nextRank = currentRank - 1;
  const hasNext = nextRank >= 1;
  const isLastSlide = currentRank === 1;
  // Fire on every 3rd slide (positions 3, 6, 9...) but not the last slide
  const slidePosition = article.picks.length - currentRank + 1;
  const useDirectLink = !isLastSlide && slidePosition % 3 === 0;
  const nextHref = hasNext ? `/${slug}/${nextRank}` : `/${slug}`;
  const directLink = process.env.NEXT_PUBLIC_ADSTERRA_DIRECT_LINK;

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="flex justify-between items-center text-sm text-stone-500 mb-4">
        <Link href={`/${slug}`} className="hover:text-stone-900">
          ← {article.topic_title}
        </Link>
        <span>
          {article.picks.length - currentRank + 1} of {article.picks.length}
        </span>
      </div>

      {/* Hero image */}
      <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-200 mb-4">
        <Image
          src={getBreedImage(pick.breed)}
          alt={pick.breed}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 768px"
        />
        <div className="absolute top-4 left-4 bg-white/95 text-stone-900 px-4 py-2 rounded-full font-bold text-sm">
          {isLastSlide ? "#1 PICK" : `#${pick.rank}`}
        </div>
      </div>

      {/* Title */}
      <h1
        className="text-3xl md:text-4xl font-bold mb-2"
        style={{ fontFamily: "Georgia, serif" }}
      >
        {pick.breed}
      </h1>
      <p className="text-emerald-700 font-medium mb-6">{pick.best_for}</p>

      {/* Native ad — high RPM placement between image and text */}
      <AdSlot type="native" className="my-6" />

      {/* Description */}
      <div className="prose prose-stone prose-lg max-w-none mb-6">
        <p>{pick.description}</p>
      </div>

      {/* Quirky fact callout */}
      <div className="bg-amber-50 border-l-4 border-amber-400 px-5 py-4 rounded-r-lg mb-8">
        <p className="text-stone-800">
          <strong>Did you know?</strong> {pick.quirky_fact}
        </p>
      </div>

      {/* Second native ad */}
      {currentRank > 1 && <AdSlot type="native" className="my-6" />}

      {/* Navigation */}
      <div className="flex flex-col sm:flex-row gap-3 my-10">
        {currentRank < article.picks.length && (
          <Link
            href={`/${slug}/${currentRank + 1}`}
            className="flex-1 text-center bg-stone-200 hover:bg-stone-300 text-stone-800 px-6 py-4 rounded-full font-semibold"
          >
            ← Previous (#{currentRank + 1})
          </Link>
        )}
        <NextButton
          href={nextHref}
          useDirectLink={useDirectLink}
          isLastSlide={isLastSlide}
          nextRank={nextRank}
          hasNext={hasNext}
          directLink={directLink}
        />
        {!hasNext && (
          <Link
            href={`/${slug}`}
            className="flex-1 block text-center bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-4 rounded-full font-semibold text-lg"
          >
            See all rankings →
          </Link>
        )}
      </div>

      {/* Third native ad */}
      <AdSlot type="native" className="my-6" />

    </main>
  );
}
