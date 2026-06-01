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
// Safe limits: 5-10/day for new accounts, ramp up after 3 months of good standing
const PINS_PER_RUN = 10;
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

  // Pinterest board names max 50 characters
  const boardName = article.topic_title.length > 50
    ? article.topic_title.slice(0, 47) + '...'
    : article.topic_title;

  // Keyword-rich board description (boards are themselves searchable on Pinterest).
  const phrase = corePhrase(article.topic_title);
  const noun = article.item_noun || 'breeds';
  const boardDesc = (
    `${phrase}: our hand-ranked guide to the best ${noun}. ` +
    firstSentence(article.intro)
  ).slice(0, 500);

  console.log(`  Creating board: "${boardName}"...`);
  const res = await api('POST', '/v5/boards', {
    name: boardName,
    description: boardDesc,
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

  const today = new Date().toISOString().slice(0, 10); // "2026-05-27"

  // Slugs already posted today — Pinterest flags multiple pins to same URL same day
  const slugsPostedToday = new Set(
    Object.keys(tracker)
      .filter((k) => tracker[k].posted_at && tracker[k].posted_at.startsWith(today))
      .map((k) => k.split('/')[0])
  );

  // Optional --only=<substr> filter to post just matching article(s) (manual seeding)
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

  for (const file of fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'))) {
    const filePath = path.join(articlesDir, file);
    const article = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const slug = article.topic_slug;
    if (onlyArg && !slug.includes(onlyArg)) continue;
    const pinFolder = path.join(pinsDir, slug);
    if (!fs.existsSync(pinFolder)) continue;

    // Skip if we already posted from this article today
    if (slugsPostedToday.has(slug)) continue;

    const allPins = fs.readdirSync(pinFolder).filter((f) => f.endsWith('.png'));
    const pinFiles = allPins
      .sort((a, b) => {
        const n = (s) => parseInt(s.replace('pin-', '').replace('.png', ''));
        return n(a) - n(b);
      });

    for (const pinFile of pinFiles) {
      const key = `${slug}/${pinFile}`;
      if (tracker[key]) continue;
      // brand-new article = none of its pins posted yet → seed these first
      const isNew = !allPins.some((f) => tracker[`${slug}/${f}`]);
      queue.push({ key, slug, article, pinFile, isNew });
      break; // max 1 pin per article per day — prevents same-URL spam flag
    }
  }

  // Prioritize brand-new articles (so fresh topics/niches get seeded fast),
  // then shuffle within each group to rotate across articles each day.
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
  return [
    ...shuffle(queue.filter((q) => q.isNew)),
    ...shuffle(queue.filter((q) => !q.isNew)),
  ];
}

// Strip the "Top N " prefix to recover the core, searchable phrase people type
// into Pinterest, e.g. "Top 8 Best Apartment Dogs" -> "Best Apartment Dogs".
function corePhrase(title) {
  return title.replace(/^top\s+\d+\s+/i, "").trim();
}

// First complete sentence of a block of text (keeps descriptions specific).
function firstSentence(text) {
  const m = text.match(/^[\s\S]*?[.!?](?:\s|$)/);
  return (m ? m[0] : text).trim();
}

// Pinterest descriptions: ranked on KEYWORDS in natural prose (not hashtags),
// and clicks come from an explicit call-to-action. So we front-load the exact
// search phrase + a benefit, add one specific real sentence, then a clear CTA,
// and finish with a few targeted hashtags.
function buildDescription(article) {
  const phrase = corePhrase(article.topic_title); // e.g. "Best Apartment Dogs"
  const count = article.picks.length;
  const noun = article.item_noun || "breeds";
  const isDogs = (article.niche || "dogs") === "dogs";

  // Keyword-rich opener (the first ~60 chars show in feeds, so lead with it).
  const hook = `${phrase} — we ranked the top ${count} ${noun} to help you choose with confidence.`;

  // One concrete sentence from the article for substance + extra keywords.
  const detail = firstSentence(article.intro);

  // Explicit CTA — this is the lever that turns impressions into outbound clicks.
  const cta = isDogs
    ? `👉 Tap to see the full ranked list with photos and find your perfect match.`
    : `👉 Tap to see the full list with photos, details, and our top pick.`;

  const tags = getHashtags(article.topic_slug, article.topic_title, article.niche);

  // Cap at Pinterest's 500-char limit, leaving room for the hashtag line.
  let body = `${hook} ${detail} ${cta}`;
  const maxBody = 495 - (tags.length + 2);
  if (body.length > maxBody) body = body.slice(0, maxBody - 1).trimEnd() + "…";
  return `${body}\n\n${tags}`;
}

function getHashtags(slug, title, niche) {
  const t = title.toLowerCase();

  // Specific, title-derived tags rank better than generic ones, so they go
  // FIRST and we keep just ~5 total (Pinterest deprioritizes hashtag spam).
  const specific = [];
  const dedupe = (generic) =>
    [...new Set([...specific, ...generic])].slice(0, 5).join(' ');

  // Non-dog niches: use niche-appropriate tags + a few title-derived ones.
  if (niche && niche !== 'dogs') {
    if (niche === 'home') {
      if (t.includes('small') || t.includes('apartment')) specific.push('#smallspaces', '#apartmenttherapy');
      if (t.includes('organi')) specific.push('#homeorganization', '#organizationideas');
      if (t.includes('budget') || t.includes('cheap') || t.includes('diy')) specific.push('#budgetdecor', '#diyhome');
      if (t.includes('bedroom')) specific.push('#bedroomdecor', '#bedroomideas');
      if (t.includes('kitchen')) specific.push('#kitchendecor', '#kitchenideas');
      if (t.includes('living')) specific.push('#livingroomdecor');
      if (t.includes('cozy') || t.includes('cosy')) specific.push('#cozyhome', '#cozyvibes');
      if (t.includes('rental') || t.includes('renter')) specific.push('#rentaldecor');
      return dedupe(['#homedecor', '#homeideas', '#interiordesign', '#homeinspo']);
    }
    // Generic fallback for any future niche
    return ['#pinterestideas', '#inspiration', '#trending'].join(' ');
  }

  if (t.includes('apartment') || t.includes('small')) specific.push('#apartmentdogs', '#smalldogs');
  if (t.includes('active') || t.includes('running')) specific.push('#activedogs', '#runningwithdogs');
  if (t.includes('fluffy')) specific.push('#fluffydogs', '#fluffypuppy');
  if (t.includes('family')) specific.push('#familydogs', '#dogsandkids');
  if (t.includes('smart') || t.includes('intellig')) specific.push('#smartdogs');
  if (t.includes('loyal')) specific.push('#loyaldogs');
  if (t.includes('support') || t.includes('therapy')) specific.push('#emotionalsupportdog');
  if (t.includes('senior')) specific.push('#dogsforseniors');
  if (t.includes('guard') || t.includes('watch')) specific.push('#guarddogs');
  if (t.includes('rare')) specific.push('#raredogs', '#uniquebreeds');
  if (t.includes('shed') || t.includes('hypo')) specific.push('#hypoallergenicdogs');
  if (t.includes('cold') || t.includes('weather')) specific.push('#coldweatherdogs');
  if (t.includes('calm') || t.includes('quiet')) specific.push('#calmdog', '#quietdogs');
  return dedupe(['#dogbreeds', '#dogsofpinterest', '#doglovers']);
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
      await new Promise((r) => setTimeout(r, 5000)); // 5s between pins — avoids spam detection
    } catch (err) {
      console.error(`  ✗ ${pin.key}: ${err.message}`);
    }
  }

  // Save trackers
  fs.writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2));
  fs.writeFileSync(BOARDS_PATH, JSON.stringify(boardsTracker, null, 2));

  // Count TOTAL unposted pin images across all articles (queue caps at 1/article)
  const pinsDir = path.join(process.cwd(), 'public', 'pins');
  let totalPins = 0;
  let postedPins = 0;
  for (const slug of fs.readdirSync(pinsDir)) {
    const folder = path.join(pinsDir, slug);
    if (!fs.statSync(folder).isDirectory()) continue;
    for (const f of fs.readdirSync(folder).filter((x) => x.endsWith('.png'))) {
      totalPins++;
      if (tracker[`${slug}/${f}`]) postedPins++;
    }
  }

  console.log(`\n✅ ${posted}/${toPost.length} pins posted this run.`);
  console.log(`   ${postedPins}/${totalPins} total pins posted — ${totalPins - postedPins} remaining.`);
})();
