# Operations runbook — valuefindsdaily.com + Pinterest (@agrvasu05)

Last reset: 10 Oct 2026. Read this before touching the pipeline.

## What runs automatically

| Workflow | When (UTC) | What it does |
|---|---|---|
| Daily content generation | 14:00 daily | Pulls Pinterest trends → 3 new home/cozy articles → 1 Pexels photo per item → commits. No pins are pre-rendered any more. |
| Daily digital products | 15:00 daily | Pulls trends → 2 products/day (planner + wall art). **If a matching product already exists it is reused** and 3 fresh pin variants are queued instead of a duplicate listing. Also requeues variants for every canonical product that has none pending, and freebie pins. |
| Post pins (US peak windows) | 15:20 + 00:20 daily (backups 16:35 / 01:45) | Posts up to 3 content pins (≤1 dog guide) + 2 product pins per window. Pins are rendered at post time and uploaded as base64. One run per window per day (stamp files in `content/.post-stamps`). |
| Weekly Pinterest report | Mon 06:00 | 30-day analytics + per-template kill/scale grades. |
| Ops | manual | requeue-catalog, make-bundle, gumroad-cleanup, consolidate-boards, analytics-report, post-now. |

Expected output: 6–10 fresh pins/day, ~50–70/week, 3 articles/day, ~2 product-or-variant batches/day.

## Why it stopped in July/August 2026 (so it doesn't happen again)

1. **Pinterest refresh token died (~18 Aug).** Every workflow that touches Pinterest exited with `Pinterest auth failed`. The daily jobs had the trends step first, so article/product generation also stopped. Fix: trends is now `continue-on-error`; re-auth is in the checklist below.
2. **Post-pins and the weekly report were disabled manually on 23 Jul.** Nothing was posted after that day. The posting workflow depended on an external cron-job.org trigger; it now runs on GitHub's own schedule.
3. **Token rotation needs `PINTEREST_PAT`** (a GitHub token with `repo` scope) to write the rotated refresh token back into the repo secret. If that PAT expires, the rotated token is lost and Pinterest auth dies on the next run. Check it whenever auth fails.

## LLM + image generation (fixed 10 Oct 2026)

- The original Vertex project (`project-394cd8b9…`, $300 credits) lost billing in
  September and the OpenAI key was revoked, so every generator failed silently
  behind the Pinterest error. Text and images now run on Vertex in
  `single-bonus-450611-h1` (your own billing account): `gemini-2.5-flash` for
  copy, `gemini-2.5-flash-image` for wall-art prints (~$0.04/image). The CI
  service account `vertex-gemini@project-394cd8b9…` has `roles/aiplatform.user`
  there; WIF token exchange still happens in the old project (no billing needed).
- Expected spend: ~3 articles + 2 products/day ≈ $0.20–0.40/day. Watch the
  billing page the first week.

## Re-authenticating Pinterest (whenever `Pinterest auth failed` shows up)

1. Locally, create `.env.local` with `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET` (from https://developers.pinterest.com/apps/, app id 1574960).
2. `node scripts/pinterest-auth.js` → open the printed URL while logged into the ValueFindsDaily Pinterest account → Allow.
3. Copy the new refresh token into GitHub: `gh secret set PINTEREST_REFRESH_TOKEN --repo agrvasu05/pawhound`.
4. Make sure `PINTEREST_PAT` is a valid GitHub token with `repo` scope: `gh secret set PINTEREST_PAT --body "$(gh auth token)" --repo agrvasu05/pawhound`.
5. `gh workflow run "Post pins (US peak windows)"` and check the run log.

## Catalog rules

- `content/shop-canonical.json` maps duplicate product slugs → the page we keep. Duplicate landing pages 301 to the canonical page; only canonical products appear in /shop, the sitemap and cross-links.
- `products/catalog.js` → `findExisting()` is what stops the generator from minting duplicates. If a new product is wrongly matched to an old one, raise the threshold or rename.
- Pricing: singles stay at $4–5 (impulse band, tripwire after the freebie). Revenue comes from the bundles (`node products/make-bundle.js dog-lovers | cozy-home | everything` → $19 / $19 / $29).
- Gumroad store hygiene: `products/gumroad-cleanup.js --apply` unpublishes the duplicate listings (reversible). Run after any catalog change.

## Pinterest account rules (from the Oct 2026 audit of all 197 pins)

- Three pillars only: cozy small-space home, dog lovers' home (breed guides + dog art), seasonal home. Beauty/fashion articles stay on the site for Google but are never pinned.
- Fresh image on every pin; the same URL at most once per 7 days per pipeline.
- Headlines ≤ 8 words, rendered ≥ 60px on a 1000×1500 canvas (feed thumbnails are 236px wide).
- Keyword boards only (12–15). `products/consolidate-boards.js --apply` merges the one-pin boards; `board-hygiene.js` deletes empty off-niche boards daily.
- Seasonal content 45–60 days ahead: Halloween pins stop ~25 Oct; Thanksgiving/Christmas/New-Year-planner content runs from 10 Oct.
- Watch **saves**, not impressions: target 10 saves/week by week 4, 50/week by week 8. Templates under 0.2% save rate get killed by the weekly report.

## Site monetization status

- **Gumroad printables**: live. Bundles are the lever (see above). List the same files on Etsy once the first bundle sells.
- **Amazon Associates** (`valuefindsd05-20`): search links on every guide; dog guides now carry a "first-month essentials" block. Needs 3 qualifying sales within 180 days of the first click or the account is closed — watch the Associates dashboard.
- **AdSense** (`ca-pub-5396532440215148`): the loader is on every page, but `NEXT_PUBLIC_ADSENSE_SLOT` is empty so no ad units render. Create one responsive display unit in AdSense and set the slot id in Netlify env (or enable Auto ads in the AdSense dashboard). Apply to Mediavine Journey at 10k sessions/month.
- **Email**: `/freebie` → `/api/subscribe` → MailerLite (`MAILERLITE_API_KEY`, `MAILERLITE_GROUP_ID` in Netlify env). The freebie pins drip ~1/week.
- **Pinterest Save buttons** are on every guide and product page (`components/PinItButton.tsx`).

## Local dev

```bash
npm install
node scripts/5-post-pins.js --dry-run --only=<slug> --max=1   # renders to ./tmp-pins, posts nothing
node products/gumroad-cleanup.js                               # dry run
node products/consolidate-boards.js                            # dry run (needs .env.local Pinterest creds)
npx next build
```

The repo is large (public/images ≈ 500 MB). Use a sparse clone:
`git clone --filter=blob:none --no-checkout --depth 1 <url> && git sparse-checkout set app components lib scripts products content .github`
