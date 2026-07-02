/**
 * board-hygiene.js — niche lockdown (playbook rule 5, content/pinterest-playbook-2026.md).
 *
 * Pinterest categorizes the whole ACCOUNT from its board structure; off-niche
 * boards (dogs, beauty, fashion...) dilute topical authority for the home/cozy
 * printables niche. The safe recovery per Simple Pin Media / Anastasia Blogger:
 * set off-niche boards to SECRET (never delete — deleting loses followers and
 * mass changes read as spam), a few at a time over 2-4 weeks.
 *
 * Runs daily (post-pins.yml): secrets up to MAX_PER_RUN off-niche public boards
 * per run until none remain — ~90 off-niche boards clear in ~3 weeks, inside the
 * recommended 2-4 week window. Idempotent and self-limiting.
 *
 * Flags: --dry-run   list what would change without changing it
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');

const CID = process.env.PINTEREST_CLIENT_ID, CS = process.env.PINTEREST_CLIENT_SECRET, RT = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS;
const MAX_PER_RUN = 4;
const DRY = process.argv.includes('--dry-run');

// A board is ON-niche if its name matches the home/cozy/printables cluster.
const ON_NICHE = /(home|cozy|cosy|decor|printable|planner|tracker|organiz|wall art|gallery|room|bedroom|kitchen|living|entryway|porch|storage|rental|apartment|small space|interior|clean|declutter|diy|farmhouse|boho|minimalist|checklist|bundle)/i;

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

(async () => {
  const t = await api('POST', '/v5/oauth/token', { grant_type: 'refresh_token', refresh_token: RT });
  ACCESS = t.body.access_token;
  if (!ACCESS) { console.error('Pinterest auth failed:', JSON.stringify(t.body).slice(0, 200)); process.exit(1); }

  const r = await api('GET', '/v5/boards?page_size=250&privacy=PUBLIC');
  if (r.status !== 200) { console.error(`Board list failed (${r.status}):`, JSON.stringify(r.body).slice(0, 200)); process.exit(1); }
  const boards = r.body.items || [];
  const offNiche = boards.filter((b) => !ON_NICHE.test(b.name || ''));

  console.log(`${boards.length} public boards; ${offNiche.length} off-niche remaining.`);
  if (!offNiche.length) { console.log('✅ Board cleanup complete — account is niche-locked.'); return; }

  let changed = 0;
  for (const b of offNiche.slice(0, MAX_PER_RUN)) {
    if (DRY) { console.log(`  (dry-run) would secret: "${b.name}" (${b.id})`); continue; }
    const res = await api('PATCH', `/v5/boards/${b.id}`, { privacy: 'SECRET' });
    if (res.status === 200) { console.log(`  ✓ secreted: "${b.name}"`); changed++; }
    else console.error(`  ✗ "${b.name}" failed (${res.status}): ${JSON.stringify(res.body).slice(0, 150)}`);
    await new Promise((s) => setTimeout(s, 2000));
  }
  console.log(`Done. ${changed} board(s) set to SECRET this run; ${offNiche.length - changed} to go (staggered by design).`);
})();
