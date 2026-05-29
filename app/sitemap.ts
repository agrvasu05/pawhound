import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/articles";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://valuefindsdaily.com";
  const articles = getAllArticles();

  // Only the full hub article is indexable; slideshow slides are noindex
  // alternates, so they are intentionally excluded from the sitemap.
  const articleUrls = articles.map((article) => ({
    url: `${baseUrl}/${article.topic_slug}`,
    lastModified: new Date(),
    priority: 0.8,
  }));

  return [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: new Date(), priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), priority: 0.3 },
    ...articleUrls,
  ];
}
