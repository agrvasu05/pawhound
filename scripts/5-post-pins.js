/**
 * 5-post-pins.js — fully automatic Pinterest posting
 *
 * Every run:
 *  1. Refreshes access token
 *  2. For each article, auto-creates a Pinterest board if one doesn't exist yet
 *  3. Posts 3 pins (spread across articles) to their matching boards
 *  4. Tracks everything in content/posted-pins.json & content/pinterest-boards.json
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const https = require('https');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
let REFRESH_TOKEN = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;

// Set PINTEREST_SANDBOX=true in .env.local to use sandbox for demo/testing
const API_HOST = process.env.PINTEREST_SANDBOX === 'true'
  ? 'api-sandbox.pinterest.com'
  : 'api.pinterest.com';

const SITE_URL = 'https://valuefindsdaily.com';
const PINS_PER_RUN = 3;
const TRACKER_PATH = path.join(process.cwd(), 'content', 'posted-pins.json');
const BOARDS_PATH = path.join(process.cwd(), 'content', 'pinterest-boards.json');

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error('Missing Pinterest credentials. Run scripts/pinterest-auth.js first.');
  process.exit(1);
}

// ── API ───────────────────────────────────────────────────────────────────────
function api(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const isOAuth = endpoint === '/v5/oauth/token';
    const auth = isOAuth
      ? 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
      : `Bearer ${ACCESS_TOKEN}`;
    const payload = isOAuth
      ? new URLSearchParams(body).toString()
      : body ? JSON.stringify(body) : null;
    const ct = isOAuth ? 'application/x-www-form-urlencoded' : 'application/json';

    // OAuth token refresh always hits production — sandbox has no token store
    const host = isOAuth ? 'api.pinterest.com' : API_HOST;
    const opts = {
      hostname: host,
      path: endpoint,
      method,
      headers: {
        Authorization: auth,
        ...(payload ? { 'Content-Type': ct, 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Token refresh ─────────────────────────────────────────────────────────────
async function refreshToken() {
  console.log('Refreshing access token...');
  const res = await api('POST', '/v5/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
  });
  if (!res.body.access_token) {
    console.error('Refresh failed:', JSON.stringify(res.body));
    process.exit(1);
  }
  ACCESS_TOKEN = res.body.access_token;
  if (res.body.refresh_token) {
    REFRESH_TOKEN = res.body.refresh_token;
    // Output for GitHub Actions secret rotation
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_refresh_token=${REFRESH_TOKEN}\n`);
    }
    // Update .env.local locally
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      let env = fs.readFileSync(envPath, 'utf-8');
      env = env.replace(/^PINTEREST_REFRESH_TOKEN=.*$/m, `PINTEREST_REFRESH_TOKEN=${REFRESH_TOKEN}`);
      env = env.replace(/^PINTEREST_ACCESS_TOKEN=.*$/m, `PINTEREST_ACCESS_TOKEN=${ACCESS_TOKEN}`);
      fs.writeFileSync(envPath, env);
    }
  }
  console.log('✓ Token refreshed.');
}

// ── Auto-create board for an article ─────────────────────────────────────────
async function getOrCreateBoard(article, boardsTracker) {
  const slug = article.topic_slug;
  if (boardsTracker[slug]) return boardsTracker[slug];

  console.log(`  Creating board: "${article.topic_title}"...`);
  const res = await api('POST', '/v5/boards', {
    name: article.topic_title,
    description: article.intro.slice(0, 500),
    privacy: 'PUBLIC',
  });

  if (res.status === 401) {
    console.error('  Board creation 401:', JSON.stringify(res.body, null, 2));
    throw new Error('Unauthorized — re-run pinterest-auth.js');
  }

  if (res.status !== 201 && res.status !== 200) {
    // Board might already exist with same name — try to find it
    console.log(`  Board creation returned ${res.status}, checking existing boards...`);
    const existing = await api('GET', '/v5/boards?page_size=50');
    const match = (existing.body.items || []).find(
      (b) => b.name.toLowerCase() === article.topic_title.toLowerCase()
    );
    if (match) {
      boardsTracker[slug] = match.id;
      return match.id;
    }
    console.error(`  ✗ Could not create or find board for "${article.topic_title}"`);
    return null;
  }

  const boardId = res.body.id;
  boardsTracker[slug] = boardId;
  console.log(`  ✓ Board created (${boardId})`);
  await new Promise((r) => setTimeout(r, 1000)); // avoid rate limit
  return boardId;
}

// ── Build pin queue ───────────────────────────────────────────────────────────
function buildQueue(tracker) {
  const articlesDir = path.join(process.cwd(), 'content', 'articles');
  const pinsDir = path.join(process.cwd(), 'public', 'pins');
  const queue = [];

  for (const file of fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'))) {
    const article = JSON.parse(fs.readFileSync(path.join(articlesDir, file), 'utf-8'));
    const slug = article.topic_slug;
    const pinFolder = path.join(pinsDir, slug);
    if (!fs.existsSync(pinFolder)) continue;

    const pinFiles = fs.readdirSync(pinFolder)
      .filter((f) => f.endsWith('.png'))
      .sort((a, b) => {
        const n = (s) => parseInt(s.replace('pin-', '').replace('.png', ''));
        return n(a) - n(b);
      });

    for (const pinFile of pinFiles) {
      const key = `${slug}/${pinFile}`;
      if (tracker[key]) continue;
      queue.push({ key, slug, article, pinFile });
    }
  }

  // Spread across articles — don't post 3 pins from the same article
  return queue.sort(() => Math.random() - 0.5);
}

function buildDescription(article) {
  const desc = article.intro.slice(0, 400);
  const tags = getHashtags(article.topic_slug, article.topic_title);
  return `${desc}\n\n${tags}`;
}

function getHashtags(slug, title) {
  const base = ['#dogs', '#dogbreeds', '#doglovers', '#puppylove', '#dogsofpinterest'];
  const t = title.toLowerCase();
  if (t.includes('apartment') || t.includes('small')) base.push('#apartmentdogs', '#smalldogs');
  if (t.includes('active') || t.includes('running')) base.push('#activedogs', '#runningwithdogs');
  if (t.includes('fluffy')) base.push('#fluffydogs', '#fluffypuppy');
  if (t.includes('family')) base.push('#familydogs', '#dogsandkids');
  if (t.includes('smart') || t.includes('intellig')) base.push('#smartdogs');
  if (t.includes('loyal')) base.push('#loyaldogs');
  if (t.includes('support') || t.includes('therapy')) base.push('#emotionalsupportdog');
  if (t.includes('senior')) base.push('#dogsforseniors');
  if (t.includes('guard') || t.includes('watch')) base.push('#guarddogs');
  if (t.includes('rare')) base.push('#raredogs', '#uniquebreeds');
  if (t.includes('shed') || t.includes('hypo')) base.push('#hypoallergenicdogs');
  if (t.includes('cold') || t.includes('weather')) base.push('#coldweatherdogs');
  if (t.includes('calm') || t.includes('quiet')) base.push('#calmdog', '#quietdogs');
  return base.slice(0, 8).join(' ');
}

// ── Post one pin ──────────────────────────────────────────────────────────────
async function postPin(pin, boardId) {
  const { article, pinFile, slug } = pin;

  const res = await api('POST', '/v5/pins', {
    board_id: boardId,
    title: article.topic_title,
    description: buildDescription(article),
    link: `${SITE_URL}/${slug}`,
    media_source: {
      source_type: 'image_url',
      url: `${SITE_URL}/pins/${slug}/${pinFile}`,
    },
  });

  // Log the full response so we can see exactly what Pinterest returns
  if (res.status !== 201) {
    console.error(`  Pinterest returned ${res.status}:`, JSON.stringify(res.body, null, 2));
    throw new Error(`Pinterest API error ${res.status}`);
  }

  return res.body;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  // Always refresh — access tokens expire, refresh token keeps it alive
  await refreshToken();

  const tracker = fs.existsSync(TRACKER_PATH)
    ? JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf-8'))
    : {};
  const boardsTracker = fs.existsSync(BOARDS_PATH)
    ? JSON.parse(fs.readFileSync(BOARDS_PATH, 'utf-8'))
    : {};

  const queue = buildQueue(tracker);

  if (queue.length === 0) {
    console.log('All pins have been posted!');
    process.exit(0);
  }

  const toPost = queue.slice(0, PINS_PER_RUN);
  let posted = 0;

  for (const pin of toPost) {
    try {
      // Auto-create board for this article if needed
      const boardId = await getOrCreateBoard(pin.article, boardsTracker);
      if (!boardId) continue;

      console.log(`Posting: ${pin.article.topic_title} — ${pin.pinFile}`);
      const result = await postPin(pin, boardId);

      tracker[pin.key] = {
        pin_id: result.id,
        board_id: boardId,
        posted_at: new Date().toISOString(),
        url: `https://pinterest.com/pin/${result.id}`,
      };
      posted++;
      console.log(`  ✓ https://pinterest.com/pin/${result.id}`);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  ✗ ${pin.key}: ${err.message}`);
    }
  }

  // Save trackers
  fs.writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2));
  fs.writeFileSync(BOARDS_PATH, JSON.stringify(boardsTracker, null, 2));

  console.log(`\n✅ ${posted}/${toPost.length} pins posted.`);
  console.log(`   ${queue.length - PINS_PER_RUN} pins remaining in queue.`);
})();
