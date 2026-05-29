import { getAllArticles } from "@/lib/articles";

// Prerendered to a static JSON file at build time, regenerated on every deploy.
export const dynamic = "force-static";

export function GET() {
  const data = getAllArticles()
    .filter((a) => a.picks.length >= 3)
    .map((a) => ({
      slug: a.topic_slug,
      title: a.topic_title,
      niche: a.niche || "dogs",
      noun: a.item_noun || "breeds",
      count: a.picks.length,
      intro: a.intro.slice(0, 140),
    }));
  return Response.json(data);
}
