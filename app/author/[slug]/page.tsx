import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AUTHOR } from "@/lib/author";
import { getPublishedArticles, isIndexable } from "@/lib/articles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://valuefindsdaily.com";

export async function generateStaticParams() {
  return [{ slug: AUTHOR.slug }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (slug !== AUTHOR.slug) return {};
  return {
    title: `${AUTHOR.name} — Author`,
    description: AUTHOR.short,
    alternates: { canonical: `/author/${AUTHOR.slug}` },
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== AUTHOR.slug) notFound();
  const guides = getPublishedArticles()
    .filter((a) => isIndexable(a))
    .sort((a, b) => (b.upgraded_at || "").localeCompare(a.upgraded_at || ""));
  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: AUTHOR.name,
    url: `${SITE_URL}/author/${AUTHOR.slug}`,
    description: AUTHOR.short,
    worksFor: { "@type": "Organization", name: "Value Finds Daily", url: SITE_URL },
  };
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }} />
      <div className="flex items-center gap-4">
        <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-700 text-xl font-bold text-white">
          {AUTHOR.initials}
        </span>
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>{AUTHOR.name}</h1>
          <p className="text-stone-500">{AUTHOR.short}</p>
        </div>
      </div>
      <div className="prose prose-stone mt-8 max-w-none">
        {AUTHOR.bio.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      {guides.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>Guides by {AUTHOR.name}</h2>
          <ul className="divide-y divide-stone-200 border-y border-stone-200">
            {guides.map((g) => (
              <li key={g.topic_slug} className="py-3">
                <Link href={`/${g.topic_slug}`} className="font-medium text-stone-800 hover:text-emerald-700">{g.topic_title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
