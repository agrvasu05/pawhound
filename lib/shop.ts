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
};

const SHOP_DIR = path.join(process.cwd(), "content", "shop");

export function getAllShopProducts(): ShopProduct[] {
  if (!fs.existsSync(SHOP_DIR)) return [];
  return (
    fs
      .readdirSync(SHOP_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(path.join(SHOP_DIR, f), "utf-8")))
      // The $0 "freebie" record exists only so the pin pipeline can render pins
      // for the lead magnet — it isn't a storefront product (its landing page
      // is /freebie, not /shop/freebie).
      .filter((p) => p.price > 0)
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
