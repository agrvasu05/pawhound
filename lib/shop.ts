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
  return fs
    .readdirSync(SHOP_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(SHOP_DIR, f), "utf-8")))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function getShopProduct(slug: string): ShopProduct | null {
  const file = path.join(SHOP_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function shopAsset(slug: string, file: string): string {
  return `/shop-assets/${slug}/${file}`;
}
