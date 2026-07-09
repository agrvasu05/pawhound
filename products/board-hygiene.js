/**
 * board-hygiene.js — niche lockdown (playbook rule 5, content/pinterest-playbook-2026.md).
 *
 * Pinterest categorizes the whole ACCOUNT from its board structure; off-niche
 * boards (dogs, beauty, fashion...) dilute topical authority for the home/cozy
 * printables niche.
 *
 * 2026-07-09: the original plan (PATCH board privacy → SECRET) is BLOCKED on this
 * app's access tier — Pinterest returns 403 code 29 "not permitted to access that
 * resource", so it silently no-op'd for weeks. DELETE, however, is allowed (204).
 * The bulk of the legacy off-niche boards (87) were deleted in a one-off,
 * engagement-checked pass (kept 15 off-niche boards that still earn clicks/saves).
 *
 * This daily job now only DELETES **empty** off-niche public boards (pin_count 0)
 * — an empty board has zero engagement by definition, so this can never remove a
 * board someone is saving from, and it keeps future off-niche clutter from
 * accumulating. Boards with any pins are left alone (review them manually).
 *
 * Flags: --dry-run   list what would be deleted without deleting it
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
  // Only EMPTY off-niche boards are eligible for deletion. A board with pins may
  // be earning saves/clicks (the 15 engaged off-niche boards we deliberately kept
  // all have pins) — never auto-delete those; surface them for a manual call.
  const offNiche = boards.filter((b) => !ON_NICHE.test(b.name || ''));
  const emptyOff = offNiche.filter((b) => (b.pin_count || 0) === 0);
  const withPins = offNiche.filter((b) => (b.pin_count || 0) > 0);

  console.log(`${boards.length} public boards; ${offNiche.length} off-niche (${emptyOff.length} empty → delete, ${withPins.length} with pins → keep for manual review).`);
  if (!emptyOff.length) { console.log('✅ No empty off-niche boards to clean up.'); return; }

  let deleted = 0;
  for (const b of emptyOff.slice(0, MAX_PER_RUN)) {
    if (DRY) { console.log(`  (dry-run) would delete empty: "${b.name}" (${b.id})`); continue; }
    const res = await api('DELETE', `/v5/boards/${b.id}`);
    if (res.status === 204) { console.log(`  ✓ deleted empty off-niche board: "${b.name}"`); deleted++; }
    else console.error(`  ✗ "${b.name}" failed (${res.status}): ${JSON.stringify(res.body).slice(0, 150)}`);
    await new Promise((s) => setTimeout(s, 2000));
  }
  console.log(`Done. Deleted ${deleted} empty off-niche board(s) this run; ${emptyOff.length - deleted} empty remaining.`);
})();
