/**
 * niche-performance.js — which NICHES are actually performing on Pinterest.
 * Joins per-pin analytics (top_pins) with local pin→niche records and ranks
 * niches by impressions, outbound clicks and per-pin efficiency. Read-only.
 *   node products/niche-performance.js [days]   (default 90)
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');
const fs = require('fs');
const path = require('path');
const CID = process.env.PINTEREST_CLIENT_ID, CS = process.env.PINTEREST_CLIENT_SECRET, RT = process.env.PINTEREST_REFRESH_TOKEN;
const DAYS = parseInt(process.argv[2] || '90', 10);
let ACCESS;
function api(method, endpoint) {
  return new Promise((resolve, reject) => {
    const oauth = endpoint === '/v5/oauth/token';
    const auth = oauth ? 'Basic ' + Buffer.from(`${CID}:${CS}`).toString('base64') : `Bearer ${ACCESS}`;
    const payload = oauth ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: RT }).toString() : null;
    const opts = { hostname: 'api.pinterest.com', path: endpoint, method, headers: { Authorization: auth, ...(payload ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) } : {}) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}
const ymd = (d) => d.toISOString().slice(0, 10);

// ── pin_id → niche, from local records ──
function classifyArticle(slug) {
  const s = slug.toLowerCase();
  if (/cozy|storage|bedroom|reading-nook|home|decor|small-space|small-home|nook|declutter/.test(s)) return 'home/cozy (content)';
  return 'dog breeds (content)';
}
function buildMap() {
  const map = {}; // pin_id -> niche
  try {
    const posted = JSON.parse(fs.readFileSync('content/posted-pins.json', 'utf8'));
    for (const [key, v] of Object.entries(posted)) if (v && v.pin_id) map[v.pin_id] = classifyArticle(key.split('/')[0]);
  } catch {}
  try {
    const q = JSON.parse(fs.readFileSync('content/pin-queue.json', 'utf8'));
    for (const e of q) {
      const id = (e.pin_url || '').split('/pin/')[1];
      if (!id) continue;
      let type = 'other';
      try { type = JSON.parse(fs.readFileSync(path.join('content/shop', e.slug + '.json'), 'utf8')).type; } catch {}
      map[id] = 'shop: ' + type;
    }
  } catch {}
  return map;
}

(async () => {
  const t = await api('POST', '/v5/oauth/token');
  ACCESS = t.body.access_token;
  if (!ACCESS) { console.error('auth failed:', JSON.stringify(t.body)); process.exit(1); }
  const map = buildMap();
  console.log(`Mapped ${Object.keys(map).length} local pins to niches. Window: ${DAYS}d.\n`);

  const end = new Date(), start = new Date(Date.now() - DAYS * 864e5);
  const metrics = {}; // pin_id -> {IMPRESSION, OUTBOUND_CLICK, SAVE, PIN_CLICK}
  for (const sort of ['IMPRESSION', 'OUTBOUND_CLICK', 'SAVE', 'PIN_CLICK']) {
    const r = await api('GET', `/v5/user_account/analytics/top_pins?start_date=${ymd(start)}&end_date=${ymd(end)}&metric_types=IMPRESSION,OUTBOUND_CLICK,SAVE,PIN_CLICK&sort_by=${sort}&num_of_pins=50`);
    if (r.status !== 200) { console.error(`top_pins(${sort}) HTTP ${r.status}:`, JSON.stringify(r.body).slice(0, 200)); continue; }
    const pins = (r.body && (r.body.pins || r.body.data || [])) || [];
    for (const p of pins) {
      const id = p.pin_id || p.id;
      const m = p.pin_metrics || p.metrics || p.summary_metrics || p;
      metrics[id] = metrics[id] || {};
      for (const k of ['IMPRESSION', 'OUTBOUND_CLICK', 'SAVE', 'PIN_CLICK']) {
        const v = (m[k] && (m[k].lifetime_metrics ? m[k].lifetime_metrics[k] : m[k])) ?? m[k];
        if (typeof v === 'number') metrics[id][k] = Math.max(metrics[id][k] || 0, v);
      }
    }
  }
  console.log(`Pins with analytics: ${Object.keys(metrics).length}`);

  // Resolve pins that have analytics but aren't in local records (often the top
  // performers) by fetching their link/title from Pinterest, then classify.
  function classifyByText(link, title) {
    const s = ((link || '') + ' ' + (title || '')).toLowerCase();
    if (/\/shop\//.test(link || '')) {
      const slug = (link.split('/shop/')[1] || '').replace(/\/$/, '');
      try { return 'shop: ' + JSON.parse(fs.readFileSync(path.join('content/shop', slug + '.json'), 'utf8')).type; } catch { return 'shop: other'; }
    }
    if (/cozy|storage|bedroom|reading|nook|home|decor|small.space|declutter|organi[sz]|kitchen|living.room/.test(s)) return 'home/cozy (content)';
    if (/nail|beauty|skincare|makeup|hair|manicure|zodiac/.test(s)) return 'beauty (content)';
    if (/dog|breed|puppy|pup|canine|\bpet/.test(s)) return 'dog breeds (content)';
    return 'other (content)';
  }
  let resolved = 0;
  for (const id of Object.keys(metrics)) {
    if (map[id]) continue;
    const r = await api('GET', `/v5/pins/${id}?pin_fields=link,title,description`);
    if (r.status === 200) { map[id] = classifyByText(r.body.link, r.body.title || r.body.description); resolved++; }
    else map[id] = 'unknown';
  }
  console.log(`Resolved ${resolved} unmapped pins via API.\n`);

  // aggregate by niche over ALL known pins (metrics default 0)
  const agg = {};
  for (const [id, niche] of Object.entries(map)) {
    const m = metrics[id] || {};
    const a = agg[niche] || (agg[niche] = { pins: 0, IMPRESSION: 0, OUTBOUND_CLICK: 0, SAVE: 0, PIN_CLICK: 0 });
    a.pins++; a.IMPRESSION += m.IMPRESSION || 0; a.OUTBOUND_CLICK += m.OUTBOUND_CLICK || 0; a.SAVE += m.SAVE || 0; a.PIN_CLICK += m.PIN_CLICK || 0;
  }
  const rows = Object.entries(agg).map(([niche, a]) => ({ niche, ...a, impPer: +(a.IMPRESSION / a.pins).toFixed(1), outPer: +(a.OUTBOUND_CLICK / a.pins).toFixed(2) }))
    .sort((x, y) => y.OUTBOUND_CLICK - x.OUTBOUND_CLICK || y.IMPRESSION - x.IMPRESSION);
  console.log('NICHE                         pins   impr   outbnd  saves  clk  | imp/pin out/pin');
  for (const r of rows) console.log(`${r.niche.padEnd(28)} ${String(r.pins).padStart(4)} ${String(r.IMPRESSION).padStart(6)} ${String(r.OUTBOUND_CLICK).padStart(7)} ${String(r.SAVE).padStart(6)} ${String(r.PIN_CLICK).padStart(4)} | ${String(r.impPer).padStart(7)} ${String(r.outPer).padStart(6)}`);

  // top individual pins
  const top = Object.entries(metrics).map(([id, m]) => ({ id, niche: map[id] || 'unknown', ...m }))
    .sort((a, b) => (b.OUTBOUND_CLICK || 0) - (a.OUTBOUND_CLICK || 0) || (b.IMPRESSION || 0) - (a.IMPRESSION || 0)).slice(0, 12);
  console.log('\nTOP PINS (by outbound clicks):');
  for (const p of top) console.log(`  ${p.niche.padEnd(28)} imp:${p.IMPRESSION || 0} out:${p.OUTBOUND_CLICK || 0} save:${p.SAVE || 0} clk:${p.PIN_CLICK || 0}  (${p.id})`);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
