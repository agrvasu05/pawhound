/**
 * backfill-shop.js — one-off: build /shop landing pages for products that already
 * exist on Gumroad. Pulls title/description/price + the cover image from Gumroad,
 * writes content/shop/<slug>.json and saves the cover to public/shop-assets/<slug>/.
 * Also enqueues pin variants for each so the drip-poster can promote them.
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');
const lib = require('./lib');

const CLI = path.join(process.env.HOME, 'go', 'bin', 'gumroad');
const g = (args) => execFileSync(CLI, args, { env: { ...process.env }, encoding: 'utf-8', maxBuffer: 1 << 26 });
const SKIP = ['ibs', 'budget']; // the owner's own non-pipeline products

function inferType(name) {
  const t = name.toLowerCase();
  if (/colou?ring/.test(t)) return 'coloring';
  if (/planner|tracker|schedule|checklist|binder|budget/.test(t)) return 'planner';
  return 'wall-art';
}
function boardFor(type) {
  if (type === 'coloring') return { name: 'Pet Coloring Pages (Printable)', description: 'Printable pet & dog coloring pages for kids and adults — instant digital downloads.' };
  if (type === 'planner') return { name: 'Printable Planners & Organizers', description: 'Printable planners, trackers and checklists for a calmer home and happy pets.' };
  return { name: 'Printable Wall Art & Cozy Decor', description: 'Printable wall art and cozy home decor — instant digital downloads for dog lovers and warm spaces.' };
}
function download(url, out) {
  return new Promise((res, rej) => { const f = fs.createWriteStream(out);
    https.get(url, (r) => { if (r.statusCode >= 300 && r.headers.location) { download(r.headers.location, out).then(res, rej); return; } r.pipe(f); f.on('finish', () => f.close(() => res(out))); }).on('error', rej); });
}

(async () => {
  const products = JSON.parse(g(['products', 'list', '--json'])).products;
  let done = 0;
  for (const p of products) {
    const slug = (p.short_url || '').split('/l/')[1];
    if (!slug || SKIP.includes(slug)) continue;
    if (fs.existsSync(path.join(lib.SHOP_DIR, `${slug}.json`))) { console.log(`– ${slug} (exists)`); continue; }
    const cover = (p.covers && p.covers[0] && (p.covers[0].original_url || p.covers[0].url)) || p.thumbnail_url;
    if (!cover) { console.log(`✗ ${slug} (no cover image)`); continue; }
    const dir = path.join(lib.PUBLIC_SHOP, slug); fs.mkdirSync(dir, { recursive: true });
    await download(cover, path.join(dir, 'cover.png'));
    const type = inferType(p.name);
    const rec = {
      slug, type, title: p.name,
      description_html: p.description || '',
      price: Math.round((p.price || 0) / 100) || 4, currency: (p.currency || 'usd'),
      gumroad_url: p.short_url, images: ['cover.png'], cover: 'cover.png',
      created_at: new Date().toISOString(),
    };
    fs.mkdirSync(lib.SHOP_DIR, { recursive: true });
    fs.writeFileSync(path.join(lib.SHOP_DIR, `${slug}.json`), JSON.stringify(rec, null, 2));
    const n = await lib.enqueueProductVariants({ slug, type, title: p.name, price: rec.price, board: boardFor(type) });
    console.log(`✓ ${slug} (${type}) landing page + ${n} variants queued`);
    done++;
  }
  console.log(`\nBackfilled ${done} products.`);
})();
