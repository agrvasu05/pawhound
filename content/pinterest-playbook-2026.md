# Pinterest Growth Playbook 2025–2026 — valuefindsdaily.com (home/cozy printables)

Researched July 2026 (~16 web searches: Pinterest official docs, Tailwind's 2025 1M-pin
benchmark study, current practitioner guides). This is the strategy doc the automation
encodes — see "WHERE ENCODED" notes per rule.

> **Oct 2026 update:** the operational truth now lives in `content/OPERATIONS.md`
> (why the pipeline stopped, how to re-auth, cadence, catalog rules). Rule 4 is
> now 6–10 fresh pins/day across two peak windows; rule 1's text sizes are
> enforced by `scripts/pin-renderer.js` (≥ 56px headlines, ≤ 3 lines).

## 30 Oct 2026 reset: one cluster, dogs

Evidence: impressions were flat for four months (1,336 in July, 1,407 on 12 Oct, 1,328 on 26 Oct) despite 5–7 pins a day. The business hub showed 1.12k impressions in 30 days, 866 of them from ONE pin (a Michael Jackson Halloween costume guide); the other ~340 pins earned ~10 impressions each, 0 saves, 0 followers. The domain is claimed and there is no account warning, so this is identity, not a penalty: the account mixed dog breeds, cozy decor, kids' crafts, back-to-school, bedazzling and finance printables, and opened a new board for almost every pin (~180 boards).

Decision: the account is a **dog account** (dog breeds + dog-friendly homes + dog printables). Every indexable page on the site is a dog guide, the Amazon gear is dog gear and most shop products are dog products.

Encoded:
- `scripts/5-post-pins.js`: only dog guides and pet-friendly home guides are pinned (`isOnCluster`); no dog cap; every pin goes to one of six existing dog boards; boards are looked up across all pages before any create.
- `products/lib.js`: shop pins are dog products only, on three existing boards (Dog Wall Art Printables, Dog Lover Printable Bundles, Gifts for Dog Lovers); the shop poster never creates a board.
- Volume: 2 guide pins per window + up to 2 shop pins a day (~6/day) while the account rebuilds.

Not done (needs the owner): hiding the ~170 off-cluster boards (set to secret, reversible), and the profile name, bio and category.

Exit condition: if impressions per pin are still ~10 after four weeks of a clean dog-only account (late Nov 2026), the account is probably held back and starting a fresh dog-only account is the owner's call.

## Oct 2026 corrections (audit of 12 Oct 2026)

Account, last 30 days: 1,407 impressions, 0 saves, 9 outbound clicks. What was wrong and what changed:

1. **Off-season pins.** About 60 home guides are Fourth of July, Father's Day, back-to-school, dorm and Christmas-in-July topics, and back-to-school pins went out on 11 Oct. Fix: `scripts/season.js` gates both posters at post time (windows open 45–60 days early and close at the event; evergreen topics always pass).
2. **Every first pin was a video.** Rule 3 says video ≤ 20%, but the poster put `video-1.mp4` first for every guide and every product. 2026 benchmarks: video gets more impressions, static gets ~3× the outbound clicks per impression. Fix: guides go static first with at most one video per run (~20%); shop pins are static only.
3. **Wrong products in the shop queue.** Clipart and spreadsheets (0 outbound in 90 days), beauty trackers (off-niche), a graduation pack in October, and a Snoopy clipart pack (trademarked character, takedown risk). Fix: `pinSkipReason()` in `products/lib.js` skips them at post time.
4. **Titles started with "Top 15".** Pinterest weights the first words. Fix: `buildTitle()` drops a leading "Top N"/number; UPGRADE_GUIDE.md tells the writer to lead headlines with the keyword.
5. **Pins stopped for 1.5 days** because GitHub ran the cron 4–6 h late. Fix: hourly trigger, wide windows (see OPERATIONS.md).
6. **Product daily cap used the UTC date**, which lumped the evening window in with midday. Fix: US Eastern date.

Not changed yet, on purpose: the 1-dog-guide-per-run cap (site SEO depends on dog guides; data too thin), the profile name/bio (an account setting), and AI art for home-decor pins (users can filter AI content in that category). Saves will only move with better creative; the template grades need 300+ impressions per template, about 2–3 weeks of posting.

## 1. Pinterest SEO — how pins rank now

Pinterest scores pins in stages: (1) domain quality (click/save history of the linked
domain), (2) pin quality (saves, outbound clicks, close-ups), (3) pinner quality
(account consistency), (4) topic relevance (title + description + alt text + board
name + OCR of text on the image). 2025 updates made ranking real-time and
sequence-aware; sustained engagement outranks spikes.

- **Title:** ≤100 chars indexed; primary keyword in the FIRST 3–5 words (algorithm
  weights the start; only ~40 chars show in feed).
- **Description:** 100–500 chars; primary keyword within the first 50 chars; 2–4
  semantic keywords woven into natural sentences. No keyword lists.
- **Alt text = highest-ROI hidden field:** +25% impressions, +123% outbound clicks,
  +56% profile visits (Tailwind 2025). Literal visual description containing the keyword.
- **Board name is a ranking field:** exact searchable phrase, keyword first.
- **Text on the image is OCR-indexed** — put the keyword phrase in the overlay.
- **Hashtags are dead.** 0 hashtags; spend the characters on keywords. >5 = spam signal.
- Keep keywords consistent across title/description/alt/board.

WHERE ENCODED: lib.js `generateVariantSpecs` (title/description/alt_text rules),
scripts/5-post-pins.js `buildDescription` (hashtags removed) + `postPin` (alt_text).

## 2. Topical authority

Boards act like subdomains — Pinterest categorizes the whole account from board
structure. One tight cluster (home decor / printables / planning) gets
defined-audience distribution; mixed niches don't.

- 10–20 keyword-named boards in ONE topical cluster; board description = topic +
  sub-topics + audience, 1–2 sentences.
- **Recovering a mixed account: set off-niche boards to SECRET (never delete — loses
  followers), a few at a time over 2–4 weeks.** Mass changes read as spam.
- Group boards are dead for reach.

WHERE ENCODED: products/board-hygiene.js (secrets up to 3 off-niche boards per weekly
run); trends-engine.js + generators emit only home/cozy keyword boards.

## 3. Creative that earns SAVES (fix for the 0.00% save rate)

Benchmark save rate: 0.2–0.5% (1–2% for top decor/DIY). Saves come from pins people
want to reference later: styled scenes, idea lists, information-dense images.

- **2:3 vertical, 1000×1500, static images** (89% of viral pins are static; Idea Pins
  discontinued; keep video ≤20% if used).
- **Wall art: photorealistic styled-ROOM mockups, minimal/no text** — must read as
  decor inspiration, not an ad.
- **Planners: filled-in spread close-up or desk scene + short benefit overlay.**
- **Multi-image "N ideas" collage pins are the highest-save format** for idea content.
- Text overlay: ≤10 words, keyword phrase included (OCR), large/high-contrast,
  keep the bottom 15% clear (Pinterest UI overlaps it).
- 3–5 visually distinct designs per product/URL.

WHERE ENCODED: scripts/4-generate-pins.js (collage templates), lib.js `renderShopPin`
(wall-art = minimal-text room-inspo mode; CTA moved out of bottom 15%).

## 4. Cadence

- Small account: **3–5 fresh pins/day, every day** (never bulk dumps; 20+/day = spam).
- **≥70% fresh pins** — a fresh pin = never-before-seen IMAGE. Reuse URLs freely,
  never reuse images (new image on a repeat URL keeps ~64% distribution; same image
  with tweaked text drops to 11–35%).
- ≥2 days before re-pinning the same URL; 3–7 days between repins of own pins.
- Best US slots: Tue–Thu 10am–1pm ET and 8–11pm ET; Sat 8–11am; Sun 6–9pm.
- **Seasonal content 45–60 days before the peak** (Christmas printables → mid-October).

WHERE ENCODED: post-pins.yml guard (evening + midday windows), existing 7-day URL
spacing in 5-post-pins.js/lib.js postQueue, trends-engine.js seasonal trend type.

## 5. Conversion ($4–6 printables)

- Pinners arrive in research mode: idea/list landing pages that then link to Gumroad
  convert cold traffic better than raw checkout links. Run both; measure.
- Message match: same image + headline on the landing page as the pin; instant-download
  copy; mobile-first.
- Gumroad OK (MoR since 2025) but ~21% effective fee on $5; Discover-sourced sales 30%.
  Add Etsy later for native search traffic; own checkout only past ~$1k/mo.
- **Highest-leverage: freebie → email opt-in → $4–6 tripwire → bundle upsell.**
  Email drives 42% of Gumroad sales. "Free printable" pins are save/click magnets.
- Bundles raise AOV: single $4–6 → set of 3–6 for $12–15.

## 6. Trends, programmatically

- Official API: `GET /v5/trends/keywords/US/top/{growing|monthly|yearly|seasonal}`,
  filterable by interests; returns pct_growth_wow/mom/yoy + 52-week series; 50/call;
  Trial tier = 1,000 req/day (ample).
- Supplements: trends.pinterest.com, Apify actors, search-autocomplete scraping.
- Close the loop: weekly per-pin analytics pull → reweight keywords/templates
  (kill <0.2% save rate, scale >0.5%).

WHERE ENCODED: trends-engine.js (growing + monthly + seasonal), analytics-report.js +
niche-performance.js (weekly feedback loop).

## 7. 2025–2026 policy changes

- **Gen-AI labeling + user-level demotion in art/home-decor/beauty/fashion** — users
  can filter out AI-look content. Mitigation: real-photo mockup scenes, human design
  polish, avoid AI-slop tells. Never strip metadata deceptively.
- Spam crackdown: duplicate images, same-URL same-day mass pinning, 20+/day demoted.
- Links: no shorteners/redirects — clean, transparent final URLs only. UTMs fine.
- Idea Pins retired; unified pin format.
- Early saves snowball (real-time feedback) — seed new pins where possible.

## TOP 10 RULES (ranked by expected impact)

1. Creative for saves: room mockups (wall art, no text), filled spreads (planners),
   weekly "N ideas" collages. 2:3, 1000×1500, static.
2. Never reuse an image; 3–5 distinct designs per product; ≥70% fresh.
3. Title ≤100 chars, keyword in first 3–5 words; description 150–450 chars, keyword
   in first 50; ZERO hashtags.
4. Alt text always: literal visual description + keyword.
5. Niche lockdown: secret off-niche boards (staggered), 10–20 keyword boards, one cluster.
6. 3–5 fresh pins/day spread across peak slots; ≥2-day URL gap; hard cap 10/day.
7. Daily trends pull (growing + seasonal), route rising keywords into products + copy;
   seasonal 45–60 days early.
8. Anti-AI-slop: photoreal mockup composites, no AI-art tells in decor/art pins.
9. Funnel: pin → message-matched landing page → free printable opt-in → $4–6 tripwire
   → bundle upsell. Test direct-Gumroad vs content-site 50/50.
10. Weekly analytics feedback: kill templates/keywords <0.2% save rate, scale >0.5%.

Key sources: seosherpa.com/pinterest-seo · tailwindapp.com 2025 benchmark study +
fresh-pin study · sproutsocial.com/insights/pinterest-algorithm · 84pins.com SEO guide ·
kamaldeen.com board strategy · simplepinmedia.com/how-to-rebrand-on-pinterest ·
create.pinterest.com fundamentals + new-pin-format · smarterqueue.com best practices ·
developers.pinterest.com trends API + access tiers · help.pinterest.com gen-ai-labels ·
policy.pinterest.com commercial guidelines · gumroad.com fees · marylumley.com ·
startamomblog.com printables funnel
