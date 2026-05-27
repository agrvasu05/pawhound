/**
 * 5-post-pins.js — post 3 Pinterest pins per run
 *
 * - Reads articles from content/articles/
 * - Picks pins from public/pins/{slug}/pin-N.png  (served at valuefindsdaily.com)
 * - Tracks what has been posted in content/posted-pins.json
 * - Refreshes the access token automatically using the refresh token
 * - In GitHub Actions: outputs the new refresh token so the secret can be updated
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const https = require('https');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
const BOARD_ID = process.env.PINTEREST_BOARD_ID;
let REFRESH_TOKEN = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;

const SITE_URL = 'https://valuefindsdaily.com';
const PINS_PER_RUN = 3;
const TRACKER_PATH = path.join(process.cwd(), 'content', 'posted-pins.json');

if (!CLIENT_ID || !CLIENT_SECRET || !BOARD_ID || (!REFRESH_TOKEN && !ACCESS_TOKEN)) {
  console.error('Missing Pinterest credentials. Run scripts/pinterest-auth.js first.');
  process.exit(1);
}

// ── API helpers ───────────────────────────────────────────────────────────────
function apiRequest(method, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const isForm = endpoint === '/v5/oauth/token';
    const auth = isForm
      ? 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
      : `Bearer ${token}`;
    const payload = isForm
      ? new URLSearchParams(body).toString()
      : body ? JSON.stringify(body) : null;
    const contentType = isForm ? 'application/x-www-form-urlencoded' : 'application/json';

    const options = {
      hostname: 'api.pinterest.com',
      path: endpoint,
      method,
      headers: {
        Authorization: auth,
        ...(payload ? { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Token refresh ─────────────────────────────────────────────────────────────
async function refreshAccessToken() {
  console.log('Refreshing Pinterest access token...');
  const res = await apiRequest('POST', '/v5/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
  });

  if (!res.body.access_token) {
    console.error('Token refresh failed:', JSON.stringify(res.body));
    process.exit(1);
  }

  ACCESS_TOKEN = res.body.access_token;
  if (res.body.refresh_token) {
    REFRESH_TOKEN = res.body.refresh_token;

    // In GitHub Actions: output new refresh token for secret rotation
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_refresh_token=${REFRESH_TOKEN}\n`);
    }

    // Locally: update .env.local
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

// ── Build posting queue ───────────────────────────────────────────────────────
function buildQueue() {
  const articlesDir = path.join(process.cwd(), 'content', 'articles');
  const pinsDir = path.join(process.cwd(), 'public', 'pins');

  const tracker = fs.existsSync(TRACKER_PATH)
    ? JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf-8'))
    : {};

  const queue = [];

  for (const file of fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'))) {
    const article = JSON.parse(fs.readFileSync(path.join(articlesDir, file), 'utf-8'));
    const slug = article.topic_slug;
    const pinFolder = path.join(pinsDir, slug);

    if (!fs.existsSync(pinFolder)) continue;

    const pinFiles = fs.readdirSync(pinFolder)
      .filter((f) => f.endsWith('.png'))
      .sort((a, b) => {
        const na = parseInt(a.replace('pin-', '').replace('.png', ''));
        const nb = parseInt(b.replace('pin-', '').replace('.png', ''));
        return na - nb;
      });

    for (const pinFile of pinFiles) {
      const key = `${slug}/${pinFile}`;
      if (tracker[key]) continue; // already posted

      queue.push({
        key,
        slug,
        title: article.topic_title,
        description: buildDescription(article),
        link: `${SITE_URL}/${slug}`,
        imageUrl: `${SITE_URL}/pins/${slug}/${pinFile}`,
      });
    }
  }

  // Shuffle slightly so we don't always post from the same article
  return queue.sort(() => Math.random() - 0.5);
}

function buildDescription(article) {
  const base = article.intro.slice(0, 400);
  const hashtags = generateHashtags(article.topic_slug, article.topic_title);
  return `${base}\n\n${hashtags}`;
}

function generateHashtags(slug, title) {
  const base = ['#dogs', '#dogbreeds', '#doglovers', '#puppylove', '#dogsofpinterest'];
  const titleWords = title.toLowerCase().split(/\s+/);
  const extras = [];

  if (titleWords.some((w) => ['apartment', 'small', 'tiny'].includes(w))) extras.push('#apartmentdogs', '#smalldogs');
  if (titleWords.some((w) => ['active', 'running', 'energetic'].includes(w))) extras.push('#activedogs', '#runningwithdogs');
  if (titleWords.some((w) => ['fluffy', 'fluffiest', 'fluffy'].includes(w))) extras.push('#fluffydogs', '#fluffypuppy');
  if (titleWords.some((w) => ['family', 'kids', 'children'].includes(w))) extras.push('#familydogs', '#dogsandkids');
  if (titleWords.some((w) => ['smart', 'intelligent', 'smartest'].includes(w))) extras.push('#smartdogs', '#trainabledogs');
  if (titleWords.some((w) => ['loyal', 'loyal'].includes(w))) extras.push('#loyaldogs');
  if (titleWords.some((w) => ['emotional', 'support', 'therapy'].includes(w))) extras.push('#emotionalsupportdog', '#therapydog');
  if (titleWords.some((w) => ['senior', 'seniors', 'elderly'].includes(w))) extras.push('#dogsforseniors');
  if (titleWords.some((w) => ['guard', 'protection', 'watchdog'].includes(w))) extras.push('#guarddogs');
  if (titleWords.some((w) => ['rare', 'rarest', 'unusual'].includes(w))) extras.push('#raredogs', '#uniquedogbreeds');
  if (titleWords.some((w) => ['shed', 'shedding', 'hypoallergenic'].includes(w))) extras.push('#hypoallergenicdogs', '#noshedding');

  return [...base, ...extras].slice(0, 8).join(' ');
}

// ── Post a single pin ─────────────────────────────────────────────────────────
async function postPin(pin) {
  const res = await apiRequest('POST', '/v5/pins', {
    board_id: BOARD_ID,
    title: pin.title,
    description: pin.description,
    link: pin.link,
    media_source: {
      source_type: 'image_url',
      url: pin.imageUrl,
    },
  }, ACCESS_TOKEN);

  if (res.status !== 201) {
    // Access token might be expired — refresh and retry once
    if (res.status === 401) {
      await refreshAccessToken();
      return postPin(pin);
    }
    throw new Error(`Pinterest API ${res.status}: ${JSON.stringify(res.body)}`);
  }

  return res.body;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  // Always refresh token at the start of a GitHub Actions run
  if (process.env.CI && REFRESH_TOKEN) {
    await refreshAccessToken();
  }

  const queue = buildQueue();

  if (queue.length === 0) {
    console.log('No new pins to post — all pins have been posted already!');
    process.exit(0);
  }

  const toPost = queue.slice(0, PINS_PER_RUN);
  const tracker = fs.existsSync(TRACKER_PATH)
    ? JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf-8'))
    : {};

  let posted = 0;
  for (const pin of toPost) {
    try {
      console.log(`Posting: ${pin.title} — ${pin.imageUrl}`);
      const result = await postPin(pin);
      tracker[pin.key] = {
        pin_id: result.id,
        posted_at: new Date().toISOString(),
        url: `https://pinterest.com/pin/${result.id}`,
      };
      posted++;
      console.log(`  ✓ Posted → https://pinterest.com/pin/${result.id}`);
      // Small delay between posts to avoid rate limiting
      await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
    }
  }

  fs.writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2));
  console.log(`\n✅ Done — ${posted}/${toPost.length} pins posted.`);
  console.log(`   ${queue.length - posted} pins remaining in queue.`);
})();
