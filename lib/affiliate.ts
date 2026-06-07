// Affiliate config. The ID is public by design (it appears in page source),
// so it's safe in the repo — same as the AdSense client ID.
//
// (Skimlinks was removed after rejection — every shop link points straight to
// Amazon below, so the catch-all script was just dead weight. Reapply to
// Skimlinks once the site has real traffic, then re-add its script.)

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
