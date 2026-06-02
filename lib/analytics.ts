// Google Analytics 4 Measurement ID (looks like "G-XXXXXXXXXX").
// Public by design — it appears in the page source of every site that uses GA —
// so it is safe in the repo. Override per-environment via NEXT_PUBLIC_GA_ID.
// Until this is set, no analytics script is injected at all.
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";
