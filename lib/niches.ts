import type { Article } from "./articles";

/**
 * Display labels, ordering and URL slugs for each content niche. Shared by the
 * homepage, the category pages (/guides/<slug>) and the breadcrumbs so the
 * site has one navigation model: Home → Category → Guide.
 */
export type NicheMeta = { label: string; blurb: string; order: number; description: string };

export const NICHE_META: Record<string, NicheMeta> = {
  "home decor": {
    label: "Home Decor & Styling",
    blurb: "Wall art, room ideas, and decor inspiration.",
    order: 0,
    description:
      "Home decor and styling guides: room ideas, wall art, seasonal decor and styling tips ranked for real homes and real budgets.",
  },
  home: {
    label: "Home & Cozy Living",
    blurb: "Small-space wins, cozy corners, and budget makeovers.",
    order: 1,
    description:
      "Cozy living and small-space guides: storage, organization, reading nooks, rental-friendly upgrades and budget makeovers.",
  },
  "aesthetic art & printables": {
    label: "Printables & Aesthetic Art",
    blurb: "Instant-download art and printables.",
    order: 2,
    description: "Printable wall art and planner ideas you can download and print at home.",
  },
  wellness: {
    label: "Wellness & Self-Care",
    blurb: "Routines, planners, and calm-living ideas.",
    order: 3,
    description: "Routines, planners and calm-living ideas for a slower home life.",
  },
  "gifts & occasions": {
    label: "Gifts & Occasions",
    blurb: "Graduation, parties, and giftable finds.",
    order: 4,
    description: "Gift guides and occasion ideas, from graduation to Father's Day.",
  },
  dogs: {
    label: "Dog Breed Guides",
    blurb: "Find the breed that actually fits your life.",
    order: 5,
    description:
      "Hand-ranked dog breed guides for every kind of home: apartment dogs, family dogs, calm breeds, low-shedding breeds and more, with what each one needs in the first month.",
  },
  beauty: {
    label: "Beauty & Nails",
    blurb: "Trending nail, hair, and beauty looks.",
    order: 80,
    description: "Seasonal nail designs, hairstyles and beauty looks, ranked.",
  },
  fashion: {
    label: "Fashion & Outfit Ideas",
    blurb: "Trending looks, capsule wardrobes, and styling guides.",
    order: 85,
    description: "Outfit ideas, capsule wardrobes and occasion dressing guides.",
  },
};

export function nicheOf(a: Article): string {
  return a.niche || "dogs";
}

export function nicheSlug(niche: string): string {
  return niche.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function nicheFromSlug(slug: string, niches: string[]): string | null {
  return niches.find((n) => nicheSlug(n) === slug) ?? null;
}

export function nicheMeta(niche: string): NicheMeta {
  return (
    NICHE_META[niche] ?? {
      label: niche.replace(/\b\w/g, (c) => c.toUpperCase()),
      blurb: "",
      order: 50,
      description: `${niche} guides from Value Finds Daily.`,
    }
  );
}

/** Newest first; articles without a date sink to the bottom. */
export function sortNewest(list: Article[]): Article[] {
  return [...list].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
}
