/**
 * upload-one.js <output-dir> — reads listing.json and creates + publishes the
 * product on Gumroad via the CLI, then records the live URL back into listing.json.
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = process.argv[2];
if (!dir) { console.error('usage: node products/upload-one.js <output-dir>'); process.exit(1); }
const listingPath = path.join(dir, 'listing.json');
const L = JSON.parse(fs.readFileSync(listingPath, 'utf-8'));

const CLI = path.join(process.env.HOME, 'go', 'bin', 'gumroad');
const env = { ...process.env, GUMROAD_ACCESS_TOKEN: process.env.GUMROAD_ACCESS_TOKEN };

function gumroad(args) {
  return execFileSync(CLI, args, { env, encoding: 'utf-8', maxBuffer: 1024 * 1024 * 64 });
}

console.log('Creating product on Gumroad...');
const createArgs = [
  'products', 'create',
  '--name', L.title,
  '--type', 'digital',
  '--price', String(L.price),
  '--currency', L.currency || 'usd',
  '--description', L.description_html,
  '--custom-permalink', L.slug.replace(/-/g, '').slice(0, 30),
  '--file', L.deliverable, '--file-name', `${L.title}.zip`,
  '--cover-image', L.cover,
  '--json',
];
for (const t of L.tags || []) createArgs.push('--tag', t);

const createOut = JSON.parse(gumroad(createArgs));
const product = createOut.product;
const permalink = product.short_url.split('/l/')[1];
console.log(`✓ created (draft): ${product.short_url}`);

console.log('Publishing...');
// Publish must reference the product ID, not the (custom) permalink.
gumroad(['products', 'publish', product.id, '--yes', '--json']);

L.gumroad_id = product.id;
L.gumroad_permalink = permalink;
L.gumroad_url = product.short_url;
L.published_at = new Date().toISOString();
fs.writeFileSync(listingPath, JSON.stringify(L, null, 2));

console.log(`PUBLISHED_URL=${product.short_url}`);
