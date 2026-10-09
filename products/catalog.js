/**
 * catalog.js — the real product catalog (canonical products only).
 *
 * The daily generator re-created the same six dog wall-art themes and eight
 * planner ideas for weeks, so Gumroad holds 117 products for ~20 real ones.
 * content/shop-canonical.json maps every duplicate slug to the page we keep;
 * this module exposes helpers so generators reuse an existing product (and
 * queue fresh pins for it) instead of minting another copy.
 */
const fs = require('fs');
const path = require('path');

const SHOP_DIR = path.join(process.cwd(), 'content', 'shop');
const CANON_PATH = path.join(process.cwd(), 'content', 'shop-canonical.json');

function canonicalMap() { try { return JSON.parse(fs.readFileSync(CANON_PATH, 'utf-8')); } catch { return {}; } }
function canonicalSlug(slug) { return canonicalMap()[slug] || slug; }

function allRecords() {
  if (!fs.existsSync(SHOP_DIR)) return [];
  return fs.readdirSync(SHOP_DIR).filter((f) => f.endsWith('.json'))
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(SHOP_DIR, f), 'utf-8')); } catch { return null; } })
    .filter(Boolean);
}

/** Canonical paid products (what the storefront shows). */
function canonicalProducts() {
  const map = canonicalMap();
  const all = allRecords();
  const slugs = new Set(all.map((r) => r.slug));
  return all.filter((r) => r.price > 0 && !(map[r.slug] && slugs.has(map[r.slug])));
}

const STOP = new Set('printable wall art set of the and with for a in planner tracker print prints poster posters decor home cozy style illustration soft warm tones tone pastel abstract minimalist neutral muted scene scenes gentle calming room pdf us letter instant download digital'.split(' '));
function tokens(s) {
  return new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Finds an existing canonical product of the same type whose title (or
 * keyword) overlaps the proposed one. Threshold tuned on the real catalog:
 * "Soft Watercolor Sleeping Dogs Printable Wall Art Set" vs "Cozy Sleeping
 * Dogs Printable Wall Art Set" scores 0.5; unrelated planners score < 0.2.
 */
function findExisting({ title, type, keyword = '' }, threshold = 0.5) {
  let best = null, bestScore = 0;
  for (const p of canonicalProducts()) {
    if (type && p.type !== type) continue;
    const score = Math.max(jaccard(title, p.title), keyword ? jaccard(keyword, p.title) : 0);
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return bestScore >= threshold ? { product: best, score: bestScore } : null;
}

module.exports = { canonicalMap, canonicalSlug, allRecords, canonicalProducts, findExisting, jaccard, SHOP_DIR };
