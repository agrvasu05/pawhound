/**
 * trends-engine.js — the keyword/trend-driven topic engine.
 *
 * Pulls real rising + high-volume keywords from the Pinterest Trends API across
 * our target niches, scores them by volume + growth, then has GPT turn the top
 * ones into full content briefs (article topic, pin titles/descriptions, boards,
 * product ideas, affiliate matches). Output: content/trend-briefs.json — the
 * SEED that the article/product/pin generators consume instead of random themes.
 *
 * Niches: fashion, home decor, beauty, wellness, gifts/occasions, aesthetic art,
 * digital products. Dogs are intentionally limited (only kept if clearly rising).
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

const CID = process.env.PINTEREST_CLIENT_ID, CS = process.env.PINTEREST_CLIENT_SECRET, RT = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS;
function api(method, endpoint) {
  return new Promise((resolve, reject) => {
    const isOAuth = endpoint === '/v5/oauth/token';
    const auth = isOAuth ? 'Basic ' + Buffer.from(`${CID}:${CS}`).toString('base64') : `Bearer ${ACCESS}`;
    const payload = isOAuth ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: RT }).toString() : null;
    const opts = { hostname: 'api.pinterest.com', path: endpoint, method, headers: { Authorization: auth, ...(payload ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(payload) } : {}) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}

// Pinterest interest -> our niche label.
// FOCUSED on home decor + beauty/skincare only — a young account needs ONE clear
// identity for Pinterest to build topical authority and distribute pins. (Fashion,
// wellness, gifts, aesthetic, design were dropped to stop confusing the algorithm.)
const INTERESTS = {
  home_decor: 'home decor',
  beauty: 'beauty',
};
const DOG_RE = /\b(dog|dogs|puppy|puppies|pet|pets|cat|cats|kitten)\b/i;

function recentPopularity(ts) {
  if (!ts) return 0;
  const vals = Object.keys(ts).sort().slice(-4).map((k) => ts[k] || 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

async function pullTrends() {
  const pool = new Map(); // keyword -> best record
  for (const [interest, niche] of Object.entries(INTERESTS)) {
    for (const type of ['growing', 'monthly']) {
      const r = await api('GET', `/v5/trends/keywords/US/top/${type}?interests=${interest}`);
      if (r.status !== 200) continue;
      for (const t of r.body.trends || []) {
        const kw = (t.keyword || '').trim().toLowerCase();
        if (!kw || kw.length < 3) continue;
        const mom = t.pct_growth_mom ?? 0;
        const yoy = t.pct_growth_yoy ?? 0;
        const pop = recentPopularity(t.time_series);
        // Score: current volume (0-100) + growth bonus (up to ~100). Rising + popular wins.
        const score = Math.round(pop + clamp(mom, -50, 300) / 3 + (type === 'growing' ? 10 : 0));
        // Limit dogs/pets unless clearly surging.
        if (DOG_RE.test(kw) && mom < 80) continue;
        const rec = { keyword: kw, niche, pop: Math.round(pop), mom, yoy, rising: type === 'growing', score };
        const prev = pool.get(kw);
        if (!prev || score > prev.score) pool.set(kw, rec);
      }
    }
  }
  // Keep meaningful terms: decent current volume OR a strong riser.
  return [...pool.values()]
    .filter((r) => r.pop >= 12 || r.mom >= 60)
    .sort((a, b) => b.score - a.score);
}

const BRIEF_SCHEMA = {
  name: 'trend_briefs', strict: true,
  schema: { type: 'object', additionalProperties: false, required: ['briefs'],
    properties: { briefs: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['keyword', 'keep', 'season', 'intent', 'article_topic', 'pin_titles', 'pin_descriptions', 'boards', 'product_ideas', 'affiliate_matches'],
      properties: {
        keyword: { type: 'string' },
        keep: { type: 'boolean', description: 'true only if this is a monetizable buyer topic in our niches; false for video-game/fandom/celebrity-IP/non-commercial fads we cannot sell or recommend products for' },
        season: { type: 'string', description: 'timing window, e.g. "graduation", "summer", "fall", "holiday", "evergreen"' },
        intent: { type: 'string', enum: ['high', 'medium', 'low'], description: 'buying intent of this search' },
        article_topic: { type: 'string', description: 'SEO-friendly listicle article title using the keyword' },
        pin_titles: { type: 'array', items: { type: 'string' }, description: '3 keyword-rich pin titles (<=95 chars)' },
        pin_descriptions: { type: 'array', items: { type: 'string' }, description: '2 pin descriptions with keyword + CTA' },
        boards: { type: 'array', items: { type: 'string' }, description: '2 keyword-led Pinterest board names this fits' },
        product_ideas: { type: 'array', items: { type: 'string' }, description: '2 digital-product ideas we could make for this keyword' },
        affiliate_matches: { type: 'array', items: { type: 'string' }, description: '2 affiliate/physical product types to recommend for this keyword' },
      } } } } } };

async function buildBriefs(top) {
  const year = new Date().getFullYear();
  const list = top.map((t) => `- "${t.keyword}" [niche: ${t.niche}; volume ${t.pop}/100; MoM ${t.mom}%${t.rising ? '; RISING' : ''}]`).join('\n');
  const { briefs } = await lib.chatJSON({
    system: `You turn real Pinterest search keywords into actionable content briefs for a US Pinterest+blog+shop business focused on TWO niches only: home decor (cozy living, small-space, organization, styling) and beauty/skincare. Be specific and buyer-focused. The current year is ${year}; use ${year} in any dated titles (the season is happening now) — never a past or future year. Set keep=false for anything off-niche (not home decor or beauty/skincare) and for non-commercial fads (video games, fan art, celebrity/brand IP, anything we cannot legally sell or recommend products for). US English.`,
    user: `For EACH keyword below, produce a content brief. Favor strong buying intent and seasonal timing.\n\n${list}`,
    schema: BRIEF_SCHEMA, temperature: 0.7,
  });
  return briefs;
}

(async () => {
  const t = await api('POST', '/v5/oauth/token'); ACCESS = t.body.access_token;
  if (!ACCESS) { console.error('Pinterest auth failed'); process.exit(1); }

  console.log('Pulling Pinterest Trends across niches...');
  const trends = await pullTrends();
  console.log(`  ${trends.length} candidate keywords`);

  const briefTargets = trends.slice(0, 22);
  console.log(`Writing briefs for top ${briefTargets.length}...`);
  const allBriefs = await buildBriefs(briefTargets);
  // attach scores back to briefs
  const byKw = Object.fromEntries(trends.map((x) => [x.keyword, x]));
  for (const b of allBriefs) Object.assign(b, byKw[b.keyword] || {});
  // Keep only monetizable, on-niche topics; rank by score.
  const briefs = allBriefs.filter((b) => b.keep).sort((a, b) => (b.score || 0) - (a.score || 0));
  const dropped = allBriefs.filter((b) => !b.keep).map((b) => b.keyword);

  const out = {
    generated_at: new Date().toISOString(),
    region: 'US',
    candidates: trends.slice(0, 40),
    briefs,
  };
  fs.mkdirSync(path.join(process.cwd(), 'content'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'content', 'trend-briefs.json'), JSON.stringify(out, null, 2));
  console.log(`\n✅ Winning topics (${briefs.length}):`);
  briefs.forEach((b) => console.log(`  [${b.niche}/${b.season}] ${b.keyword}  (vol ${b.pop}, MoM ${b.mom}%, ${b.intent} intent) -> ${b.article_topic}`));
  if (dropped.length) console.log(`\n🗑  Dropped as non-commercial: ${dropped.join(', ')}`);
  console.log('\nSaved content/trend-briefs.json');
})();
