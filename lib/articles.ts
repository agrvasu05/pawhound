import fs from "fs";
import path from "path";

export type Pick = {
  rank: number;
  breed: string;
  description: string;
  best_for: string;
  quirky_fact: string;
  image_query?: string;
  /** Shopping search phrase for affiliate matching (trend articles). */
  shop_query?: string;
  /** Affiliate deep link, filled in by the affiliate module once Awin is connected. */
  affiliate_url?: string;
};

export type Faq = {
  question: string;
  answer: string;
};

export type Article = {
  topic_slug: string;
  topic_title: string;
  intro: string;
  picks: Pick[];
  pin_headlines: string[];
  niche?: string;
  /** Plural noun for the list items, e.g. "breeds" (dogs) or "ideas" (home). */
  item_noun?: string;
  /** Original Q&A appended to each article; also powers FAQPage structured data. */
  faqs?: Faq[];
  /** ISO date (YYYY-MM-DD) the article was last edited. Drives the "Last updated" line. */
  updated_at?: string;
  /** Byline shown on the article. Defaults to the editorial team when unset. */
  author?: string;
};

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");

export function getAllArticles(): Article[] {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) =>
      JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, f), "utf-8"))
    );
}

export function getArticle(slug: string): Article | null {
  const file = path.join(ARTICLES_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function breedToSlug(breed: string): string {
  return breed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getBreedImage(breed: string, index = 1): string {
  return `/images/breeds/${breedToSlug(breed)}/${index}.jpg`;
}

// ── SEO helpers ───────────────────────────────────────────────────────────────
import canonicalArticles from "@/content/article-canonical.json";

/** Duplicate article slug → the article we keep (301 via public/_redirects). */
export const ARTICLE_CANONICAL: Record<string, string> = canonicalArticles as Record<string, string>;

/** Off-niche archives: kept live for old pins, but noindex and out of the sitemap. */
export const NOINDEX_NICHES = new Set(["beauty", "fashion"]);

export function isRedirected(slug: string): boolean {
  return slug in ARTICLE_CANONICAL;
}

export function isIndexable(a: Article): boolean {
  return !isRedirected(a.topic_slug) && !NOINDEX_NICHES.has(a.niche || "dogs");
}

/** Articles that get their own page (duplicates are 301s, not pages). */
export function getPublishedArticles(): Article[] {
  return getAllArticles().filter((a) => !isRedirected(a.topic_slug));
}

/** Search-snippet description: whole sentences, ≤ max chars, never cut mid-word. */
export function metaDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out = (out + s).trim() + " ";
  }
  out = out.trim();
  if (out.length >= 70) return out;
  const cut = clean.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\-–—]$/, "") + "…";
}
