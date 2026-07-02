import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getAllShopProducts, getShopProduct, shopAsset } from "@/lib/shop";
import AdSlot from "@/components/AdSlot";

export async function generateStaticParams() {
  return getAllShopProducts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = getShopProduct(slug);
  if (!p) return {};
  const desc = p.description_html.replace(/<[^>]+>/g, " ").slice(0, 160);
  const img = shopAsset(slug, p.cover);
  return {
    title: p.title,
    description: desc,
    alternates: { canonical: `/shop/${slug}` },
    // Open Graph "product" tags power Pinterest Product Rich Pins.
    openGraph: { title: p.title, description: desc, images: [img], type: "website" },
    other: {
      "og:type": "product",
      "product:price:amount": String(p.price),
      "product:price:currency": (p.currency || "usd").toUpperCase(),
      "og:price:amount": String(p.price),
      "og:price:currency": (p.currency || "usd").toUpperCase(),
    },
  };
}

export default async function ShopProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getShopProduct(slug);
  if (!p) notFound();
  // The $0 freebie record exists only for the pin pipeline — its real landing
  // page is /freebie (email opt-in funnel), so send any direct visits there.
  if (!p.price) redirect("/freebie");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    image: p.images.map((f) => shopAsset(slug, f)),
    description: p.description_html.replace(/<[^>]+>/g, " ").slice(0, 300),
    brand: { "@type": "Brand", name: "Value Finds Daily" },
    offers: {
      "@type": "Offer",
      price: p.price,
      priceCurrency: (p.currency || "usd").toUpperCase(),
      availability: "https://schema.org/InStock",
      url: p.gumroad_url,
    },
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link
        href="/shop"
        className="text-sm text-stone-500 hover:text-stone-900 mb-6 inline-block"
      >
        ← Shop
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200">
            <Image
              src={shopAsset(slug, p.cover)}
              alt={p.title}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 500px"
            />
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {p.images.slice(0, 4).map((f) => (
                <div
                  key={f}
                  className="relative aspect-square overflow-hidden rounded-lg bg-stone-100 ring-1 ring-stone-200"
                >
                  <Image
                    src={shopAsset(slug, f)}
                    alt={p.title}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1
            className="text-3xl md:text-4xl font-bold leading-tight"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            {p.title}
          </h1>
          <p className="mt-3 text-2xl font-bold text-emerald-700">
            ${p.price}
            <span className="ml-2 text-sm font-medium text-stone-500">
              · instant digital download
            </span>
          </p>
          <a
            href={p.gumroad_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block w-full rounded-full bg-emerald-700 px-6 py-3.5 text-center text-lg font-semibold text-white transition hover:bg-emerald-800"
          >
            Get it on Gumroad →
          </a>

          {/* Honest trust signals (all true for a digital download) */}
          <ul className="mt-4 grid grid-cols-2 gap-y-2 text-sm text-stone-600">
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Instant download</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Secure Gumroad checkout</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> High-resolution files</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Lifetime access</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Print at home or shop</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Personal-use license</li>
          </ul>

          {/* Real ratings appear automatically once buyers leave them on Gumroad */}
          {typeof p.reviews_count === "number" && p.reviews_count > 0 && (
            <p className="mt-3 text-sm font-medium text-stone-700">
              ★ {p.rating?.toFixed(1)} ({p.reviews_count} review
              {p.reviews_count === 1 ? "" : "s"} on Gumroad)
            </p>
          )}

          <div
            className="prose prose-stone mt-6 max-w-none"
            dangerouslySetInnerHTML={{ __html: p.description_html }}
          />
        </div>
      </div>

      <AdSlot className="my-10" />
    </main>
  );
}
