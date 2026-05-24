import Link from "next/link";
import Image from "next/image";
import { getAllArticles, getBreedImage } from "@/lib/articles";
import AdSlot from "@/components/AdSlot";

export default function Home() {
  const articles = getAllArticles();

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <header className="mb-12 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-3" style={{ fontFamily: "Georgia, serif" }}>
          Value Finds Daily
        </h1>
        <p className="text-xl text-stone-600 max-w-2xl mx-auto">
          Real, honest dog breed guides. No fluff — just the breeds that
          actually fit your life.
        </p>
      </header>

      <AdSlot type="native" className="my-8" />

      {articles.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-lg">Content coming soon. Run the generate script to populate articles.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article) => {
            const topBreed = article.picks.find((p) => p.rank === 1);
            return (
              <Link
                key={article.topic_slug}
                href={`/${article.topic_slug}`}
                className="group rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition"
              >
                <div className="aspect-[4/3] relative bg-stone-200">
                  {topBreed && (
                    <Image
                      src={getBreedImage(topBreed.breed)}
                      alt={article.topic_title}
                      fill
                      className="object-cover group-hover:scale-105 transition"
                    />
                  )}
                </div>
                <div className="p-5">
                  <h2 className="text-lg font-semibold leading-tight mb-2">
                    {article.topic_title}
                  </h2>
                  <p className="text-sm text-stone-500">
                    {article.picks.length} breeds ranked
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <footer className="mt-20 pt-8 border-t border-stone-200 text-sm text-stone-500 text-center space-x-4">
        <Link href="/about">About</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/attribution">Image Credits</Link>
      </footer>
    </main>
  );
}
