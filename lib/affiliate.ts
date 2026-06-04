// Skimlinks auto-affiliation. The publisher ID is public by design (it's in the
// page source via the script tag), so it's safe in the repo — same as the AdSense
// client ID. Override per-environment with NEXT_PUBLIC_SKIMLINKS_ID if needed.
//
// Once Skimlinks finishes approval, its script automatically converts the
// outbound merchant links below into affiliate links (no per-brand approval).
export const SKIMLINKS_ID =
  process.env.NEXT_PUBLIC_SKIMLINKS_ID || "304164X1792325";

// Build a relevant retailer search URL for an article item. Skimlinks' script
// auto-affiliates these (all major US merchants are in its 48,500-merchant network).
export function shopHref(niche: string | undefined, query: string): string {
  const q = encodeURIComponent(query);
  switch ((niche || "").toLowerCase()) {
    case "fashion":
      return `https://www.nordstrom.com/sr?keyword=${q}`;
    case "beauty":
      return `https://www.sephora.com/search?keyword=${q}`;
    case "home decor":
      return `https://www.wayfair.com/keyword.php?keyword=${q}`;
    default:
      return `https://www.target.com/s?searchTerm=${q}`;
  }
}
