/**
 * 6-template-feedback.js — the kill/scale creative feedback loop
 * (playbook rule 10, content/pinterest-playbook-2026.md).
 *
 * Joins posted article pins (content/posted-pins.json) to their creative
 * template (public/pins/<slug>/manifest.json, written by 4-generate-pins.js)
 * and to Pinterest per-pin analytics, then aggregates per template:
 *
 *   verdict 'kill'  — ≥ MIN_IMPR impressions, save rate < 0.2% AND outbound
 *                     rate < 0.5% (a template that saves poorly but CLICKS
 *                     well stays alive — templates 1-5 are click-optimized)
 *   verdict 'scale' — save rate ≥ 0.5% OR outbound rate ≥ 1%
 *   verdict 'neutral' / 'insufficient' otherwise
 *
 * Output: content/template-performance.json — consumed by 4-generate-pins.js,
 * which drops killed templates from the rotation and fronts scaled ones.
 * Runs weekly via weekly-pinterest-report.yml. Pins generated before manifests
 * existed simply aren't attributed (clean cold start).
 *
 *   node scripts/6-template-feedback.js [days]   (default 90)
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');
const fs = require('fs');
const path = require('path');

const CID = process.env.PINTEREST_CLIENT_ID, CS = process.env.PINTEREST_CLIENT_SECRET, RT = process.env.PINTEREST_REFRESH_TOKEN;
const DAYS = parseInt(process.argv[2] || '90', 10);
const MIN_IMPR = 300; // minimum evidence before judging a template
const OUT = path.join(process.cwd(), 'content', 'template-performance.json');
let ACCESS;

function api(method, endpoint) {
  return new Promise((resolve, reject) => {
    const oauth = endpoint === '/v5/oauth/token';
    const auth = oauth ? 'Basic ' + Buffer.from(`${CID}:${CS}`).toString('base64') : `Bearer ${ACCESS}`;
    const payload = oauth ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: RT }).toString() : null;
    const opts = { hostname: 'api.pinterest.com', path: endpoint, method, headers: { Authorization: auth, ...(payload ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) } : {}) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}
const ymd = (d) => d.toISOString().slice(0, 10);

// pin_id -> template key, via posted-pins tracker + per-article manifests.
function buildPinTemplateMap() {
  const map = {};
  let posted = {};
  try { posted = JSON.parse(fs.readFileSync('content/posted-pins.json', 'utf8')); } catch { return map; }
  const manifests = {}; // slug -> {file: templateKey}
  for (const [key, v] of Object.entries(posted)) {
    if (!v || !v.pin_id) continue;
    const [slug, file] = [key.split('/')[0], key.split('/')[1]];
    if (!(slug in manifests)) {
      try { manifests[slug] = JSON.parse(fs.readFileSync(path.join('public', 'pins', slug, 'manifest.json'), 'utf8')); }
      catch { manifests[slug] = null; }
    }
    const tpl = manifests[slug] && manifests[slug][file];
    if (tpl) map[v.pin_id] = tpl;
  }
  return map;
}

(async () => {
  const t = await api('POST', '/v5/oauth/token');
  ACCESS = t.body.access_token;
  if (!ACCESS) { console.error('Pinterest auth failed:', JSON.stringify(t.body).slice(0, 200)); process.exit(1); }

  const pinToTemplate = buildPinTemplateMap();
  const attributed = Object.keys(pinToTemplate).length;
  console.log(`${attributed} posted pins attributed to templates. Window: ${DAYS}d.`);

  // Per-pin metrics via top_pins (4 calls × up to 50 pins — plenty at this
  // account size; unattributed pins are simply ignored).
  const end = new Date(), start = new Date(Date.now() - DAYS * 864e5);
  const metrics = {}; // pin_id -> {IMPRESSION, SAVE, OUTBOUND_CLICK}
  for (const sort of ['IMPRESSION', 'SAVE', 'OUTBOUND_CLICK', 'PIN_CLICK']) {
    const r = await api('GET', `/v5/user_account/analytics/top_pins?start_date=${ymd(start)}&end_date=${ymd(end)}&metric_types=IMPRESSION,SAVE,OUTBOUND_CLICK&sort_by=${sort}&num_of_pins=50`);
    if (r.status !== 200) { console.error(`top_pins(${sort}) HTTP ${r.status}:`, JSON.stringify(r.body).slice(0, 150)); continue; }
    for (const p of (r.body && (r.body.pins || r.body.data)) || []) {
      const id = p.pin_id || p.id;
      const m = p.pin_metrics || p.metrics || p.summary_metrics || p;
      metrics[id] = metrics[id] || {};
      for (const k of ['IMPRESSION', 'SAVE', 'OUTBOUND_CLICK']) {
        const v = (m[k] && (m[k].lifetime_metrics ? m[k].lifetime_metrics[k] : m[k])) ?? m[k];
        if (typeof v === 'number') metrics[id][k] = Math.max(metrics[id][k] || 0, v);
      }
    }
  }

  // Aggregate per template.
  const agg = {}; // key -> {impressions, saves, outbound, pins}
  for (const [pinId, tpl] of Object.entries(pinToTemplate)) {
    const m = metrics[pinId];
    if (!m) continue;
    agg[tpl] = agg[tpl] || { impressions: 0, saves: 0, outbound: 0, pins: 0 };
    agg[tpl].impressions += m.IMPRESSION || 0;
    agg[tpl].saves += m.SAVE || 0;
    agg[tpl].outbound += m.OUTBOUND_CLICK || 0;
    agg[tpl].pins++;
  }

  const templates = {};
  for (const [key, a] of Object.entries(agg)) {
    const save_rate = a.impressions ? a.saves / a.impressions : 0;
    const outbound_rate = a.impressions ? a.outbound / a.impressions : 0;
    let verdict = 'neutral';
    if (a.impressions < MIN_IMPR) verdict = 'insufficient';
    else if (save_rate >= 0.005 || outbound_rate >= 0.01) verdict = 'scale';
    else if (save_rate < 0.002 && outbound_rate < 0.005) verdict = 'kill';
    templates[key] = {
      ...a,
      save_rate: +save_rate.toFixed(5),
      outbound_rate: +outbound_rate.toFixed(5),
      verdict,
    };
  }

  fs.writeFileSync(OUT, JSON.stringify({
    generated_at: new Date().toISOString(),
    window_days: DAYS,
    thresholds: { min_impressions: MIN_IMPR, kill_save_rate: 0.002, kill_outbound_rate: 0.005, scale_save_rate: 0.005, scale_outbound_rate: 0.01 },
    templates,
  }, null, 2));

  console.log(`\nTemplate performance (${Object.keys(templates).length} templates with data):`);
  for (const [k, v] of Object.entries(templates).sort((a, b) => b[1].impressions - a[1].impressions)) {
    console.log(`  ${v.verdict.padEnd(12)} ${k.padEnd(20)} impr=${v.impressions} saves=${v.saves} out=${v.outbound} (save ${(v.save_rate * 100).toFixed(2)}%, out ${(v.outbound_rate * 100).toFixed(2)}%) [${v.pins} pins]`);
  }
  if (!Object.keys(templates).length) console.log('  (none yet — manifests only cover pins generated after 2026-07-02)');
  console.log(`\nSaved ${OUT}`);
})();
