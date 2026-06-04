// Skimlinks auto-affiliation. Public by design (the script tag is in every page
// source), so safe in the repo. Set NEXT_PUBLIC_SKIMLINKS_ID to your Skimlinks
// publisher/site ID to switch it on; until then nothing is injected.
//
// Once set, Skimlinks' script automatically converts outbound links to its
// 48,500+ supported merchants into affiliate links (no per-brand approval).
export const SKIMLINKS_ID = process.env.NEXT_PUBLIC_SKIMLINKS_ID || "";
