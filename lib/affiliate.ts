// Affiliate config. Both IDs are public by design (they appear in page source),
// so they're safe in the repo — same as the AdSense client ID.

// Skimlinks auto-affiliation script ID (converts supported-merchant links once
// Skimlinks finishes approval). Set NEXT_PUBLIC_SKIMLINKS_ID to override.
export const SKIMLINKS_ID =
  process.env.NEXT_PUBLIC_SKIMLINKS_ID || "304164X1792325";

// Amazon Associates tag — LIVE immediately (no approval wait). Tagged links earn
// from day one, which also drives the 3 sales needed to unlock the Amazon API.
export const AMAZON_TAG =
  process.env.NEXT_PUBLIC_AMAZON_TAG || "valuefindsd05-20";

// "Shop this" link for an article item. Uses an Amazon search (with your tag) so
// it earns now; Amazon isn't in Skimlinks, so the two never conflict. Once the
// product APIs are live we upgrade these to exact products with real images.
export function shopHref(_niche: string | undefined, query: string): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${AMAZON_TAG}`;
}
