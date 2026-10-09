import fs from "fs";
import path from "path";

export type ShopProduct = {
  slug: string;
  type: string; // "wall-art" | "coloring" | "planner" | "bundle"
  title: string;
  description_html: string;
  price: number;
  currency: string;
  gumroad_url: string;
  /** Image filenames living in /public/shop-assets/<slug>/ */
  images: string[];
  cover: string;
  created_at: string;
  /** Real Gumroad rating data — shown only when there are genuine reviews. */
  rating?: number;
  reviews_count?: number;
  /** Set on records that are duplicates of a canonical product (see CANONICAL). */
  canonical?: string;
};

const SHOP_DIR = path.join(process.cwd(), "content", "shop");

/**
 * Product families. The daily generator re-made the same themes for weeks
 * (six dog wall-art styles, eight planner ideas), so the shop ended up with
 * ~80 landing pages for ~15 real products. Every duplicate slug maps to the
 * one page we keep. Old pins still resolve (the duplicate page 301s to the
 * canonical one) and the canonical page collects all the link equity.
 *
 * Keys are the duplicate slugs, values the canonical slug. A slug that is
 * not listed here is its own canonical product.
 */
import canonicalJson from "@/content/shop-canonical.json";

export const CANONICAL: Record<string, string> = canonicalJson as Record<string, string>;

export function canonicalSlug(slug: string): string {
  return CANONICAL[slug] ?? slug;
}

function readAll(): ShopProduct[] {
  if (!fs.existsSync(SHOP_DIR)) return [];
  return fs
    .readdirSync(SHOP_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(SHOP_DIR, f), "utf-8")) as ShopProduct);
}

/** Canonical, paid products only — what the shop index, sitemap and cross-links show. */
export function getAllShopProducts(): ShopProduct[] {
  const all = readAll();
  const existing = new Set(all.map((p) => p.slug));
  return (
    all
      // The $0 "freebie" record exists only so the pin pipeline can render pins
      // for the lead magnet — it isn't a storefront product (its landing page
      // is /freebie, not /shop/freebie).
      .filter((p) => p.price > 0)
      // Drop duplicates whose canonical page exists (if the canonical record is
      // somehow missing, the duplicate stays visible rather than vanishing).
      .filter((p) => !(CANONICAL[p.slug] && existing.has(CANONICAL[p.slug])))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  );
}

/**
 * The one-time offer shown right after the freebie email opt-in (playbook
 * rule 9: freebie → opt-in → $4–6 tripwire). Newest planner or wall-art in the
 * impulse price band — planners first since the freebie audience just opted in
 * for a home checklist.
 */
export function getTripwireProduct(): ShopProduct | null {
  const candidates = getAllShopProducts().filter(
    (p) => (p.type === "planner" || p.type === "wall-art") && p.price > 0 && p.price <= 6
  );
  return candidates.find((p) => p.type === "planner") ?? candidates[0] ?? null;
}

export function getShopProduct(slug: string): ShopProduct | null {
  const file = path.join(SHOP_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function shopAsset(slug: string, file: string): string {
  return `/shop-assets/${slug}/${file}`;
}

const DOG_RE = /\b(dog|dogs|puppy|pup|pet)\b/i;

/**
 * Products to cross-link from an article. Dog guides get the dog wall art
 * (same buyer), home guides get planners + non-dog art, everything else gets
 * the newest products. Bundles first because they carry the highest order value.
 */
export function getProductsForArticle(niche: string | undefined, limit = 3): ShopProduct[] {
  const all = getAllShopProducts();
  const isDogs = !niche || niche === "dogs";
  const pool = isDogs
    ? all.filter((p) => DOG_RE.test(p.title))
    : all.filter((p) => p.type === "planner" || p.type === "bundle" || !DOG_RE.test(p.title));
  const ranked = [...(pool.length ? pool : all)].sort((a, b) => {
    const ba = a.type === "bundle" ? 1 : 0;
    const bb = b.type === "bundle" ? 1 : 0;
    if (ba !== bb) return bb - ba;
    return a.created_at < b.created_at ? 1 : -1;
  });
  return ranked.slice(0, limit);
}
