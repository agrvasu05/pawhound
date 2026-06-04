/**
 * product-search.js — multi-source product fetcher for real-product round-ups.
 *
 * Given a query (an article item's shop_query), it tries each CONFIGURED source
 * in priority order and returns the best real product: { title, url, image,
 * price, currency, source, noskim }. A source is skipped if its key env var is
 * absent, and any source error is swallowed (so one bad source never breaks a run).
 *
 * Keys (set as they're approved):
 *   ETSY_API_KEY            — Etsy Open API (data); link is Skimlinks-affiliated -> noskim:false
 *   SHOPSTYLE_PID           — ShopStyle API; returns already-affiliated links     -> noskim:true
 *   AMAZON_ASSOCIATE_TAG +  — Amazon Creators API (after first sales)             -> noskim:true
 *   AMAZON_ACCESS_KEY/SECRET
 *   SKIMLINKS_API_KEY       — Skimlinks Product API; Skimlinks-affiliated         -> noskim:false
 *
 * Each source module is VALIDATED live the moment its key is active.
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');

function getJSON(host, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: host, path, method: 'GET', headers }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject); req.end();
  });
}

// ── ShopStyle Collective (fashion/beauty/home; returns affiliated links) ─────
async function shopstyle(query) {
  const pid = process.env.SHOPSTYLE_PID;
  if (!pid) return [];
  const r = await getJSON('api.shopstyle.com', `/api/v2/products?pid=${pid}&fts=${encodeURIComponent(query)}&limit=5`);
  if (r.status !== 200) return [];
  return (r.body.products || []).map((p) => ({
    title: p.name,
    url: p.clickUrl, // already affiliated with your pid
    image: p.image && p.image.sizes && (p.image.sizes.Best || p.image.sizes.Large || p.image.sizes.Original || {}).url,
    price: p.price, currency: p.currency || 'USD',
    source: 'shopstyle', noskim: true,
  })).filter((x) => x.url && x.image);
}

// ── Etsy Open API (data); link is plain Etsy URL -> Skimlinks affiliates it ──
async function etsy(query) {
  const key = process.env.ETSY_API_KEY;
  if (!key) return [];
  const r = await getJSON('openapi.etsy.com', `/v3/application/listings/active?keywords=${encodeURIComponent(query)}&limit=5`, { 'x-api-key': key });
  if (r.status !== 200) return [];
  const out = [];
  for (const l of (r.body.results || []).slice(0, 3)) {
    let image = null;
    try {
      const ir = await getJSON('openapi.etsy.com', `/v3/application/listings/${l.listing_id}/images?limit=1`, { 'x-api-key': key });
      image = ir.body && ir.body.results && ir.body.results[0] && ir.body.results[0].url_570xN;
    } catch { /* skip image */ }
    const price = l.price ? Number(l.price.amount) / Number(l.price.divisor || 100) : null;
    out.push({ title: l.title, url: l.url, image, price, currency: (l.price && l.price.currency_code) || 'USD', source: 'etsy', noskim: false });
  }
  return out.filter((x) => x.url && x.image);
}

// ── Skimlinks Product API (broad; Skimlinks-affiliated) ──────────────────────
async function skimlinks(query) {
  const key = process.env.SKIMLINKS_API_KEY;
  if (!key) return [];
  const r = await getJSON('api-products.skimapis.com', `/v4/product?key=${key}&q=${encodeURIComponent(query)}&rows=5`);
  if (r.status !== 200) return [];
  return (r.body.products || []).map((p) => ({
    title: p.title, url: p.url, image: p.image_url, price: p.price, currency: p.currency || 'USD',
    source: 'skimlinks', noskim: false,
  })).filter((x) => x.url && x.image);
}

// Priority: ShopStyle (niche-perfect, affiliated) -> Etsy -> Skimlinks broad.
const SOURCES = [shopstyle, etsy, skimlinks];

async function searchProduct(query) {
  for (const src of SOURCES) {
    try {
      const results = await src(query);
      if (results && results.length) return results[0];
    } catch { /* skip this source */ }
  }
  return null;
}

module.exports = { searchProduct, shopstyle, etsy, skimlinks };

// CLI test:  node products/product-search.js "white linen midi dress"
if (require.main === module) {
  (async () => {
    const q = process.argv.slice(2).join(' ') || 'white linen midi dress';
    console.log('Query:', q);
    for (const [name, fn] of [['shopstyle', shopstyle], ['etsy', etsy], ['skimlinks', skimlinks]]) {
      try { const r = await fn(q); console.log(`${name}: ${r.length} results`, r[0] ? `→ ${r[0].title?.slice(0, 50)} | ${r[0].url}` : '(none / no key)'); }
      catch (e) { console.log(`${name}: error ${e.message}`); }
    }
  })();
}
