# Niche performance — what's working on Pinterest (90-day)

Generated from `products/niche-performance.js` (per-pin analytics joined to niche).
Account is early-stage: ~1,600 impressions / ~30 outbound clicks across 90 days, so
treat shop-format numbers (1–4 pins each) as directional, content numbers as firmer.

## By niche (outbound clicks = traffic to shop)

| Niche | pins | impr | outbound | imp/pin | **out/pin** |
|---|---|---|---|---|---|
| home/cozy (content) | 33 | 429 | 11 | 13.0 | **0.33** |
| dog breeds (content) | 181 | 1844 | 19 | 10.2 | 0.10 |
| shop: wall-art | 3 | 96 | 2 | 32.0 | **0.67** |
| shop: planner | 4 | 70 | 1 | 17.5 | 0.25 |
| shop: coloring | 1 | 32 | 0 | 32.0 | 0 |
| shop: clipart | 3 | 22 | 0 | 7.3 | **0** |
| shop: spreadsheet | 1 | 0 | 0 | 0 | **0 (dead)** |

## Findings
- **Home/cozy content converts ~3.3× better per pin than dog breeds** (0.33 vs 0.10 outbound/pin), despite dogs having 5× more pins. The dog→home/beauty pivot is correct — keep retiring dogs, lean into home/cozy.
- **Best shop formats: wall-art (0.67 out/pin) + planner (0.25).** **clipart = 0 outbound, spreadsheet = 0 impressions (dead).**
- **Saves are ~0 everywhere** (account-level save rate 0.07%) → creative hooks are generic; a separate creative problem, not a niche problem.
- **Beauty is unproven** — the brief pool is 17 beauty / 2 home, but beauty pins are too new to have data. Don't scale beauty hard until it shows outbound clicks; home decor is the proven content niche.

## Actions taken (double down on winners, leave the rest)
- `generate-daily.js` rotation → **planner + wall-art** (the two converting formats); **dropped clipart + spreadsheet** from the daily rotation (still available via `--types=`). Wall-art re-enabled, now themed to the home-decor niche (not the retired dog portraits).

## Recommended next (needs your call — thin data / strategy)
- Rebalance `trends-engine.js` to source **more home-decor briefs** (currently beauty-dominated) so the proven niche isn't starved.
- Fix the low save-rate with stronger creative hooks/scene mockups (separate from niche).
