/**
 * generate-daily.js — make N digital products (one per type), upload to Gumroad,
 * and post a shop pin for each to Pinterest.
 *
 * Flags:
 *   --generate-only        build files locally, skip Gumroad + Pinterest
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
  if (!generateOnly) await lib.pinRefresh();

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

      const pinPng = path.join(p.dir, 'pin.png');
      await lib.renderShopPin(p.pin, pinPng);
      const boardId = await lib.pinGetOrCreateBoard(p.board.name, p.board.description);
      const pinUrl = await lib.pinPost({
        boardId, title: p.pin.title, description: p.pin.description, link: product.url, pngPath: pinPng,
      });
      console.log(`  ✓ Pinterest: ${pinUrl}`);

      tracker.push({ type, slug: p.slug, title: p.listing.title, price: p.listing.price,
        gumroad_id: product.id, gumroad_url: product.url, pin_url: pinUrl, created_at: new Date().toISOString() });
      fs.writeFileSync(TRACKER, JSON.stringify(tracker, null, 2));
      made++;
      await new Promise((r) => setTimeout(r, 4000)); // be gentle on Pinterest
    } catch (e) {
      // For CLI (execFileSync) errors, the real reason is in stdout/stderr.
      const detail = (e.stdout && e.stdout.toString()) || (e.stderr && e.stderr.toString()) || '';
      console.error(`  ✗ ${type} failed:`, e.message, detail ? `\n     ${detail.slice(0, 400)}` : '');
    }
  }
  console.log(`\nDone. ${made}/${selected.length} products.`);
})();
