# How to upgrade a guide (written by Claude)

Only upgraded guides (`upgraded_at` set) are offered to Google. This is the
standard every rewrite must meet. Batch 1 (10 dog guides, 10–11 Oct 2026) is
the reference — read `content/articles/best-apartment-dogs.json` before writing.

## Steps

1. `python3 scripts/upgrade-queue.py 2` — the next two guides.
2. `python3 scripts/upgrade-facts.py <slug>` — the picks and their data.
3. **Check the ranking against the data first.** If the order contradicts the
   guide's own topic (e.g. a heavy-barking breed at #1 for apartments, a
   duplicate breed, ranks that start at #2), fix the article file before
   writing: re-sort `picks` and renumber `rank` 1..N. Never change a pick's
   `breed` text unless replacing a duplicate with a breed that already has a
   photo (`public/images/breeds/<slug>/1.jpg`).
4. Write the upgrade JSON (shape below) to a temp file.
5. `python3 scripts/apply-upgrade.py <slug> <file>` — validates and saves.
   Fix whatever it rejects and run it again.
6. `npx next build` must pass. Then commit and push (the commit message must
   not contain any CI-skip tag, or Cloudflare won't publish it).

## Upgrade JSON

```json
{
  "seo_title": "≤ 60 chars, keyword first, includes the year, no 'Top N Best'",
  "answer": "2–3 sentences: name #1, #2, #3 and the one deciding factor. No hype.",
  "intro": "60–100 words on what actually matters for this situation. Don't restate the title.",
  "method": "1–2 literally true sentences on how the list was made (dog guides: filtered from a 150-breed dataset on named attributes, ordered by fit). No testing claims.",
  "faqs": [{"question": "...", "answer": "40–80 words"}],
  "picks": [{
    "rank": 1, "breed": "exact name from the file",
    "description": "110–160 words, specific to this item in this situation: exercise minutes, grooming routine, noise, space, size, real trade-offs",
    "best_for": "6–14 words",
    "skip_if": "8–20 words: who should not choose it and why",
    "quirky_fact": "one useful, specific sentence",
    "product_name": "NON-DOG GUIDES ONLY: a specific, widely sold product (brand + model or precise name)"
  }]
}
```

## Rules

- Never claim first-hand testing, owning, living with or trying anything.
  Never invent statistics, studies, prices, quotes or experts.
- Ground dog claims in `content/breeds.json`. If the data says a breed is not
  good with kids, cats or dogs, say so in `skip_if`.
- No hype: the validator rejects "is essential", "elevate", "transform your
  space", "game-changer", "whether you're", "perfect addition", "seamlessly",
  "furry friend", exclamation marks, and similar.
- Every pick's description must be distinct; no repeated template sentences.
- Author is always the pen name Elena Marsh (set by the script). Never add
  credentials or a photo for her.
- Amazon: product guides link to an exact-name search for `product_name`.
  Only add a direct `/dp/ASIN` link to `content/amazon-products.json` after
  checking the listing title matches.
