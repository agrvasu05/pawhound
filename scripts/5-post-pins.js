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
const { postVideoPin } = require('./pinterest-video');

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
let REFRESH_TOKEN = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;

// Set PINTEREST_SANDBOX=true in .env.local to use sandbox for demo/testing
const API_HOST = process.env.PINTEREST_SANDBOX === 'true'
  ? 'api-sandbox.pinterest.com'
  : 'api.pinterest.com';

const SITE_URL = 'https://valuefindsdaily.com';
// 2026 research consensus: a young account should pin ~10-15 FRESH pins per WEEK,
// not per day — spiking volume triggers spam throttling. 2 content + 1 product
// = ~3/day (~21/week). Quality + save rate matter far more than raw volume.
const PINS_PER_RUN = 2;
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

// Which article niches are allowed to be pinned. Home/cozy/decor ONLY — the
// account's reach collapsed because it pinned beauty + dogs + fashion too, so
// Pinterest could not assign it a topic. Matches the article `niche` field
// ("home", "home decor", …). Beauty/fashion/dogs are intentionally excluded.
const ON_NICHE = /(home|cozy|cosy|decor|interior|room|bedroom|kitchen|living|entryway|apartment|rental|small.?space|storage|declutter|clean|organi[sz]|plant|garden|nook|nest|farmhouse|boho|minimalist|printable|planner|checklist)/i;

// One board per NICHE (not per article). All dog pins go to the dog board and
// all home pins to the home board — fuller, keyword-rich boards rank far better
// on Pinterest than hundreds of thin single-pin boards.
const NICHE_BOARDS = {
  dogs: {
    name: 'Dog Breeds, Guides & Tips',
    description:
      'Honest, hand-ranked dog breed guides for every kind of home — the best apartment dogs, family-friendly breeds, plus the calmest, smartest, and most affectionate pups. Tap any pin to see the full ranked list with photos and find your perfect match.',
  },
  home: {
    name: 'Home Decor & Cozy Living Ideas',
    description:
      'Cozy home decor and small-space living ideas you can actually use — budget-friendly makeovers, bedroom and living room inspiration, smart storage, and warm, inviting styling. Tap any pin to see the full list with photos and details.',
  },
};

// ── Ensure a board exists (create or reuse), cached by `key` ─────────────────
async function ensureBoard(name, description, key, boardsTracker) {
  if (boardsTracker[key]) return boardsTracker[key];

  console.log(`  Ensuring board: "${name}"...`);
  const res = await api('POST', '/v5/boards', { name, description, privacy: 'PUBLIC' });

  if (res.status === 401) {
    console.error('  Board creation 401:', JSON.stringify(res.body, null, 2));
    throw new Error('Unauthorized — re-run pinterest-auth.js');
  }
  if (res.status !== 201 && res.status !== 200) {
    // Board likely already exists with this name — find and reuse it.
    console.log(`  Board creation returned ${res.status}, looking up existing board...`);
    const existing = await api('GET', '/v5/boards?page_size=250');
    const match = (existing.body.items || []).find((b) => b.name.toLowerCase() === name.toLowerCase());
    if (match) {
      boardsTracker[key] = match.id;
      console.log(`  ✓ Using existing board (${match.id})`);
      return match.id;
    }
    console.error(`  ✗ Could not create or find board "${name}"`);
    return null;
  }
  const boardId = res.body.id;
  boardsTracker[key] = boardId;
  console.log(`  ✓ Board ready (${boardId})`);
  await new Promise((r) => setTimeout(r, 1000)); // avoid rate limit
  return boardId;
}

// Megan-strategy board picker: pin each article's pins to its KEYWORD-named boards
// (from the trend brief), rotating across them so the same URL reaches several
// keyword audiences over time. Falls back to the broad niche board for legacy
// articles that have no keyword boards (avoids thin single-pin boards).
async function getOrCreateBoard(article, boardsTracker, rotationIdx = 0) {
  const kwBoards = (article.boards || []).filter(Boolean);
  if (kwBoards.length) {
    const name = kwBoards[rotationIdx % kwBoards.length].slice(0, 50);
    const phrase = corePhrase(article.topic_title);
    const desc = `${name} — hand-picked ${article.niche || ''} ideas and guides. ${phrase}: tap any pin for the full list with photos and details.`
      .replace(/\s+/g, ' ').trim().slice(0, 480);
    return ensureBoard(name, desc, `kw:${name.toLowerCase()}`, boardsTracker);
  }
  const nicheKey = article.niche === 'home' ? 'home' : article.niche || 'dogs';
  const board = NICHE_BOARDS[nicheKey] || {
    name: `${nicheKey[0].toUpperCase()}${nicheKey.slice(1)} Ideas & Guides`,
    description: `Hand-picked ${nicheKey} ideas and guides. Tap any pin to see the full list with photos.`,
  };
  return ensureBoard(board.name, board.description, nicheKey, boardsTracker);
}

// ── Build pin queue ───────────────────────────────────────────────────────────
function buildQueue(tracker) {
  const articlesDir = path.join(process.cwd(), 'content', 'articles');
  const pinsDir = path.join(process.cwd(), 'public', 'pins');
  const queue = [];

  // Megan-strategy: don't re-pin the same article URL more than once per ~week.
  // Its pins drip out spaced ~7 days apart so Pinterest tests each one and we
  // never compete with ourselves / look spammy on a young account.
  const SPACING_DAYS = 7;
  const cutoff = Date.now() - SPACING_DAYS * 864e5;
  const slugsPostedRecently = new Set(
    Object.keys(tracker)
      .filter((k) => tracker[k].posted_at && new Date(tracker[k].posted_at).getTime() >= cutoff)
      .map((k) => k.split('/')[0])
  );

  // Optional --only=<substr> filter to post just matching article(s) (manual seeding)
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

  for (const file of fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'))) {
    const filePath = path.join(articlesDir, file);
    const article = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const slug = article.topic_slug;
    // NICHE LOCK (2026-07 pivot). Only pin home/cozy/decor articles. The old guard
    // let 'beauty' (73 articles) and 'fashion' through, so every day we pinned
    // nails/makeup/hairstyle pins next to home decor across dozens of unrelated
    // boards. Pinterest could not categorize the account → 0 saves and reach
    // collapsed (5242→2673 impressions in 10 days). Pinning ONE tight niche is the
    // documented recovery (content/pinterest-playbook-2026.md). Everything not
    // home/cozy is skipped here (articles still publish for ad revenue; they just
    // never get pinned).
    if (!article.niche || !ON_NICHE.test(article.niche)) continue;
    if (onlyArg && !slug.includes(onlyArg)) continue;
    const pinFolder = path.join(pinsDir, slug);
    if (!fs.existsSync(pinFolder)) continue;

    // Skip if we posted from this article within the last ~7 days
    if (slugsPostedRecently.has(slug)) continue;

    const allPins = fs.readdirSync(pinFolder).filter((f) => f.endsWith('.png'));
    const pinFiles = allPins
      .sort((a, b) => {
        const n = (s) => parseInt(s.replace('pin-', '').replace('.png', ''));
        return n(a) - n(b);
      });
    // Video pins run ~3x the CTR / ~2x the saves of static (2026 data) — try the
    // video FIRST for each article (once posted it falls through to pin-1,
    // pin-2, ... as before). Same 1-per-article-per-day slot as static pins, so
    // this doesn't add volume — it just prioritizes the higher-performing asset.
    const allVideos = fs.readdirSync(pinFolder).filter((f) => f.endsWith('.mp4'));
    const candidates = [...allVideos, ...pinFiles];

    for (const pinFile of candidates) {
      const key = `${slug}/${pinFile}`;
      if (tracker[key]) continue;
      // brand-new article = none of its pins/videos posted yet → seed these first
      const isNew = !allPins.concat(allVideos).some((f) => tracker[`${slug}/${f}`]);
      const isVideo = pinFile.endsWith('.mp4');
      queue.push({ key, slug, article, pinFile, isNew, isVideo });
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

// Pinterest descriptions: ranked on KEYWORDS in natural prose, and clicks come
// from an explicit call-to-action. Front-load the exact search phrase (keyword
// must land within the first 50 chars) + a benefit, one specific real sentence,
// then a clear CTA. NO hashtags — dead as a ranking factor in 2025/26 (Tailwind);
// the characters are better spent on semantic keywords (see pinterest-playbook-2026.md).
function buildDescription(article) {
  const phrase = corePhrase(article.topic_title); // e.g. "Cozy Reading Nook Ideas"
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

  let body = `${hook} ${detail} ${cta}`;
  if (body.length > 480) body = body.slice(0, 479).trimEnd() + "…";
  return body;
}

// Alt text is the highest-ROI hidden field (+123% outbound clicks, Tailwind 2025):
// a LITERAL visual description of the pin image that naturally contains the
// searchable keyword phrase.
function buildAltText(article) {
  const phrase = corePhrase(article.topic_title);
  const top = article.picks.find((p) => p.rank === 1);
  const noun = article.item_noun || "ideas";
  const alt = top
    ? `${phrase}: photo collage featuring ${top.breed}, from a ranked list of ${article.picks.length} ${noun}.`
    : `${phrase} — pin image for a ranked list of ${article.picks.length} ${noun}.`;
  return alt.slice(0, 480);
}

// ── Post one pin ──────────────────────────────────────────────────────────────
async function postPin(pin, boardId) {
  const { article, pinFile, slug, isVideo } = pin;

  if (isVideo) {
    const videoPath = path.join(process.cwd(), 'public', 'pins', slug, pinFile);
    const coverFile = pinFile.replace(/\.mp4$/, '-cover.jpg');
    return postVideoPin({
      accessToken: ACCESS_TOKEN,
      apiHost: API_HOST,
      boardId,
      title: article.topic_title,
      description: buildDescription(article),
      altText: buildAltText(article),
      link: `${SITE_URL}/${slug}`,
      videoPath,
      coverImageUrl: `${SITE_URL}/pins/${slug}/${coverFile}`,
    });
  }

  const res = await api('POST', '/v5/pins', {
    board_id: boardId,
    title: article.topic_title,
    description: buildDescription(article),
    alt_text: buildAltText(article),
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
      // Rotate this article's pins across its keyword boards (Megan strategy).
      const postedCount = Object.keys(tracker).filter(
        (k) => k.startsWith(pin.slug + '/') && tracker[k].posted_at
      ).length;
      const boardId = await getOrCreateBoard(pin.article, boardsTracker, postedCount);
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
      // Randomized 8–28s gap (not a fixed cadence) — Pinterest's anti-spam guidance
      // is to "vary your actions" rather than repeat the same thing on a timer.
      await new Promise((r) => setTimeout(r, 8000 + Math.floor(Math.random() * 20000)));
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
