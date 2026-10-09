/**
 * gumroad-cleanup.js — unpublish the duplicate Gumroad listings so the public
 * store (valuefinds.gumroad.com) shows ~20 real products instead of 117 copies.
 *
 * Keeps: the Gumroad product behind every canonical /shop page, plus the
 * June products that old Pinterest pins link to directly (they still get clicks).
 * Unpublishes: every other product in content/gumroad-products.json.
 * Unpublishing is reversible (`gumroad products publish <id>`); nothing is deleted.
 *
 *   node products/gumroad-cleanup.js            # dry run — lists what would change
 *   node products/gumroad-cleanup.js --apply    # unpublish
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { canonicalProducts, allRecords } = require('./catalog');

const APPLY = process.argv.includes('--apply');
const CLI = fs.existsSync(path.join(process.env.HOME || '', 'go', 'bin', 'gumroad')) ? path.join(process.env.HOME, 'go', 'bin', 'gumroad') : 'gumroad';

// Pinned directly to Gumroad in June 2026 (before landing pages existed) and
// still earning clicks per the October audit.
const KEEP_URLS = new Set([
  'https://valuefinds.gumroad.com/l/bohominimalistdogart',
  'https://valuefinds.gumroad.com/l/cozycottagedogset',
  'https://valuefinds.gumroad.com/l/cozywatercolordogset',
  'https://valuefinds.gumroad.com/l/dogsholidaysseasonscoloringpag',
  'https://valuefinds.gumroad.com/l/holidayseasonaldogscoloringpag',
  'https://valuefinds.gumroad.com/l/japandiminimalistdogprints',
  'https://valuefinds.gumroad.com/l/pastelmidcenturydogset',
  'https://valuefinds.gumroad.com/l/printabledogtrainingprogresstr',
  'https://valuefinds.gumroad.com/l/printablepetfeedingwalkschedul',
]);

const tracker = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'gumroad-products.json'), 'utf-8'));
// Compare by permalink only: the store was renamed (wesucceed → valuefinds), so
// the tracker holds old-host URLs for the June products while the pins use the
// new host. Same product either way.
const permalink = (u) => (String(u || '').match(/\/l\/([^/?#]+)/) || [])[1] || '';
const keepLinks = new Set([...KEEP_URLS, ...canonicalProducts().map((p) => p.gumroad_url)].map(permalink).filter(Boolean));
const seen = new Set();
const toUnpublish = tracker.filter((p) => {
  if (seen.has(p.gumroad_id)) return false;
  seen.add(p.gumroad_id);
  return !keepLinks.has(permalink(p.gumroad_url));
});

console.log(`${tracker.length} Gumroad products in tracker; keeping ${keepLinks.size} (canonical + legacy-pinned); unpublishing ${toUnpublish.length}.`);
for (const p of toUnpublish) console.log(`  ${APPLY ? 'unpublish' : '(dry) would unpublish'} ${p.gumroad_id}  ${p.type.padEnd(9)} $${p.price}  ${p.title.slice(0, 70)}`);
if (!APPLY) { console.log('\nRe-run with --apply to unpublish.'); process.exit(0); }

let ok = 0, fail = 0;
for (const p of toUnpublish) {
  try {
    execFileSync(CLI, ['products', 'unpublish', p.gumroad_id, '--yes'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    ok++;
  } catch (e) {
    fail++;
    console.error(`  ✗ ${p.gumroad_id}: ${(e.stderr || e.stdout || e.message).toString().slice(0, 160)}`);
  }
}
const sidecar = allRecords().filter((r) => r.price > 0).length;
console.log(`\nDone. Unpublished ${ok}, failed ${fail}. Storefront records on the site: ${sidecar} (canonical ${canonicalProducts().length}).`);
