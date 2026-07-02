import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getAllShopProducts, shopAsset } from "@/lib/shop";

export const metadata: Metadata = {
  title: "Shop — Printable Wall Art & Planners",
  description:
    "Instant-download printable wall art, planners, and trackers for a cozy, organized home.",
  alternates: { canonical: "/shop" },
};

export default function ShopIndex() {
  const products = getAllShopProducts();
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1
        className="text-4xl md:text-5xl font-bold leading-tight"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        The Shop
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-stone-600">
        Instant-download printables for a cozy, organized home — wall art,
        planners, and trackers. Download, print, enjoy.
      </p>

      {products.length === 0 ? (
        <p className="mt-10 text-stone-500">New products coming soon.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.slug}
              href={`/shop/${p.slug}`}
              className="group block overflow-hidden rounded-2xl ring-1 ring-stone-200 transition hover:shadow-lg"
            >
              <div className="relative aspect-[4/5] bg-stone-100">
                <Image
                  src={shopAsset(p.slug, p.cover)}
                  alt={p.title}
                  fill
                  className="object-cover transition group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, 250px"
                />
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-medium text-stone-800">
                  {p.title}
                </p>
                <p className="mt-1 text-sm font-bold text-emerald-700">
                  ${p.price}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
