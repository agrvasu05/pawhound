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

// Top-demand digital types (per market research). Wall-art portraits retired.
const TYPES = {
  clipart: require('./types/clipart'),        // #1 demand (transparent PNG sets)
  spreadsheet: require('./types/spreadsheet'),// editable trackers (.xlsx, ~$0)
  planner: require('./types/planner'),        // printable PDFs (~$0)
  coloring: require('./types/coloring'),       // available, off by default (image cost)
};

const OUT_ROOT = path.join(process.cwd(), 'products', 'output');
const TRACKER = path.join(process.cwd(), 'content', 'gumroad-products.json');

// Which trend-brief niches each printable type can serve (fashion/beauty briefs
// are intentionally left for the article+affiliate pipeline, not printables).
const TYPE_NICHES = {
  clipart: ['aesthetic art & printables', 'home decor', 'gifts & occasions', 'beauty', 'fashion'],
  spreadsheet: ['wellness', 'gifts & occasions'],
  planner: ['wellness', 'gifts & occasions'],
  coloring: ['aesthetic art & printables', 'gifts & occasions'],
};

const argTypes = process.argv.find((a) => a.startsWith('--types='));
// Default: 2 products/day, rotating evenly across the top-demand types
// (clipart, spreadsheet, planner) so output is steady + varied. Clipart adds a
// small image cost (~$0.13); spreadsheet/planner are ~$0.
const ROTATION = ['clipart', 'spreadsheet', 'planner'];
const dayIdx = Math.floor(Date.now() / 864e5);
const defaultSel = [ROTATION[dayIdx % 3], ROTATION[(dayIdx + 1) % 3]];
const selected = argTypes ? argTypes.split('=')[1].split(',') : defaultSel;
const generateOnly = process.argv.includes('--generate-only');

function loadTracker() { try { return JSON.parse(fs.readFileSync(TRACKER, 'utf-8')); } catch { return []; } }

// Combine the day's products into one higher-price bundle (raises order value;
// per the strategy doc's "theme stack"). Counts as 1 more Gumroad create (<10/day).
async function makeBundle(created, tracker) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = `dog-lover-bundle-${date}`.replace(/[^a-z0-9-]/g, '');
  const dir = path.join(OUT_ROOT, slug);
  fs.mkdirSync(dir, { recursive: true });
  const deliverables = [];
  const covers = [];
  created.forEach((p, i) => {
    const delBase = path.basename(p.listing.file);
    fs.copyFileSync(p.listing.file, path.join(dir, delBase));
    deliverables.push(delBase);
    const cv = path.join(dir, `item-${i + 1}.png`);
    fs.copyFileSync(p.listing.cover, cv);
    covers.push(cv);
  });
  const zipFile = lib.zip(dir, `${slug}.zip`, deliverables);
  const title = `The Complete Dog Lover Printable Bundle — ${created.length} Products (Wall Art, Coloring & Planner)`;
  const description_html =
    `<p>Get the whole set in one download — ${created.length} printable products for dog lovers and cozy homes, bundled at a discount versus buying separately.</p>` +
    `<p><strong>Included:</strong></p><ul>${created.map((p) => `<li>${p.listing.title}</li>`).join('')}</ul>` +
    `<p>Instant digital download. Print at home or use on a tablet. Personal use only.</p>`;
  const listing = { title, description_html, price: 12, currency: 'usd', slug, file: zipFile, fileName: `${title}.zip`, cover: covers[0] };
  const product = lib.gumroadCreateAndPublish(listing);
  lib.persistShopProduct({ slug, type: 'bundle', listing, gumroadUrl: product.url, srcImages: covers });
  const board = { name: 'Dog Lover Printable Bundles', description: 'Discounted printable bundles for dog lovers — wall art, coloring pages and planners in one instant download.' };
  const n = await lib.enqueueProductVariants({ slug, type: 'bundle', title, price: 12, board });
  tracker.push({ type: 'bundle', slug, title, price: 12, gumroad_id: product.id, gumroad_url: product.url, landing: `/shop/${slug}`, created_at: new Date().toISOString() });
  fs.writeFileSync(TRACKER, JSON.stringify(tracker, null, 2));
  console.log(`  ✓ BUNDLE: ${product.url} + landing /shop/${slug} + ${n} variants queued`);
}

(async () => {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.mkdirSync(path.dirname(TRACKER), { recursive: true });

  const tracker = loadTracker();
  const created = [];
  let made = 0;

  for (const type of selected) {
    const mod = TYPES[type];
    if (!mod) { console.error(`Unknown type: ${type}`); continue; }
    try {
      console.log(`\n=== ${type} ===`);
      // Pick the top trending keyword for this type (real search demand, not random).
      const brief = lib.pickBrief(TYPE_NICHES[type]);
      if (brief) { lib.markBriefUsed(brief.keyword); console.log(`  keyword: "${brief.keyword}" (vol ${brief.pop}, MoM ${brief.mom}%)`); }
      else console.log('  (no matching trend brief — using fallback theme)');
      const p = await mod.generate(OUT_ROOT, brief);
      console.log(`  generated: "${p.listing.title}"`);

      if (generateOnly) { console.log(`  (generate-only) files in ${p.dir}`); made++; continue; }

      const product = lib.gumroadCreateAndPublish(p.listing);
      console.log(`  ✓ Gumroad: ${product.url}`);

      // Owned landing page (Rich Pins + AdSense + email later) instead of pinning Gumroad directly.
      const srcImages = [...new Set([p.listing.cover, ...p.pin.images])];
      lib.persistShopProduct({ slug: p.slug, type: p.type, listing: p.listing, gumroadUrl: product.url, srcImages });

      // Queue multiple distinct pin variants (dripped over days by post-queue.js).
      const n = await lib.enqueueProductVariants({ slug: p.slug, type: p.type, title: p.listing.title, price: p.listing.price, board: p.board, keyword: p.keyword || '' });
      console.log(`  ✓ landing page /shop/${p.slug} + ${n} pin variants queued`);

      tracker.push({ type, slug: p.slug, title: p.listing.title, price: p.listing.price,
        gumroad_id: product.id, gumroad_url: product.url, landing: `/shop/${p.slug}`, created_at: new Date().toISOString() });
      fs.writeFileSync(TRACKER, JSON.stringify(tracker, null, 2));
      created.push(p);
      made++;
    } catch (e) {
      // For CLI (execFileSync) errors, the real reason is in stdout/stderr.
      const detail = (e.stdout && e.stdout.toString()) || (e.stderr && e.stderr.toString()) || '';
      console.error(`  ✗ ${type} failed:`, e.message, detail ? `\n     ${detail.slice(0, 400)}` : '');
      // Gumroad caps creations at 10/day — stop early so we don't burn image-gen $.
      if (detail.includes('per day')) { console.error('  Hit Gumroad daily product cap — stopping this run.'); break; }
    }
  }

  // Bundle weekly (Sundays only) so output stays even — not a 4th product daily.
  const isBundleDay = new Date().getUTCDay() === 0;
  if (!generateOnly && isBundleDay && created.length >= 2) {
    try { console.log('\n=== weekly bundle ==='); await makeBundle(created, tracker); }
    catch (e) {
      const detail = (e.stdout && e.stdout.toString()) || (e.stderr && e.stderr.toString()) || '';
      console.error('  ✗ bundle failed:', e.message, detail ? `\n     ${detail.slice(0, 300)}` : '');
    }
  }

  console.log(`\nDone. ${made}/${selected.length} products${created.length >= 2 ? ' + 1 bundle' : ''}.`);
})();
