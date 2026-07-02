# Pinterest Growth Playbook 2025–2026 — valuefindsdaily.com (home/cozy printables)

Researched July 2026 (~16 web searches: Pinterest official docs, Tailwind's 2025 1M-pin
benchmark study, current practitioner guides). This is the strategy doc the automation
encodes — see "WHERE ENCODED" notes per rule.

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
