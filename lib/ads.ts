// Google AdSense identifiers.
// The publisher ID is public by design — it appears in the page source of every
// AdSense site — so it is safe to keep in the repo. Both values can still be
// overridden per-environment via NEXT_PUBLIC_* env vars (e.g. in Netlify).
export const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-5396532440215148";

// The numeric data-ad-slot from the display ad unit you create in AdSense.
// Until this is set, ad units render nothing (the loader/verification script
// still loads, so site verification and approval are unaffected).
export const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT || "";
