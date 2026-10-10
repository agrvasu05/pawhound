/**
 * 5-post-pins.js — fully automatic Pinterest posting of content (article) pins.
 *
 * Every run:
 *  1. Refreshes the access token
 *  2. Builds a queue: one not-yet-posted headline per eligible article
 *     (articles whose URL was pinned in the last 7 days are skipped)
 *  3. Renders each chosen pin ON THE FLY (scripts/pin-renderer.js) and posts it
 *     as base64 — nothing is committed to public/pins any more
 *  4. The first pin for an article goes out as a short Ken Burns video
 *  5. Tracks everything in content/posted-pins.json & content/pinterest-boards.json
 *
 * Flags:
 *   --only=<substr>   restrict to matching article slugs (manual seeding)
 *   --max=<n>         override PINS_PER_RUN
 *   --dry-run         render to /tmp and print what would be posted; no API calls
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { postVideoPin } = require('./pinterest-video');
const { renderKenBurnsFromImage } = require('./lib-video');
const { TEMPLATE_KEYS, renderPin, articleImages, templateOrder, isLive } = require('./pin-renderer');

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
let REFRESH_TOKEN = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
const API_HOST = process.env.PINTEREST_SANDBOX === 'true' ? 'api-sandbox.pinterest.com' : 'api.pinterest.com';
const DRY = process.argv.includes('--dry-run');

const SITE_URL = 'https://valuefindsdaily.com';
// Cadence (playbook rule 6 + October 2026 audit): 3–5 fresh pins per run, two
// runs a day, every day. With the product drip that lands at 6–8 fresh pins a
// day — well under the 10/day spam line and far above the 0/day of Aug–Oct.
const PINS_PER_RUN = parseInt(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1] || '3', 10);
// Dog-breed guides earned 43% of all outbound clicks in the audit and sell the
// dog wall art, but they are off the home/cozy cluster — allow at most one per
// run so the account identity stays "cozy home" while the clicks keep coming.
const MAX_DOG_PER_RUN = 1;
const TRACKER_PATH = path.join(process.cwd(), 'content', 'posted-pins.json');
const BOARDS_PATH = path.join(process.cwd(), 'content', 'pinterest-boards.json');

if (!DRY && (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN)) {
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
    const payload = isOAuth ? new URLSearchParams(body).toString() : body ? JSON.stringify(body) : null;
    const ct = isOAuth ? 'application/x-www-form-urlencoded' : 'application/json';
    const host = isOAuth ? 'api.pinterest.com' : API_HOST;
    const opts = {
      hostname: host, path: endpoint, method,
      headers: { Authorization: auth, ...(payload ? { 'Content-Type': ct, 'Content-Length': Buffer.byteLength(payload) } : {}) },
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function refreshToken() {
  console.log('Refreshing access token...');
  const res = await api('POST', '/v5/oauth/token', { grant_type: 'refresh_token', refresh_token: REFRESH_TOKEN });
  if (!res.body.access_token) {
    console.error('Refresh failed:', JSON.stringify(res.body));
    process.exit(1);
  }
  ACCESS_TOKEN = res.body.access_token;
  if (res.body.refresh_token) {
    REFRESH_TOKEN = res.body.refresh_token;
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_refresh_token=${REFRESH_TOKEN}\n`);
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

// Which article niches are allowed to be pinned. Home/cozy/decor is the account
// identity; dogs are allowed at a capped share (see MAX_DOG_PER_RUN); beauty and
// fashion never get pinned (they earned impressions but zero clicks and no sales).
const ON_NICHE = /(home|cozy|cosy|decor|interior|room|bedroom|kitchen|living|entryway|apartment|rental|small.?space|storage|declutter|clean|organi[sz]|plant|garden|nook|nest|farmhouse|boho|minimalist|printable|planner|checklist)/i;
const isDogArticle = (a) => !a.niche || a.niche === 'dogs';

const NICHE_BOARDS = {
  dogs: {
    name: 'Dog Lovers Home & Breed Guides',
    description: 'Hand-ranked dog breed guides for every kind of home — the best apartment dogs, family-friendly breeds, calm and affectionate pups — plus printable dog wall art for the people who love them. Tap any pin for the full ranked list with photos.',
  },
  home: {
    name: 'Home Decor & Cozy Living Ideas',
    description: 'Cozy home decor and small-space living ideas you can actually use — budget-friendly makeovers, bedroom and living room inspiration, smart storage, and warm, inviting styling. Tap any pin to see the full list with photos and details.',
  },
};

async function ensureBoard(name, description, key, boardsTracker) {
  if (boardsTracker[key]) return boardsTracker[key];
  if (DRY) { boardsTracker[key] = `dry-${key}`; return boardsTracker[key]; }
  console.log(`  Ensuring board: "${name}"...`);
  const res = await api('POST', '/v5/boards', { name, description, privacy: 'PUBLIC' });
  if (res.status === 401) throw new Error('Unauthorized — re-run pinterest-auth.js');
  if (res.status !== 201 && res.status !== 200) {
    const existing = await api('GET', '/v5/boards?page_size=250');
    const match = (existing.body.items || []).find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (match) { boardsTracker[key] = match.id; return match.id; }
    console.error(`  ✗ Could not create or find board "${name}"`);
    return null;
  }
  boardsTracker[key] = res.body.id;
  await new Promise((r) => setTimeout(r, 1000));
  return res.body.id;
}

// Pin each article's pins to its KEYWORD-named boards (from the trend brief),
// rotating across them; legacy articles fall back to the broad niche board.
async function getOrCreateBoard(article, boardsTracker, rotationIdx = 0) {
  const kwBoards = (article.boards || []).filter(Boolean);
  if (kwBoards.length && !isDogArticle(article)) {
    const name = kwBoards[rotationIdx % kwBoards.length].slice(0, 50);
    const phrase = corePhrase(article.topic_title);
    const desc = `${name} — hand-picked ${article.niche || ''} ideas and guides. ${phrase}: tap any pin for the full list with photos and details.`
      .replace(/\s+/g, ' ').trim().slice(0, 480);
    return ensureBoard(name, desc, `kw:${name.toLowerCase()}`, boardsTracker);
  }
  const nicheKey = isDogArticle(article) ? 'dogs' : 'home';
  const board = NICHE_BOARDS[nicheKey];
  return ensureBoard(board.name, board.description, nicheKey === 'dogs' ? 'dogs-home' : nicheKey, boardsTracker);
}

// ── Build pin queue ───────────────────────────────────────────────────────────
function buildQueue(tracker) {
  const articlesDir = path.join(process.cwd(), 'content', 'articles');
  const queue = [];
  const SPACING_DAYS = 7;
  const cutoff = Date.now() - SPACING_DAYS * 864e5;
  const slugsPostedRecently = new Set(
    Object.keys(tracker)
      .filter((k) => tracker[k].posted_at && new Date(tracker[k].posted_at).getTime() >= cutoff)
      .map((k) => k.split('/')[0])
  );
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
  let redirected = {};
  try { redirected = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'article-canonical.json'), 'utf-8')); } catch { /* none */ }

  for (const file of fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'))) {
    const article = JSON.parse(fs.readFileSync(path.join(articlesDir, file), 'utf-8'));
    const slug = article.topic_slug;
    if (redirected[slug]) continue; // duplicate guide, 301s to its canonical
    const dog = isDogArticle(article);
    if (!dog && !(article.niche && ON_NICHE.test(article.niche))) continue;
    if (onlyArg && !slug.includes(onlyArg)) continue;
    if (slugsPostedRecently.has(slug)) continue;
    if (!Array.isArray(article.pin_headlines) || !article.pin_headlines.length) continue;
    if (!articleImages(article).length) continue;

    // Candidate keys mirror the legacy on-disk names so the tracker stays
    // compatible: video-1.mp4 first (video pins outperform static), then pin-N.
    const candidates = ['video-1.mp4', ...article.pin_headlines.map((_, i) => `pin-${i + 1}.png`)];
    for (const pinFile of candidates) {
      const key = `${slug}/${pinFile}`;
      if (tracker[key]) continue;
      const isNew = !candidates.some((f) => tracker[`${slug}/${f}`]);
      queue.push({ key, slug, article, pinFile, isNew, isVideo: pinFile.endsWith('.mp4'), dog });
      break; // max 1 pin per article per run
    }
  }
  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
  return [...shuffle(queue.filter((q) => q.isNew)), ...shuffle(queue.filter((q) => !q.isNew))];
}

function corePhrase(title) { return title.replace(/^top\s+\d+\s+/i, '').trim(); }
function firstSentence(text) { const m = text.match(/^[\s\S]*?[.!?](?:\s|$)/); return (m ? m[0] : text).trim(); }

// Keyword-first description, one concrete sentence, explicit CTA, no hashtags.
function buildDescription(article) {
  const phrase = corePhrase(article.topic_title);
  const count = article.picks.length;
  const noun = article.item_noun || 'breeds';
  const dog = isDogArticle(article);
  const hook = dog
    ? `${phrase}: ${count} ${noun} ranked for real homes, with the temperament, energy and grooming notes that matter.`
    : `${phrase}: ${count} ${noun} we'd actually use, ranked from easiest to most impactful.`;
  const detail = firstSentence(article.intro);
  const cta = dog
    ? 'Tap to see the full ranked list with photos and find the breed that fits your life.'
    : 'Tap for the full list with photos, where to get each piece, and our top pick.';
  let body = `${hook} ${detail} ${cta}`;
  if (body.length > 480) body = body.slice(0, 479).trimEnd() + '…';
  return body;
}

function buildAltText(article, headline) {
  const phrase = corePhrase(article.topic_title);
  const top = article.picks.find((p) => p.rank === 1);
  const noun = article.item_noun || 'ideas';
  const alt = top
    ? `${headline}. Photo collage featuring ${top.breed}, from a ranked list of ${article.picks.length} ${noun} about ${phrase}.`
    : `${headline}. Pin image for a ranked list of ${article.picks.length} ${noun} about ${phrase}.`;
  return alt.slice(0, 480);
}

// Render the chosen pin for this article into a temp dir. Uses a pre-rendered
// public/pins file when one exists (legacy articles), else renders fresh.
async function materialize(pin, tmpDir) {
  const { article, slug, pinFile } = pin;
  const idx = pinFile.startsWith('pin-') ? parseInt(pinFile.replace('pin-', ''), 10) - 1 : 0;
  const headline = article.pin_headlines[Math.min(idx, article.pin_headlines.length - 1)];
  const legacyPng = path.join(process.cwd(), 'public', 'pins', slug, `pin-${idx + 1}.png`);
  let png = legacyPng;
  let template = 'legacy';
  if (!fs.existsSync(legacyPng)) {
    const images = articleImages(article);
    const order = templateOrder(images.length);
    const templateIdx = order[idx % order.length];
    png = path.join(tmpDir, `${slug}-pin-${idx + 1}.png`);
    await renderPin({ headline, images, output: png, templateIdx });
    template = TEMPLATE_KEYS[templateIdx];
  }
  let video = null, cover = null;
  if (pin.isVideo) {
    video = path.join(tmpDir, `${slug}-video.mp4`);
    cover = path.join(tmpDir, `${slug}-video-cover.jpg`);
    await renderKenBurnsFromImage({ imagePath: png, outPath: video, coverPath: cover });
  }
  return { headline, png, video, cover, template };
}

async function postPin(pin, boardId, m) {
  const { article, slug } = pin;
  const common = {
    board_id: boardId,
    title: article.topic_title.slice(0, 100),
    description: buildDescription(article),
    alt_text: buildAltText(article, m.headline),
    link: `${SITE_URL}/${slug}`,
  };
  if (pin.isVideo) {
    return postVideoPin({
      accessToken: ACCESS_TOKEN, apiHost: API_HOST, boardId,
      title: common.title, description: common.description, altText: common.alt_text, link: common.link,
      videoPath: m.video,
      coverImageData: fs.readFileSync(m.cover).toString('base64'), coverImageContentType: 'image/jpeg',
    });
  }
  const res = await api('POST', '/v5/pins', {
    ...common,
    media_source: { source_type: 'image_base64', content_type: 'image/png', data: fs.readFileSync(m.png).toString('base64') },
  });
  if (res.status !== 201) {
    console.error(`  Pinterest returned ${res.status}:`, JSON.stringify(res.body, null, 2));
    throw new Error(`Pinterest API error ${res.status}`);
  }
  return res.body;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  if (!DRY) await refreshToken();
  const tracker = fs.existsSync(TRACKER_PATH) ? JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf-8')) : {};
  const boardsTracker = fs.existsSync(BOARDS_PATH) ? JSON.parse(fs.readFileSync(BOARDS_PATH, 'utf-8')) : {};
  const tmpDir = DRY ? path.join(process.cwd(), 'tmp-pins') : fs.mkdtempSync(path.join(os.tmpdir(), 'pins-'));
  fs.mkdirSync(tmpDir, { recursive: true });

  const queue = buildQueue(tracker);
  if (!queue.length) { console.log('All pins have been posted!'); process.exit(0); }

  // Fill the run: cap dog guides, prefer fresh articles (queue is already ordered).
  const toPost = [];
  let dogs = 0;
  for (const q of queue) {
    if (toPost.length >= PINS_PER_RUN) break;
    if (q.dog) { if (dogs >= MAX_DOG_PER_RUN) continue; dogs++; }
    toPost.push(q);
  }
  console.log(`Queue: ${queue.length} eligible articles; posting ${toPost.length} this run${DRY ? ' (dry run)' : ''}.`);
  let posted = 0;

  for (const pin of toPost) {
    try {
      if (!DRY && !(await isLive(`${SITE_URL}/${pin.slug}`))) { console.log(`  ↷ ${pin.slug}: page not live yet — skipping`); continue; }
      const postedCount = Object.keys(tracker).filter((k) => k.startsWith(pin.slug + '/') && tracker[k].posted_at).length;
      const boardId = await getOrCreateBoard(pin.article, boardsTracker, postedCount);
      if (!boardId) continue;
      const m = await materialize(pin, tmpDir);
      console.log(`${DRY ? '(dry) ' : ''}Posting: ${pin.article.topic_title} — ${pin.pinFile} [${m.template}]${pin.isVideo ? ' (video)' : ''}`);
      if (DRY) { console.log(`  rendered ${m.png}${m.video ? ' + ' + m.video : ''}`); continue; }
      const result = await postPin(pin, boardId, m);
      tracker[pin.key] = {
        pin_id: result.id, board_id: boardId, template: m.template,
        posted_at: new Date().toISOString(), url: `https://pinterest.com/pin/${result.id}`,
      };
      posted++;
      console.log(`  ✓ https://pinterest.com/pin/${result.id}`);
      await new Promise((r) => setTimeout(r, 8000 + Math.floor(Math.random() * 20000)));
    } catch (err) {
      console.error(`  ✗ ${pin.key}: ${err.message}`);
    } finally {
      if (!DRY) for (const f of fs.readdirSync(tmpDir)) { try { fs.unlinkSync(path.join(tmpDir, f)); } catch { /* ignore */ } }
    }
  }

  if (!DRY) {
    fs.writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2));
    fs.writeFileSync(BOARDS_PATH, JSON.stringify(boardsTracker, null, 2));
  }
  console.log(`\n✅ ${posted}/${toPost.length} pins posted this run.`);
})();
