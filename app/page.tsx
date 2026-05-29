import Link from "next/link";
import Image from "next/image";
import { getAllArticles, getBreedImage } from "@/lib/articles";
import AdSlot from "@/components/AdSlot";

export default function Home() {
  const articles = getAllArticles().filter((a) => a.picks.length >= 3);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10" style={{ background: "#fff", minHeight: "100vh" }}>
      <header className="mb-12 text-center">
        <h1
          className="text-5xl md:text-6xl font-bold mb-3 text-stone-900"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Value Finds Daily
        </h1>
        <p className="text-xl text-stone-500 max-w-2xl mx-auto">
          Real, honest guides — dog breeds, cozy home ideas, and more. Find what
          actually fits your life.
        </p>
      </header>

      <AdSlot type="native" className="my-8" />

      {articles.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="text-lg">Content generating — check back in a few minutes.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => {
            const topBreed = article.picks.find((p) => p.rank === 1);
            const imgSrc = topBreed ? getBreedImage(topBreed.breed) : null;

            return (
              <Link
                key={article.topic_slug}
                href={`/${article.topic_slug}`}
                className="group rounded-2xl overflow-hidden bg-white border border-stone-100 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="aspect-[4/3] relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)" }}
                >
                  {imgSrc && (
                    <Image
                      src={imgSrc}
                      alt={article.topic_title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>
                <div className="p-5">
                  <h2 className="text-base font-semibold leading-snug mb-2 text-stone-900">
                    {article.topic_title}
                  </h2>
                  <p className="text-sm text-stone-400">{article.picks.length} {article.item_noun ?? "breeds"} ranked</p>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <footer className="mt-20 pt-8 border-t border-stone-200 text-sm text-stone-400 text-center space-x-4">
        <Link href="/about" className="hover:text-stone-700">About</Link>
        <Link href="/privacy" className="hover:text-stone-700">Privacy</Link>
        <Link href="/terms" className="hover:text-stone-700">Terms</Link>
        <Link href="/contact" className="hover:text-stone-700">Contact</Link>
        <Link href="/attribution" className="hover:text-stone-700">Image Credits</Link>
      </footer>
    </main>
  );
}
