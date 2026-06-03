/**
 * generate-daily.js — make N digital products (one per type), upload to Gumroad,
 * publish an owned landing page (/shop/<slug>), and QUEUE multiple pin variants.
 * Pins are posted separately by post-queue.js (after the site deploys), so each
 * product drips many fresh, non-duplicate pins over days.
 *
 * Flags:
 *   --generate-only        build files locally, skip Gumroad + landing page
 *   --types=wall-art,planner   limit to specific types (default: all three)
 */
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const TYPES = {
  'wall-art': require('./types/wall-art'),
  coloring: require('./types/coloring'),
  planner: require('./types/planner'),
};

const OUT_ROOT = path.join(process.cwd(), 'products', 'output');
const TRACKER = path.join(process.cwd(), 'content', 'gumroad-products.json');

const argTypes = process.argv.find((a) => a.startsWith('--types='));
const selected = argTypes ? argTypes.split('=')[1].split(',') : Object.keys(TYPES);
const generateOnly = process.argv.includes('--generate-only');

function loadTracker() { try { return JSON.parse(fs.readFileSync(TRACKER, 'utf-8')); } catch { return []; } }

(async () => {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.mkdirSync(path.dirname(TRACKER), { recursive: true });

  const tracker = loadTracker();
  let made = 0;

  for (const type of selected) {
    const mod = TYPES[type];
    if (!mod) { console.error(`Unknown type: ${type}`); continue; }
    try {
      console.log(`\n=== ${type} ===`);
      const p = await mod.generate(OUT_ROOT);
      console.log(`  generated: "${p.listing.title}"`);

      if (generateOnly) { console.log(`  (generate-only) files in ${p.dir}`); made++; continue; }

      const product = lib.gumroadCreateAndPublish(p.listing);
      console.log(`  ✓ Gumroad: ${product.url}`);

      // Owned landing page (Rich Pins + AdSense + email later) instead of pinning Gumroad directly.
      const srcImages = [...new Set([p.listing.cover, ...p.pin.images])];
      lib.persistShopProduct({ slug: p.slug, type: p.type, listing: p.listing, gumroadUrl: product.url, srcImages });

      // Queue multiple distinct pin variants (dripped over days by post-queue.js).
      const n = await lib.enqueueProductVariants({ slug: p.slug, type: p.type, title: p.listing.title, price: p.listing.price, board: p.board });
      console.log(`  ✓ landing page /shop/${p.slug} + ${n} pin variants queued`);

      tracker.push({ type, slug: p.slug, title: p.listing.title, price: p.listing.price,
        gumroad_id: product.id, gumroad_url: product.url, landing: `/shop/${p.slug}`, created_at: new Date().toISOString() });
      fs.writeFileSync(TRACKER, JSON.stringify(tracker, null, 2));
      made++;
    } catch (e) {
      // For CLI (execFileSync) errors, the real reason is in stdout/stderr.
      const detail = (e.stdout && e.stdout.toString()) || (e.stderr && e.stderr.toString()) || '';
      console.error(`  ✗ ${type} failed:`, e.message, detail ? `\n     ${detail.slice(0, 400)}` : '');
      // Gumroad caps creations at 10/day — stop early so we don't burn image-gen $.
      if (detail.includes('per day')) { console.error('  Hit Gumroad daily product cap — stopping this run.'); break; }
    }
  }
  console.log(`\nDone. ${made}/${selected.length} products.`);
})();
