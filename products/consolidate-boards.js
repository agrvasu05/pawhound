/**
 * consolidate-boards.js — collapse the board sprawl (86 boards, 60 with one
 * pin) into a small set of keyword boards. Boards are Pinterest's main topical
 * signal; a one-pin board carries none.
 *
 * For every public board NOT in KEEP: move its pins to the best-matching keyword
 * board (PATCH /v5/pins/{id} {board_id}), then delete the emptied board.
 * Pins keep their ids, stats and links — only the board changes.
 *
 *   node products/consolidate-boards.js            # dry run
 *   node products/consolidate-boards.js --apply
 *
 * Also optional: --delete-duplicates  removes pins that repeat the same
 * destination URL + image (keeps the oldest of each pair). Off by default.
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');
const fs = require('fs');
const path = require('path');

const CID = process.env.PINTEREST_CLIENT_ID, CS = process.env.PINTEREST_CLIENT_SECRET, RT = process.env.PINTEREST_REFRESH_TOKEN;
const APPLY = process.argv.includes('--apply');
const DEDUP = process.argv.includes('--delete-duplicates');
let ACCESS;

// Target boards (name → keyword regex that routes a pin here). Order matters:
// first match wins. Descriptions are written once at creation.
const TARGETS = [
  ['Dog Wall Art Printables', /dog|puppy|pup/i, 'Printable dog wall art for dog lovers — boho line art, Japandi portraits, watercolor pups and more. Instant downloads you can print at home.', /wall art|print|portrait|set/i],
  ['Dog Lovers Home & Breed Guides', /dog|puppy|breed|pet/i, 'Hand-ranked dog breed guides for every kind of home, plus pet-friendly decor and printable dog art. Tap any pin for the full list.'],
  ['Printable Planners & Trackers', /planner|tracker|checklist|schedule|budget|meal|fitness|study|wedding|habit|savings/i, 'Printable planners, trackers and checklists for a calmer, more organized life — budget, meal, cleaning, study and habit planners. Instant downloads.'],
  ['Halloween & Fall Home Decor', /halloween|fall|autumn|thanksgiving|pumpkin|wreath|spooky|primitive/i, 'Cozy fall and Halloween home decor ideas — porches, mantels, wreaths, apartment-friendly touches and printable seasonal art.'],
  ['Christmas & Holiday Decor Ideas', /christmas|holiday|winter|xmas|gift/i, 'Christmas and holiday decor ideas, gift guides and printable holiday art for a cozy home.'],
  ['Dorm & College Room Ideas', /dorm|college|student|campus/i, 'Dorm room decor, organization and study-space ideas for small college rooms — on a student budget.'],
  ['Small Apartment Organization', /storage|organiz|declutter|apartment|rental|small.?space|closet|kitchen|entryway|backpack|cubicle|office|desk/i, 'Small-space storage and organization ideas for apartments and rentals — no drilling, no big budget.'],
  ['Cozy Bedroom & Living Room Ideas', /bedroom|living|nook|reading|cozy|cosy|color|palette|farmhouse|coastal|blue|black|y2k|teen|luxur/i, 'Cozy bedroom and living room ideas — color palettes, reading nooks, budget makeovers and styling that feels like home.'],
  ['DIY Crafts & Bedazzling Ideas', /diy|craft|bedazz|bling|paint|macrame|scrap|paper|bottle|birdhouse|banner|mask/i, 'Easy DIY home crafts and bedazzling projects — light-switch covers, chargers, banners and weekend makeovers.'],
  ['Gifts for Dad & Father\'s Day', /father|dad|man cave|fishing|lake/i, 'Father\'s Day gift ideas, crafts from kids and printable art for his space.'],
  ['Printable Wall Art & Cozy Decor', /wall art|print|poster|gallery|art set|bundle/i, 'Printable wall art and cozy home decor — instant digital downloads for warm, calming spaces.'],
  ['Home Decor & Cozy Living Ideas', /./, 'Cozy home decor and small-space living ideas you can actually use — budget-friendly makeovers, room inspiration, smart storage and warm styling.'],
];
const KEEP = new Set(TARGETS.map((t) => t[0]).concat(['Free Printables', 'Free Printable Planners & Checklists', 'Cozy Home Printables']));

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listAll(endpoint) {
  const items = []; let bookmark = null;
  do {
    const r = await api('GET', `${endpoint}${endpoint.includes('?') ? '&' : '?'}page_size=100${bookmark ? `&bookmark=${bookmark}` : ''}`);
    if (r.status !== 200) throw new Error(`${endpoint} → ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    items.push(...(r.body.items || [])); bookmark = r.body.bookmark;
  } while (bookmark);
  return items;
}

function routeTarget(pin) {
  const text = `${pin.title || ''} ${pin.description || ''} ${pin.link || ''} ${pin.alt_text || ''}`;
  for (const [name, re, , extra] of TARGETS) {
    if (re.test(text) && (!extra || extra.test(text))) return name;
  }
  return TARGETS[TARGETS.length - 1][0];
}

(async () => {
  const t = await api('POST', '/v5/oauth/token', { grant_type: 'refresh_token', refresh_token: RT });
  ACCESS = t.body.access_token;
  if (!ACCESS) { console.error('Pinterest auth failed:', JSON.stringify(t.body).slice(0, 200)); process.exit(1); }

  const boards = await listAll('/v5/boards?privacy=PUBLIC');
  const byName = Object.fromEntries(boards.map((b) => [b.name.toLowerCase(), b]));
  console.log(`${boards.length} public boards; ${boards.filter((b) => !KEEP.has(b.name)).length} will be merged into ${TARGETS.length} keyword boards.`);

  async function ensureTarget(name) {
    const hit = byName[name.toLowerCase()];
    if (hit) return hit.id;
    if (!APPLY) { byName[name.toLowerCase()] = { id: `dry-${name}`, name }; return `dry-${name}`; }
    const t = TARGETS.find((x) => x[0] === name);
    const r = await api('POST', '/v5/boards', { name, description: t ? t[2] : name, privacy: 'PUBLIC' });
    if (r.status !== 201) throw new Error(`create board "${name}" → ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    byName[name.toLowerCase()] = r.body; await sleep(1500);
    return r.body.id;
  }

  const plan = {}; // target name → count
  let moved = 0, deletedBoards = 0, failures = 0;
  const seenKey = new Map(); // link|image → pin id (for optional dedup)
  const dupes = [];

  for (const b of boards) {
    const keep = KEEP.has(b.name);
    const pins = await listAll(`/v5/boards/${b.id}/pins`);
    for (const p of pins) {
      const img = p.media && p.media.images && (p.media.images['150x150'] || p.media.images.originals || {}).url;
      const key = `${p.link}|${(img || '').split('/').slice(-1)[0]}`;
      if (seenKey.has(key)) dupes.push(p); else seenKey.set(key, p.id);
      if (keep) continue;
      const target = routeTarget(p);
      plan[target] = (plan[target] || 0) + 1;
      if (!APPLY) continue;
      const targetId = await ensureTarget(target);
      const r = await api('PATCH', `/v5/pins/${p.id}`, { board_id: targetId });
      if (r.status === 200) moved++; else { failures++; console.error(`  ✗ move ${p.id} → ${target}: ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`); }
      await sleep(1200);
    }
    if (!keep && APPLY) {
      const left = await api('GET', `/v5/boards/${b.id}`);
      if (left.status === 200 && (left.body.pin_count || 0) === 0) {
        const d = await api('DELETE', `/v5/boards/${b.id}`);
        if (d.status === 204) { deletedBoards++; console.log(`  ✓ deleted empty board "${b.name}"`); }
      }
      await sleep(1500);
    }
    await sleep(300);
  }

  console.log('\nRouting plan (pins → target board):');
  for (const [k, v] of Object.entries(plan).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
  console.log(`\nDuplicate pins (same link + image): ${dupes.length}${DEDUP ? '' : ' (not deleted; pass --delete-duplicates)'}`);
  if (DEDUP && APPLY) {
    let del = 0;
    for (const p of dupes) { const r = await api('DELETE', `/v5/pins/${p.id}`); if (r.status === 204) del++; await sleep(1000); }
    console.log(`  deleted ${del} duplicate pins`);
  }
  if (APPLY) console.log(`\nMoved ${moved} pins, deleted ${deletedBoards} empty boards, ${failures} failures.`);
  else console.log('\nDry run — re-run with --apply to execute.');

  // Refresh the local board cache so the posters reuse the consolidated boards.
  if (APPLY) {
    const fresh = await listAll('/v5/boards?privacy=PUBLIC');
    const cachePath = path.join(process.cwd(), 'content', 'pinterest-boards.json');
    const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf-8')) : {};
    const ids = new Set(fresh.map((b) => b.id));
    for (const k of Object.keys(cache)) if (!ids.has(cache[k])) delete cache[k];
    for (const b of fresh) cache[`kw:${b.name.toLowerCase()}`] = b.id;
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    console.log(`Board cache refreshed (${fresh.length} boards).`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
