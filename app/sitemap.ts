import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/articles";
import { getAllShopProducts } from "@/lib/shop";
import { nicheOf, nicheSlug } from "@/lib/niches";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://valuefindsdaily.com";
  const articles = getAllArticles();

  // Only the full hub article is indexable; slideshow slides are noindex
  // alternates, so they are intentionally excluded from the sitemap.
  const articleUrls = articles.map((article) => ({
    url: `${baseUrl}/${article.topic_slug}`,
    lastModified: article.updated_at ? new Date(article.updated_at) : new Date(),
    priority: 0.8,
  }));

  // Canonical products only — duplicate listings 301 to these.
  const productUrls = getAllShopProducts().map((p) => ({
    url: `${baseUrl}/shop/${p.slug}`,
    lastModified: new Date(p.created_at),
    priority: 0.7,
  }));

  const nicheUrls = [...new Set(articles.map(nicheOf))].map((n) => ({
    url: `${baseUrl}/guides/${nicheSlug(n)}`,
    lastModified: new Date(),
    priority: 0.9,
  }));

  return [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    ...nicheUrls,
    { url: `${baseUrl}/shop`, lastModified: new Date(), priority: 0.9 },
    { url: `${baseUrl}/freebie`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: new Date(), priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), priority: 0.3 },
    ...productUrls,
    ...articleUrls,
  ];
}
