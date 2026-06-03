/**
 * analytics-report.js — weekly Pinterest analytics pull + automatic diagnosis
 * using the strategy doc's decision rules. Writes content/pinterest-report.md.
 *
 *   High saves, low clicks   -> good concept, weak headline/CTA
 *   High clicks, low sales   -> landing page / offer problem
 *   High impressions, low saves -> creative too generic
 *   High conversions         -> clone the angle into variants
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');
const fs = require('fs');
const path = require('path');

const CID = process.env.PINTEREST_CLIENT_ID, CS = process.env.PINTEREST_CLIENT_SECRET, RT = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS;
function api(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const isOAuth = endpoint === '/v5/oauth/token';
    const auth = isOAuth ? 'Basic ' + Buffer.from(`${CID}:${CS}`).toString('base64') : `Bearer ${ACCESS}`;
    const payload = isOAuth ? new URLSearchParams(body).toString() : body ? JSON.stringify(body) : null;
    const opts = { hostname: 'api.pinterest.com', path: endpoint, method, headers: { Authorization: auth, ...(payload ? { 'Content-Type': isOAuth ? 'application/x-www-form-urlencoded' : 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}
const ymd = (d) => d.toISOString().slice(0, 10);

(async () => {
  const t = await api('POST', '/v5/oauth/token', { grant_type: 'refresh_token', refresh_token: RT });
  ACCESS = t.body.access_token;
  if (!ACCESS) { console.error('Pinterest auth failed:', JSON.stringify(t.body)); process.exit(1); }

  const end = new Date(); const start = new Date(Date.now() - 30 * 864e5);
  const metrics = 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK';
  const r = await api('GET', `/v5/user_account/analytics?start_date=${ymd(start)}&end_date=${ymd(end)}&metric_types=${metrics}`);

  let md = `# Pinterest weekly report — ${ymd(end)}\n\n`;
  if (r.status !== 200) {
    md += `⚠️ Analytics not available (HTTP ${r.status}). Likely the app needs the analytics read scope.\n\n\`\`\`\n${JSON.stringify(r.body).slice(0, 400)}\n\`\`\`\n`;
    console.log(md);
    fs.mkdirSync(path.join(process.cwd(), 'content'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'content', 'pinterest-report.md'), md);
    return;
  }

  // Sum daily metrics across the 30-day window.
  const daily = (r.body.all && r.body.all.daily_metrics) || [];
  const sum = { IMPRESSION: 0, SAVE: 0, PIN_CLICK: 0, OUTBOUND_CLICK: 0 };
  for (const d of daily) for (const k of Object.keys(sum)) sum[k] += (d.metrics && d.metrics[k]) || 0;

  const imp = sum.IMPRESSION, saves = sum.SAVE, clicks = sum.PIN_CLICK, out = sum.OUTBOUND_CLICK;
  const saveRate = imp ? (saves / imp) * 100 : 0;
  const clickRate = imp ? (out / imp) * 100 : 0;

  md += `**Last 30 days**\n\n`;
  md += `| Impressions | Saves | Pin clicks | Outbound clicks | Save rate | Outbound CTR |\n|---|---|---|---|---|---|\n`;
  md += `| ${imp} | ${saves} | ${clicks} | ${out} | ${saveRate.toFixed(2)}% | ${clickRate.toFixed(2)}% |\n\n`;

  md += `**Diagnosis (strategy decision rules)**\n\n`;
  const notes = [];
  if (imp > 0 && saveRate < 0.5) notes.push('- 🟠 **High impressions, low saves** → creative too generic. Try stronger/aesthetic hooks and scene mockups.');
  if (saves > 0 && clickRate < 0.3 && saveRate >= 0.5) notes.push('- 🟠 **Saves OK but low outbound clicks** → weak headline/CTA. Push the "Tap to shop" angle and benefit-led titles.');
  if (clickRate >= 0.5) notes.push('- 🟢 **Healthy outbound CTR** → clone the winning angles into more variants.');
  if (imp < 500) notes.push('- ℹ️ Impressions still low — new-account ramp. Keep consistent daily posting; this compounds over 6–12 weeks.');
  if (!notes.length) notes.push('- Metrics look balanced. Keep dripping fresh variants of top performers.');
  md += notes.join('\n') + '\n';

  console.log(md);
  fs.mkdirSync(path.join(process.cwd(), 'content'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'content', 'pinterest-report.md'), md);
})();
