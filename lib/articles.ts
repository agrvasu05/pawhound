import fs from "fs";
import path from "path";

export type Pick = {
  rank: number;
  breed: string;
  description: string;
  best_for: string;
  quirky_fact: string;
  image_query?: string;
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
