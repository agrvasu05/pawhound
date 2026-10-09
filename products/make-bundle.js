/**
 * make-bundle.js — build a real, higher-ticket bundle from existing canonical
 * wall-art sets and publish it (Gumroad product + /shop landing page + pins).
 *
 * The weekly auto-bundles were "today's two random products for $12". This
 * builds a themed bundle buyers actually search for:
 *
 *   node products/make-bundle.js dog-lovers      # 6 dog art sets, 18 prints, $19
 *   node products/make-bundle.js cozy-home       # all non-dog art sets, $19
 *   node products/make-bundle.js everything      # every wall-art set, $29
 *
 * Print files are the PNGs already committed in public/shop-assets/<slug>/.
 * Flags: --dry-run (zip + landing copy only, no Gumroad/queue)
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const { canonicalProducts } = require('./catalog');

const KIND = process.argv[2] || 'dog-lovers';
const DRY = process.argv.includes('--dry-run');
const DOG = /\b(dog|dogs|puppy|pup)\b/i;

const BUNDLES = {
  'dog-lovers': {
    slug: 'dog-lover-wall-art-bundle',
    title: 'Dog Lover Printable Wall Art Bundle — 6 Sets, 18 Prints (Boho, Japandi, Watercolor & More)',
    price: 19,
    pick: (p) => p.type === 'wall-art' && DOG.test(p.title),
    boards: ['Gifts for Dog Lovers', 'Dog Wall Art Printables', 'Dog Lovers Home Decor'],
    keyword: 'dog lover gifts',
    blurb: 'Every dog wall-art set in the shop in one download: boho line art, Japandi portraits, soft watercolor sleeping pups, vintage botanicals, cozy cottage scenes and pastel mid-century dogs.',
  },
  'cozy-home': {
    slug: 'cozy-home-wall-art-bundle',
    title: 'Cozy Home Printable Wall Art Bundle — Every Seasonal & Decor Set in One Download',
    price: 19,
    pick: (p) => p.type === 'wall-art' && !DOG.test(p.title),
    boards: ['Printable Wall Art', 'Cozy Home Decor Ideas', 'Gallery Wall Printables'],
    keyword: 'printable wall art bundle',
    blurb: 'All of our non-dog wall-art sets — seasonal, farmhouse and cozy decor prints — bundled at a discount.',
  },
  everything: {
    slug: 'everything-wall-art-bundle',
    title: 'The Everything Wall Art Bundle — Every Printable Set from Value Finds Daily',
    price: 29,
    pick: (p) => p.type === 'wall-art',
    boards: ['Printable Wall Art', 'Printable Bundles', 'Gifts for Dog Lovers'],
    keyword: 'printable wall art bundle',
    blurb: 'Every wall-art set in the shop, dog and decor, in one download at the lowest per-print price we offer.',
  },
};

(async () => {
  const B = BUNDLES[KIND];
  if (!B) { console.error(`Unknown bundle "${KIND}". Options: ${Object.keys(BUNDLES).join(', ')}`); process.exit(1); }
  const sets = canonicalProducts().filter(B.pick);
  if (sets.length < 2) { console.error(`Only ${sets.length} matching sets — not enough for a bundle.`); process.exit(1); }

  const dir = path.join(process.cwd(), 'products', 'output', B.slug);
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  const covers = [];
  let printCount = 0;
  for (const p of sets) {
    const assetDir = path.join(lib.PUBLIC_SHOP, p.slug);
    const prints = (p.images || []).filter((f) => /^print-\d+\.png$/i.test(f));
    const setName = p.title.replace(/[^A-Za-z0-9 ]+/g, '').split(' ').slice(0, 5).join(' ');
    for (const f of prints) {
      const src = path.join(assetDir, f);
      if (!fs.existsSync(src)) continue;
      const dest = `${setName} - ${f}`;
      fs.copyFileSync(src, path.join(dir, dest));
      files.push(dest); printCount++;
    }
    const cov = path.join(assetDir, p.cover);
    if (fs.existsSync(cov)) { const c = `item-${covers.length + 1}.png`; fs.copyFileSync(cov, path.join(dir, c)); covers.push(path.join(dir, c)); }
  }
  if (!files.length) { console.error('No print files found in public/shop-assets — nothing to bundle.'); process.exit(1); }
  fs.writeFileSync(path.join(dir, 'README.txt'),
    `${B.title}\n\nThank you! Included: ${printCount} high-resolution PNG prints across ${sets.length} coordinating sets.\nPrint at home up to 11x14" on matte paper, or at any print shop. Personal use only.\n\n— ${lib.BRAND}`);
  const zipFile = lib.zip(dir, `${B.slug}.zip`, [...files, 'README.txt']);

  const description_html =
    `<p>${B.blurb}</p>` +
    `<p><strong>What you get:</strong> ${printCount} high-resolution PNG prints (${sets.length} sets of 3), sized to print up to 11x14" at home or at any print shop. Bought separately these sets are $${sets.reduce((s, p) => s + p.price, 0)}.</p>` +
    `<p><strong>Included sets:</strong></p><ul>${sets.map((p) => `<li>${lib.esc(p.title)}</li>`).join('')}</ul>` +
    `<p>Instant digital download. No physical item is shipped. Personal use only.</p>`;
  const listing = { title: B.title, description_html, price: B.price, currency: 'usd', slug: B.slug, file: zipFile, fileName: `${B.slug}.zip`, cover: covers[0], tags: ['printable wall art', 'bundle', 'dog lover gift', 'home decor'] };

  console.log(`Bundle "${B.title}": ${sets.length} sets, ${printCount} prints, $${B.price} → ${zipFile}`);
  if (DRY) { console.log('(dry run) stopping before Gumroad/landing page/queue.'); return; }

  // Idempotent: if a previous run already created the Gumroad product and the
  // landing page (content/shop/<slug>.json), reuse it instead of minting a copy.
  const recPath = path.join(lib.SHOP_DIR, `${B.slug}.json`);
  let product;
  if (fs.existsSync(recPath)) {
    const rec = JSON.parse(fs.readFileSync(recPath, 'utf-8'));
    product = { id: rec.gumroad_id || null, url: rec.gumroad_url };
    console.log(`  ↻ landing page + Gumroad product already exist (${product.url}) — reusing`);
  } else {
    product = lib.gumroadCreateAndPublish(listing);
    console.log(`  ✓ Gumroad: ${product.url}`);
    lib.persistShopProduct({ slug: B.slug, type: 'bundle', listing, gumroadUrl: product.url, srcImages: covers });
  }
  const n = await lib.enqueueProductVariants({ slug: B.slug, type: 'bundle', title: B.title, price: B.price, board: { name: B.boards[0], description: lib.kwBoardDesc(B.boards[0]) }, boards: B.boards, keyword: B.keyword });
  const trackerPath = path.join(process.cwd(), 'content', 'gumroad-products.json');
  const tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf-8'));
  if (!tracker.some((t) => t.slug === B.slug)) tracker.push({ type: 'bundle', slug: B.slug, title: B.title, price: B.price, gumroad_id: product.id, gumroad_url: product.url, landing: `/shop/${B.slug}`, created_at: new Date().toISOString() });
  fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
  console.log(`  ✓ landing /shop/${B.slug} + ${n} pin variants queued`);
})().catch((e) => { console.error(e.stdout?.toString() || e.message); process.exit(1); });
