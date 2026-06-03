/**
 * pin-audit.js — audits the live Pinterest account. Lists every pin with its
 * lifetime impressions/saves/clicks and flags:
 *   DEAD     — old enough to have ranked (>= --min-age days) but ~zero engagement
 *   OFFNICHE — dog/pet pins (we're pivoting to fashion/home/beauty/etc.)
 *
 * Safe by default (report only). Pass --delete to remove flagged DEAD pins
 * (optionally --delete-offniche too). Pins take 4-6 weeks to rank, so the age
 * gate avoids deleting pins that simply haven't ramped yet.
 *
 *   node products/pin-audit.js                  # report
 *   node products/pin-audit.js --delete         # delete DEAD pins
 *   node products/pin-audit.js --delete --delete-offniche
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');

const CID = process.env.PINTEREST_CLIENT_ID, CS = process.env.PINTEREST_CLIENT_SECRET, RT = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS;
const MIN_AGE = parseInt((process.argv.find((a) => a.startsWith('--min-age=')) || '').split('=')[1] || '21');
const DO_DELETE = process.argv.includes('--delete');
const DEL_OFFNICHE = process.argv.includes('--delete-offniche');
const DOG_RE = /\b(dog|dogs|puppy|puppies|pet|pets|breed|breeds|canine)\b/i;

function api(method, endpoint) {
  return new Promise((resolve, reject) => {
    const isOAuth = endpoint === '/v5/oauth/token';
    const auth = isOAuth ? 'Basic ' + Buffer.from(`${CID}:${CS}`).toString('base64') : `Bearer ${ACCESS}`;
    const payload = isOAuth ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: RT }).toString() : null;
    const opts = { hostname: 'api.pinterest.com', path: endpoint, method, headers: { Authorization: auth, ...(payload ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) } : {}) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}
const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);

async function listAllPins() {
  const pins = []; let bookmark = '';
  do {
    const r = await api('GET', `/v5/pins?page_size=100${bookmark ? `&bookmark=${bookmark}` : ''}`);
    if (r.status !== 200) { console.error('list pins error', JSON.stringify(r.body).slice(0, 200)); break; }
    pins.push(...(r.body.items || []));
    bookmark = r.body.bookmark || '';
  } while (bookmark);
  return pins;
}

async function pinMetrics(id, createdAt) {
  const start = ymd(new Date(Math.max(new Date(createdAt).getTime(), Date.now() - 89 * 864e5)));
  const end = ymd(new Date());
  const r = await api('GET', `/v5/pins/${id}/analytics?start_date=${start}&end_date=${end}&metric_types=IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK`);
  const sum = { IMPRESSION: 0, SAVE: 0, PIN_CLICK: 0, OUTBOUND_CLICK: 0 };
  if (r.status === 200) {
    const daily = (r.body.all && r.body.all.daily_metrics) || [];
    for (const d of daily) for (const k of Object.keys(sum)) sum[k] += (d.metrics && d.metrics[k]) || 0;
  }
  return sum;
}

(async () => {
  const t = await api('POST', '/v5/oauth/token'); ACCESS = t.body.access_token;
  if (!ACCESS) { console.error('auth failed'); process.exit(1); }

  const pins = await listAllPins();
  console.log(`Found ${pins.length} pins on the account.\n`);
  const dead = [], offniche = [], healthy = [];
  for (const p of pins) {
    const age = daysAgo(p.created_at);
    const text = `${p.title || ''} ${p.description || ''} ${p.alt_text || ''}`;
    const m = await pinMetrics(p.id, p.created_at);
    const eng = m.IMPRESSION + m.SAVE + m.PIN_CLICK + m.OUTBOUND_CLICK;
    const isDead = age >= MIN_AGE && m.IMPRESSION <= 2 && m.SAVE === 0 && m.OUTBOUND_CLICK === 0;
    const isOff = DOG_RE.test(text);
    if (isDead) dead.push({ p, m, age });
    else if (isOff) offniche.push({ p, m, age });
    else healthy.push({ p, m, age });
    await new Promise((r) => setTimeout(r, 250));
  }

  const line = (x) => `   ${x.p.id} | ${x.age}d | imp ${x.m.IMPRESSION} save ${x.m.SAVE} out ${x.m.OUTBOUND_CLICK} | ${(x.p.title || '(no title)').slice(0, 50)}`;
  console.log(`🟢 Healthy / too-new (${healthy.length})`);
  console.log(`🟠 Off-niche dog/pet (${offniche.length})`); offniche.forEach((x) => console.log(line(x)));
  console.log(`🔴 DEAD — ${MIN_AGE}d+ with ~zero engagement (${dead.length})`); dead.forEach((x) => console.log(line(x)));

  if (DO_DELETE) {
    const toDelete = [...dead, ...(DEL_OFFNICHE ? offniche : [])];
    console.log(`\nDeleting ${toDelete.length} pins...`);
    for (const x of toDelete) {
      const r = await api('DELETE', `/v5/pins/${x.p.id}`);
      console.log(`   ${r.status === 204 ? '✓ deleted' : '✗ ' + r.status} ${x.p.id}`);
      await new Promise((r) => setTimeout(r, 300));
    }
  } else {
    console.log(`\n(report only — re-run with --delete to remove DEAD pins${DEL_OFFNICHE ? '' : ', add --delete-offniche for dog pins'})`);
  }
})();
