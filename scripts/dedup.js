/**
 * dedup.js — shared semantic deduplication for topic generation.
 *
 * Used by both the dog pipeline (1b) and the trending pipeline (1c) so a single
 * source of truth decides whether two listicle titles cover the same theme.
 *
 * Approach: reduce a title to its meaningful keywords (drop stopwords + generic
 * Pinterest filler), collapse each keyword to a 4-char prefix so morphological
 * variants match ("anxiety"/"anxious", "photogenic"/"photogenically"), then flag
 * a duplicate when two titles share >= 50% of their keywords.
 */

const STOPWORDS = new Set([
  'dog', 'dogs', 'breed', 'breeds', 'best', 'that', 'with', 'your', 'this',
  'they', 'who', 'for', 'the', 'and', 'are', 'top', 'most', 'you', 'will',
  'love', 'loves', 'have', 'from', 'into', 'their', 'what', 'every',
  // generic Pinterest filler — ignore so only meaningful themes count
  'living', 'lovers', 'lover', 'owners', 'owner', 'people', 'home', 'homes',
  'life', 'perfect', 'great', 'good', 'companions', 'companion', 'guide',
  'ideas', 'idea', 'ways', 'things', 'must', 'need', 'want', 'over', 'under',
]);

// Light stemming: collapse morphological variants to a 4-char prefix.
function stem(w) {
  return w.length > 4 ? w.slice(0, 4) : w;
}

function keywordSet(title) {
  return new Set(
    String(title)
      .toLowerCase()
      .replace(/[^a-z ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      .map(stem)
  );
}

function buildKeywordSets(titles) {
  return titles.map(keywordSet);
}

// Returns true if `title` covers the same theme as any existing title.
//
// A duplicate is declared when EITHER:
//   • the titles share 2+ meaningful keywords (clear theme overlap), or
//   • one title is a single-concept title (1 keyword) that the other contains
//     ("Photogenic Dogs" vs "Photogenic Dogs That Steal the Spotlight").
//
// We deliberately do NOT flag a 1-keyword overlap between two multi-keyword
// titles — sharing one context word ("apartment", "cozy") doesn't make
// "Apartment Dogs" and "Apartment Storage Hacks" the same topic.
function isSemanticDuplicate(title, existingKeywordSets) {
  const kw = keywordSet(title);
  if (kw.size === 0) return false;
  for (const ex of existingKeywordSets) {
    if (ex.size === 0) continue;
    const overlap = [...kw].filter((w) => ex.has(w)).length;
    if (overlap >= 2) return true;
    if (overlap >= 1 && Math.min(kw.size, ex.size) === 1) return true;
  }
  return false;
}

module.exports = { STOPWORDS, stem, keywordSet, buildKeywordSets, isSemanticDuplicate };
