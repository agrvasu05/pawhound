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
  /** Who should NOT pick this (upgraded guides). */
  skip_if?: string;
  /** Specific product to look for (upgraded home guides). */
  product_name?: string;
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
  /** Answer-first summary shown at the top of upgraded guides. */
  answer?: string;
  /** Plain description of how the list was actually put together. */
  method?: string;
  /** Search title (≤ 60 chars) when it differs from the on-page H1. */
  seo_title?: string;
  /** Set by scripts/upgrade-article.js; only upgraded guides are indexable. */
  upgraded_at?: string;
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

/** Listed on the homepage, hubs and related links: not a duplicate, not off-niche. */
export function isListed(a: Article): boolean {
  return !isRedirected(a.topic_slug) && !NOINDEX_NICHES.has(a.niche || "dogs");
}

/**
 * Offered to Google: listed AND upgraded (scripts/upgrade-article.js). Fewer,
 * better pages — the rest stay live for readers and Pinterest but carry
 * noindex until they are rewritten.
 */
export function isIndexable(a: Article): boolean {
  return isListed(a) && !!a.upgraded_at;
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
