# How to write a NEW trend guide (written by Claude)

Why: in Aug–Oct 2026 the only pins that earned reach were specific, in-season
home and occasion searches taken from Pinterest Trends (bedazzled light switch
covers, a Halloween costume guide, printable mom birthday cards, cubicle decor).
The trend pipeline stopped on 17 Aug when the paid AI ran out; Claude now
writes these guides. Account themes: holidays & occasions, home & DIY decor,
dogs. New trend guides are holiday or home topics.

## Steps

1. `python3 scripts/trend-pick.py 10` — in-season, on-theme keywords not yet
   covered, holidays first. Pick ONE with clear buying intent (people will buy
   supplies or products for it). Skip anything about a named person, character
   or brand; use the generic search instead ("80s pop star costume", not a name).
   If the list is empty or weak, use the fallback list below.
2. Write a spec JSON (to /tmp/spec-<slug>.json):
   - `topic_slug`: the keyword, lowercase-hyphenated (e.g. `christmas-mantel-decor`).
   - `topic_title`: keyword first, a number, a specific promise, ≤ 70 chars
     ("Christmas Mantel Decor: 10 Ideas for Small Living Rooms").
   - `keyword`: the exact trend keyword. `item_noun`: what the picks are ("mantel decor ideas").
   - `picks`: 8–10 items, rank 1..N. `breed` = the item's name (a specific idea or
     product, e.g. "Brass Candlestick Trio"). `image_query` = the literal object to
     photograph, 2–5 words, no adjectives about mood ("brass candlesticks mantel").
     Photos come from Pexels by this query, so make it something Pexels has.
   - `pin_headlines`: 8 headlines, 5–9 words, keyword in the first three words,
     never starting with "Top" or a number; any number must equal the pick count.
3. `python3 scripts/new-guide.py /tmp/spec-<slug>.json` — creates the base file.
4. Write the upgrade JSON exactly as content/UPGRADE_GUIDE.md describes (seo_title,
   answer, intro, method, 4–6 faqs, and per pick: description, best_for, skip_if,
   quirky_fact, product_name). `product_name` is a specific, widely sold product to
   search on Amazon. Method must be literally true (e.g. "Picked from Pinterest's
   trending searches for X, then chosen for cost, effort and how long each lasts").
   Never claim you tried or tested anything.
5. `python3 scripts/apply-upgrade.py <slug> /tmp/upgrade-<slug>.json`.
6. Photos are downloaded automatically by the "Fetch photos for new guides"
   GitHub job after you push; the poster pins the guide once its photos are live.

## Fallback topics (use when trend-pick finds nothing in season)

Pick one not already covered (check `ls content/articles | grep <word>`):
- Oct–Nov: thanksgiving table centerpiece, thanksgiving front porch, fall mantel
  decor, friendsgiving table setting, cozy fall entryway.
- Oct–Dec: christmas mantel decor, small apartment christmas decor, christmas
  entryway, christmas tree theme ideas, advent calendar ideas, stocking stuffer
  ideas for women, christmas gift basket ideas, ornament diy, christmas coffee bar,
  winter porch decor.
- Nov–Jan: new year's eve party decor, cozy winter living room.
- Evergreen home: renter-friendly kitchen upgrades, small entryway storage,
  cubicle decor, home desk setups, peel-and-stick wall ideas.
