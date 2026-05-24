import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://valuefindsdaily.com";
  const articles = getAllArticles();

  const articleUrls = articles.flatMap((article) => [
    {
      url: `${baseUrl}/${article.topic_slug}`,
      lastModified: new Date(),
      priority: 0.8,
    },
    ...article.picks.map((pick) => ({
      url: `${baseUrl}/${article.topic_slug}/${pick.rank}`,
      lastModified: new Date(),
      priority: 0.6,
    })),
  ]);

  return [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: new Date(), priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), priority: 0.3 },
    ...articleUrls,
  ];
}
