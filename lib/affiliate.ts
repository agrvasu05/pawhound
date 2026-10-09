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

/**
 * Dog-breed guides are the site's best-clicking pages on Pinterest but carried
 * no affiliate links at all. These are the things every new dog owner buys in
 * the first month; each is a tagged Amazon search so it earns from day one.
 */
export const DOG_ESSENTIALS: { label: string; query: string; why: string }[] = [
  { label: "Orthopedic dog bed", query: "orthopedic dog bed washable cover", why: "the first thing a new dog needs is a spot that's theirs" },
  { label: "Slow-feeder bowl", query: "slow feeder dog bowl", why: "stops gulping and bloat, especially in food-motivated breeds" },
  { label: "Front-clip harness", query: "no pull dog harness front clip", why: "gentler than a collar for leash training" },
  { label: "Grooming kit", query: "dog grooming kit brush nail clipper", why: "weekly brushing keeps shedding and mats under control" },
  { label: "Puzzle toy", query: "dog puzzle toy enrichment", why: "ten minutes of nose work tires a dog out more than a walk" },
  { label: "Crate with divider", query: "dog crate with divider", why: "a crate sized to grow with the dog makes house-training faster" },
];

/** Picks the essentials most relevant to a breed guide's title. */
export function dogEssentialsFor(title: string, limit = 4) {
  const t = title.toLowerCase();
  const boost = (e: (typeof DOG_ESSENTIALS)[number]) => {
    let s = 0;
    if (/apartment|small|quiet|calm|senior|cuddl|affection|emotional|anxiety|low.?energy/.test(t) && /bed|puzzle/.test(e.query)) s += 2;
    if (/active|running|hiking|energy|athletic|swim|guard|watch/.test(t) && /harness|puzzle/.test(e.query)) s += 2;
    if (/shed|hypoallergenic|fluff|coat|curly|hair|groom/.test(t) && /groom/.test(e.query)) s += 3;
    if (/first.?time|train|puppy|family|kid/.test(t) && /crate|harness|slow/.test(e.query)) s += 2;
    return s;
  };
  return [...DOG_ESSENTIALS].sort((a, b) => boost(b) - boost(a)).slice(0, limit);
}
