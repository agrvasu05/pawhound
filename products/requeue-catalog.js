/**
 * requeue-catalog.js — queue fresh pin variants for every canonical product.
 *
 * "Post a lot" without new products: each product gets N new angles (title,
 * headline, description, alt text) → postQueue renders each on a different
 * room/desk scene and drips them out, one per product per week.
 *
 *   node products/requeue-catalog.js [--per=3] [--only=<slug-substr>] [--min-pending=1]
 *
 * Skips a product that already has ≥ --min-pending pending variants, so it is
 * safe to run daily (the ops workflow does).
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const lib = require('./lib');
const { canonicalProducts } = require('./catalog');

const per = parseInt(process.argv.find((a) => a.startsWith('--per='))?.split('=')[1] || '3', 10);
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const minPending = parseInt(process.argv.find((a) => a.startsWith('--min-pending='))?.split('=')[1] || '1', 10);

// Keyword boards per product family — board names are a ranking field, so each
// variant lands on a searchable phrase rather than one catch-all board.
const DOG_BOARDS = ['Dog Wall Art Printables', 'Gifts for Dog Lovers', 'Dog Lovers Home Decor'];
const PLANNER_BOARDS = ['Printable Planners & Trackers', 'Home Organization Printables', 'Budget & Life Planners'];
const ART_BOARDS = ['Printable Wall Art', 'Cozy Home Decor Ideas', 'Gallery Wall Printables'];
const BUNDLE_BOARDS = ['Printable Bundles', 'Cozy Home Printables', 'Gifts for Dog Lovers'];

function boardsFor(p) {
  if (p.type === 'bundle') return BUNDLE_BOARDS;
  if (/\b(dog|dogs|puppy|pup)\b/i.test(p.title)) return DOG_BOARDS;
  if (p.type === 'planner' || p.type === 'spreadsheet') return PLANNER_BOARDS;
  return ART_BOARDS;
}
function keywordFor(p) {
  if (/\b(dog|dogs|puppy)\b/i.test(p.title)) return p.type === 'bundle' ? 'dog lover gifts' : 'dog wall art printable';
  if (p.type === 'planner') return (p.title.match(/^(?:printable )?(.{8,40}?) (planner|tracker|checklist)/i) || [])[1]?.toLowerCase() + ' printable' || 'printable planner';
  if (p.type === 'bundle') return 'printable bundle';
  return 'printable wall art';
}

(async () => {
  const q = lib.loadQueue();
  const pendingBySlug = {};
  for (const e of q) if (e.status === 'pending') pendingBySlug[e.slug] = (pendingBySlug[e.slug] || 0) + 1;

  let queued = 0, skipped = 0;
  for (const p of canonicalProducts()) {
    if (only && !p.slug.includes(only)) continue;
    if ((pendingBySlug[p.slug] || 0) >= minPending) { skipped++; continue; }
    const boards = boardsFor(p);
    const n = await lib.enqueueProductVariants({
      slug: p.slug, type: p.type, title: p.title, price: p.price,
      board: { name: boards[0], description: lib.kwBoardDesc(boards[0]) },
      boards, keyword: keywordFor(p),
    });
    queued += n;
    console.log(`  ✓ ${p.slug}: ${n} variants → ${boards.join(' / ')}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`\nQueued ${queued} fresh product pins (${skipped} products already had pending variants).`);
})().catch((e) => { console.error(e); process.exit(1); });
