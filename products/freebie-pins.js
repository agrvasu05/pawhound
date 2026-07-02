/**
 * freebie-pins.js — keeps "free printable" pins flowing for the lead magnet
 * (playbook rule 9: freebie pins are save/click magnets that feed the
 * email funnel AND build domain quality).
 *
 * Self-limiting: only enqueues when the queue has NO pending freebie variants
 * left. postQueue's 7-day per-slug spacing then drips them ~1/week, each on a
 * different keyword board with a fresh scene render. Runs daily via
 * daily-products.yml; most days it's a no-op.
 *
 * Requires content/shop/freebie.json + public/shop-assets/freebie/cover.png
 * (both produced by scripts/generate-freebie.js + committed).
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const SLUG = 'freebie';
const TITLE = 'The Cozy Home Reset — Free 7-Day Printable Checklist';

(async () => {
  const rec = path.join(lib.SHOP_DIR, `${SLUG}.json`);
  const cover = path.join(lib.PUBLIC_SHOP, SLUG, 'cover.png');
  if (!fs.existsSync(rec) || !fs.existsSync(cover)) {
    console.error('Freebie shop record/cover missing — run scripts/generate-freebie.js first.');
    process.exit(1);
  }

  const pending = lib.loadQueue().filter((e) => e.slug === SLUG && e.status === 'pending').length;
  if (pending > 0) {
    console.log(`Freebie queue healthy (${pending} pending) — nothing to do.`);
    return;
  }

  // Rotate across evergreen "free printable" search audiences.
  const boards = [
    'Free Printables',
    'Free Printable Planners & Checklists',
    'Cozy Home Decor Ideas',
  ];
  const n = await lib.enqueueProductVariants({
    slug: SLUG,
    type: 'planner',
    title: TITLE,
    price: 0,
    board: { name: boards[0], description: lib.kwBoardDesc ? lib.kwBoardDesc(boards[0]) : boards[0] },
    boards,
    keyword: 'free printable checklist',
    linkPath: '/freebie',
  });
  console.log(`✓ queued ${n} freebie pin variants -> /freebie (drip ~1/week)`);
})();
