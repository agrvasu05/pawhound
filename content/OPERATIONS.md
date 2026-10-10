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

## Hosting: Cloudflare Pages (moved off Netlify, 10 Oct 2026)

Netlify's free build credits were half gone by mid-month. The site is now a
**static export** (`output: "export"` in next.config.ts) built in GitHub Actions
and uploaded to **Cloudflare Pages** by `.github/workflows/deploy.yml`
(wrangler direct upload: no Cloudflare build minutes, unlimited bandwidth,
free). The email opt-in endpoint moved to a Pages Function
(`functions/api/subscribe.js`, same `/api/subscribe` path). Duplicate shop
URLs redirect via `public/_redirects` (generated from shop-canonical.json).
Netlify is set to skip all builds (`ignore = "exit 0"` in netlify.toml) and
keeps serving its last deploy only until DNS moves.

One-time cutover (about 10 minutes):
1. Cloudflare → My Profile → API Tokens → Create Token → Create Custom Token →
   Permissions: Account › Cloudflare Pages › Edit → copy the token.
2. `bash scripts/cf-setup.sh` → paste the token. It finds the account id, sets
   both GitHub secrets and starts the first deploy.
3. When the deploy is green: Workers & Pages → valuefindsdaily → Custom
   domains → add `valuefindsdaily.com` and `www.valuefindsdaily.com`.
4. Settings → Variables and Secrets → `MAILERLITE_API_KEY`,
   `MAILERLITE_GROUP_ID` → re-run the deploy workflow.
5. Delete the Netlify site. Until then it keeps serving (and metering
   bandwidth/function calls), so do this the same day.

Deploys then happen once a day from the daily products workflow, plus on any
push that touches site code.

File budget: Pages allows 20,000 files per deploy. After pruning (prefetch
segment files, attribution.json) the site is ~9,500 files and grows ~40/day
(one photo per guide item + the page). The deploy fails loudly at 19,000;
when that happens, move `public/images` to Cloudflare R2 (free 10 GB) and
point `getBreedImage()` at the R2 public URL.

Pinterest board consolidation: the API refuses to move pins between boards on
this app's access tier (401 on PATCH /pins), so `consolidate-boards.js` can
only create the keyword boards and delete empty ones. Moving the ~60 one-pin
boards' pins is a 10-minute job in the Pinterest app: open a board → select
all → Move → pick the keyword board. New pins already go to keyword boards.

## Running it for free (Oct 2026 settings)

| Service | Plan | Usage now | Keep it free by |
|---|---|---|---|
| Cloudflare Pages (hosting) | Free: unlimited bandwidth, 500 CI builds/month (unused: we upload) | 1 deploy/day from Actions | Nothing to do. Pins only post for pages that are already live. |
| Cloudflare (DNS/proxy) | Free | – | Nothing to do. |
| GitHub Actions | Free: 2,000 min/month (private repo) | ~25 min/day | Within quota. If it gets tight, make the repo public (unlimited minutes). |
| Vertex AI (Gemini text + images) | Pay-as-you-go | ≈ $0.10–0.30/day | Add a free AI Studio key: `gh secret set GEMINI_API_KEY --repo agrvasu05/pawhound` (https://aistudio.google.com/apikey). The code prefers it over Vertex, so spend drops to $0. New products only on Mon/Thu already cut image calls by ~70%. |
| Pexels, Gumroad, MailerLite (≤500 subs), Pinterest API | Free | – | Gumroad takes 10% + fees per sale only. |

## AdSense (rejected once; what to fix before re-applying)

The AdSense login in Chrome is on vasuagrawalbackup@gmail.com, which has no
AdSense account; the publisher id in the site (ca-pub-5396532440215148) belongs
to one of the other Google accounts. Check that account's AdSense → Sites for
the stated reason. The usual reasons for a site like this, and what is now done:

- "Low value content / scaled content": the homepage listed all 277 guides on
  one 1.5 MB page. It now shows 9 per section with real category pages
  (`/guides/<niche>`), breadcrumbs, Article + BreadcrumbList schema, and guides
  cross-link to products. Still worth doing by hand: rewrite the intro of the
  10 most-visited guides with a specific, first-person angle.
- "Site navigation / under construction": fixed (category pages, shop
  consolidated, no empty pages).
- Policy pages: Privacy mentions cookies + AdSense; About lists the team and
  editorial policy; Contact exists. Add a line to Privacy about Amazon
  Associates ("As an Amazon Associate we earn from qualifying purchases").
- Re-apply after 2–4 weeks of Pinterest traffic (AdSense wants a site that
  already has visitors). Keep the beauty/fashion archive off the homepage
  rotation (it sinks to the bottom automatically).

## SEO baseline (10 Oct 2026)

Done: canonical tags, sitemap with guides + products + categories, robots.txt,
Open Graph, FAQ + ItemList + Article + Breadcrumb schema, descriptive alt
text, `lastmod` from real dates, internal links guide→product and guide→guide,
category hubs, homepage trimmed to 9 per section, responsive image sizes.
Next (manual): submit the sitemap in Google Search Console for the owning
account, request indexing of the category pages, and watch "Pages" for
"Crawled, currently not indexed" (the signal that content is too thin).

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
