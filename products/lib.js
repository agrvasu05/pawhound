/**
 * lib.js — shared helpers for the Gumroad digital-product pipeline:
 * image generation, PDF/zip packaging, the Pinterest "shop" pin renderer,
 * Gumroad create+publish, and Pinterest posting.
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const OpenAI = require('openai');
const puppeteer = require('puppeteer');

// Only instantiate when a key exists — post-queue.js requires this lib for
// rendering/posting and must not crash when OPENAI_API_KEY isn't in its env.
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const BRAND = 'Value Finds Daily';

// ── Gemini (primary text model; OpenAI stays as fallback) ────────────────────
// Two backends:
//   • Vertex AI  — when a service-account key is provided (GCP_SA_FILE / GCP_SA_KEY).
//     Uses the $300 Google Cloud credits; required for org-managed projects that
//     block plain Gemini keys. Highest rate limits.
//   • Developer API — when only GEMINI_API_KEY is set (simple key).
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GCP_SA_FILE = process.env.GCP_SA_FILE || '';
const GCP_SA_KEY = process.env.GCP_SA_KEY || '';
const GCP_LOCATION = process.env.GCP_LOCATION || 'global';
const USE_VERTEX = !!(GCP_SA_FILE || GCP_SA_KEY);
const GEMINI_ON = USE_VERTEX || !!GEMINI_KEY;

// Convert an OpenAI json_schema ({name,strict,schema}) into the subset Gemini's
// responseSchema accepts: drop additionalProperties/strict, uppercase type names.
function toGeminiSchema(s) {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (s && typeof s === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(s)) {
      if (k === 'additionalProperties' || k === 'strict' || k === '$schema' || k === 'name') continue;
      if (k === 'type' && typeof v === 'string') { out.type = v.toUpperCase(); continue; }
      out[k] = toGeminiSchema(v);
    }
    return out;
  }
  return s;
}

// Lazy Vertex auth (only loads google-auth-library when a SA key is configured,
// so post-queue.js etc. never need it).
let _vertexAuth = null, _vertexProject = null;
async function vertexAuth() {
  if (!_vertexAuth) {
    const { GoogleAuth } = require('google-auth-library');
    const opts = { scopes: 'https://www.googleapis.com/auth/cloud-platform' };
    if (GCP_SA_FILE) opts.keyFile = GCP_SA_FILE;
    else opts.credentials = JSON.parse(GCP_SA_KEY);
    _vertexAuth = new GoogleAuth(opts);
    _vertexProject = process.env.GCP_PROJECT_ID || (await _vertexAuth.getProjectId());
  }
  const client = await _vertexAuth.getClient();
  const t = await client.getAccessToken();
  return typeof t === 'string' ? t : t.token;
}

async function geminiJSON({ system, user, schema, temperature }) {
  const inner = schema && schema.schema ? schema.schema : schema;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(inner),
      temperature,
    },
  };
  let url; const headers = { 'Content-Type': 'application/json' };
  if (USE_VERTEX) {
    headers.Authorization = `Bearer ${await vertexAuth()}`;
    const host = GCP_LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${GCP_LOCATION}-aiplatform.googleapis.com`;
    url = `https://${host}/v1/projects/${_vertexProject}/locations/${GCP_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const cand = data.candidates && data.candidates[0];
  if (!cand) throw new Error(`Gemini: no candidate (${JSON.stringify(data).slice(0, 200)})`);
  const text = (cand.content && cand.content.parts || []).map((p) => p.text || '').join('');
  return JSON.parse(text);
}

// ── Image generation (cheap; swap IMAGE_PROVIDER to scale) ───────────────────
async function generateImage(prompt, { size = '1024x1536', quality = 'low', background } = {}) {
  const r = await openai.images.generate({
    model: 'gpt-image-1', prompt, size, quality, n: 1,
    ...(background ? { background } : {}), // 'transparent' for clipart PNGs
  });
  return Buffer.from(r.data[0].b64_json, 'base64');
}

// ── Chat JSON helper — Gemini 2.5 Pro primary, OpenAI fallback ───────────────
async function chatJSON({ system, user, schema, temperature = 0.8 }) {
  if (GEMINI_ON) {
    try { return await geminiJSON({ system, user, schema, temperature }); }
    catch (e) {
      if (!openai) throw e;
      console.error('  Gemini failed, falling back to OpenAI:', e.message);
    }
  }
  if (!openai) throw new Error('No GEMINI_API_KEY or OPENAI_API_KEY configured');
  const r = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: schema },
    temperature,
  });
  return JSON.parse(r.choices[0].message.content);
}

// ── Puppeteer: render HTML → PNG / PDF ───────────────────────────────────────
async function withBrowser(fn) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox'],
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
  });
  try { return await fn(browser); } finally { await browser.close(); }
}

async function htmlToPng(html, outPath, { width = 1000, height = 1500 } = {}) {
  await withBrowser(async (b) => {
    const p = await b.newPage();
    await p.setViewport({ width, height, deviceScaleFactor: 1 });
    // Inline data URLs (no network), so 'load' is reliable; 'networkidle0' can hang in CI.
    await p.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 300)); // let images decode/paint
    await p.screenshot({ path: outPath, type: 'png' });
  });
  return outPath;
}

async function htmlToPdf(html, outPath) {
  await withBrowser(async (b) => {
    const p = await b.newPage();
    await p.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 300));
    await p.pdf({ path: outPath, format: 'Letter', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  });
  return outPath;
}

function dataUrl(file) { return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'); }
function zip(dir, zipName, files) { execSync(`cd "${dir}" && zip -q "${zipName}" ${files.map((f) => `"${f}"`).join(' ')}`); return path.join(dir, zipName); }

// ── The "shop" pin (premium framed look + full-width bottom CTA) ──────────────
// spec: { images:[paths], headline, subhead, price, accent }
const SCENES_DIR = path.join(process.cwd(), 'public', 'scenes');
function pickScene(cat) {
  try {
    const files = fs.readdirSync(SCENES_DIR).filter((f) => f.startsWith(`${cat}-`) && f.endsWith('.jpg'));
    if (!files.length) return null;
    return path.join(SCENES_DIR, files[Math.floor(Math.random() * files.length)]);
  } catch { return null; }
}

// Renders a "lifestyle mockup" pin: the product shown in a real room/desk scene
// (which earns far more saves than a flat background), title + a full-width
// bottom CTA bar that lines up with Pinterest's "Visit site". Falls back to a
// clean gradient if no scene images are available.
async function renderShopPin(spec, outPath) {
  const accent = spec.accent || '#2d4a3e';
  const imgs = spec.images.map(dataUrl);
  const hero = imgs[0];
  const sceneCat = spec.scene === 'desk' ? 'desk' : 'wall';
  const sceneFile = pickScene(sceneCat);
  const sceneUrl = sceneFile ? dataUrl(sceneFile) : null;

  const framed = (src, w, h, pad, rot = 0) =>
    `<div style="background:#fff;padding:${pad}px;border:2px solid #efe7d8;box-shadow:0 22px 50px rgba(30,20,10,0.30);transform:rotate(${rot}deg);">
       <img src="${src}" style="width:${w}px;height:${h}px;object-fit:cover;display:block;"/></div>`;
  const thumbs = imgs.length > 1
    ? `<div style="display:flex;justify-content:center;gap:18px;margin-top:18px;">
         ${imgs.slice(0, 3).map((t) => framed(t, 120, 160, 9)).join('')}</div>`
    : '';

  // Scene zone: product composited onto the room/desk photo.
  const sceneZone = sceneUrl
    ? `<div style="position:relative;width:100%;height:880px;overflow:hidden;background:#e7dccb;">
         <img src="${sceneUrl}" style="width:100%;height:100%;object-fit:cover;"/>
         <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.06);"></div>
         <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-52%);">
           ${sceneCat === 'desk' ? framed(hero, 400, 520, 24, -3) : framed(hero, 380, 510, 26, 0)}
         </div>
       </div>`
    : `<div style="height:880px;display:flex;align-items:center;justify-content:center;
                  background:linear-gradient(160deg,#f1e9dd 0%,#e7dccb 100%);">${framed(hero, 460, 620, 28)}</div>`;

  const html = `<html><body style="margin:0;">
   <div style="width:1000px;height:1500px;font-family:Georgia,serif;position:relative;box-sizing:border-box;background:#f4ede1;overflow:hidden;">
     <div style="position:absolute;top:28px;left:28px;background:rgba(255,255,255,0.92);color:#6b5844;
                 padding:9px 20px;border-radius:30px;font-size:21px;letter-spacing:1px;z-index:3;">${BRAND}</div>
     ${sceneZone}
     <div style="text-align:center;padding:30px 50px 0;">
       <div style="font-size:58px;font-weight:bold;line-height:1.05;color:#33271c;">${esc(spec.headline)}</div>
       <div style="margin-top:10px;font-size:27px;color:#8a7257;">${esc(spec.subhead)}</div>
       ${thumbs}
     </div>
     <div style="position:absolute;bottom:0;left:0;right:0;height:150px;background:${accent};color:#fff;
                 display:flex;align-items:center;justify-content:center;gap:20px;">
       <span style="font-size:48px;font-weight:bold;">Tap to shop</span>
       <span style="font-size:40px;opacity:.85;">·</span>
       <span style="font-size:48px;font-weight:bold;">$${spec.price}</span>
       <span style="font-size:52px;font-weight:bold;">→</span>
     </div>
   </div></body></html>`;
  return htmlToPng(html, outPath);
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── Gumroad: create draft + publish ──────────────────────────────────────────
const GUMROAD_CLI = path.join(process.env.HOME || '', 'go', 'bin', 'gumroad');
function gumroadCLI(args) {
  return execFileSync(GUMROAD_CLI, args, {
    env: { ...process.env, GUMROAD_ACCESS_TOKEN: process.env.GUMROAD_ACCESS_TOKEN },
    encoding: 'utf-8', maxBuffer: 1024 * 1024 * 128,
  });
}
function gumroadCreateAndPublish({ title, description, description_html, price, currency = 'usd', tags = [], slug, file, fileName, cover }) {
  const desc = description_html || description || '';
  // No --custom-permalink: let Gumroad auto-assign a unique one (repeated themes
  // would otherwise collide and fail). We use the returned short_url regardless.
  const args = ['products', 'create', '--name', title, '--type', 'digital',
    '--price', String(price), '--currency', currency, '--description', desc,
    '--file', file, '--file-name', fileName || `${title}.zip`, '--json'];
  if (cover) args.push('--cover-image', cover);
  for (const t of tags) args.push('--tag', t);
  const product = JSON.parse(gumroadCLI(args)).product;
  gumroadCLI(['products', 'publish', product.id, '--yes', '--json']);
  return { id: product.id, url: product.short_url };
}

// ── Pinterest ─────────────────────────────────────────────────────────────────
const PIN = {
  CLIENT_ID: process.env.PINTEREST_CLIENT_ID,
  CLIENT_SECRET: process.env.PINTEREST_CLIENT_SECRET,
  REFRESH: process.env.PINTEREST_REFRESH_TOKEN,
  ACCESS: null,
};
function pinApi(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const isOAuth = endpoint === '/v5/oauth/token';
    const auth = isOAuth
      ? 'Basic ' + Buffer.from(`${PIN.CLIENT_ID}:${PIN.CLIENT_SECRET}`).toString('base64')
      : `Bearer ${PIN.ACCESS}`;
    const payload = isOAuth ? new URLSearchParams(body).toString() : body ? JSON.stringify(body) : null;
    const opts = { hostname: 'api.pinterest.com', path: endpoint, method, headers: {
      Authorization: auth,
      ...(payload ? { 'Content-Type': isOAuth ? 'application/x-www-form-urlencoded' : 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
    } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } }); });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}
async function pinRefresh() {
  const res = await pinApi('POST', '/v5/oauth/token', { grant_type: 'refresh_token', refresh_token: PIN.REFRESH });
  if (!res.body.access_token) throw new Error('Pinterest refresh failed: ' + JSON.stringify(res.body));
  PIN.ACCESS = res.body.access_token;
}
const boardCache = {};
async function pinGetOrCreateBoard(name, description) {
  if (boardCache[name]) return boardCache[name];
  const list = await pinApi('GET', '/v5/boards?page_size=100');
  const match = (list.body.items || []).find((b) => b.name === name);
  if (match) return (boardCache[name] = match.id);
  const res = await pinApi('POST', '/v5/boards', { name, description, privacy: 'PUBLIC' });
  if (res.status !== 201 && res.status !== 200) throw new Error('Board error: ' + JSON.stringify(res.body));
  return (boardCache[name] = res.body.id);
}
async function pinPost({ boardId, title, description, link, pngPath, altText }) {
  const res = await pinApi('POST', '/v5/pins', {
    board_id: boardId, title: title.slice(0, 95), description: description.slice(0, 480), link,
    alt_text: (altText || title).slice(0, 500), // SEO + accessibility: keyword-rich alt text
    media_source: { source_type: 'image_base64', content_type: 'image/png', data: fs.readFileSync(pngPath).toString('base64') },
  });
  if (res.status !== 201) throw new Error(`Pinterest ${res.status}: ${JSON.stringify(res.body)}`);
  return `https://pinterest.com/pin/${res.body.id}`;
}

// ── Owned shop landing pages + multi-variant pin queue ───────────────────────
const PUBLIC_SHOP = path.join(process.cwd(), 'public', 'shop-assets');
const SHOP_DIR = path.join(process.cwd(), 'content', 'shop');
const PIN_QUEUE = path.join(process.cwd(), 'content', 'pin-queue.json');
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://valuefindsdaily.com';
const VARIANT_ACCENTS = ['#2d4a3e', '#7a5c3a', '#5b4a8a', '#9a3b4f', '#3a6b7a', '#8a6d2f'];

// Copy a product's images into /public/shop-assets/<slug>/ and write its shop record.
function persistShopProduct({ slug, type, listing, gumroadUrl, srcImages }) {
  const dest = path.join(PUBLIC_SHOP, slug);
  fs.mkdirSync(dest, { recursive: true });
  const images = [];
  for (const src of srcImages) {
    if (!fs.existsSync(src)) continue;
    const base = path.basename(src);
    fs.copyFileSync(src, path.join(dest, base));
    images.push(base);
  }
  fs.mkdirSync(SHOP_DIR, { recursive: true });
  const record = {
    slug, type, title: listing.title,
    description_html: listing.description_html || listing.description || '',
    price: listing.price, currency: listing.currency || 'usd',
    gumroad_url: gumroadUrl, images, cover: path.basename(listing.cover),
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(SHOP_DIR, `${slug}.json`), JSON.stringify(record, null, 2));
  return record;
}

// GPT: distinct pin angles for one product (per the strategy doc: 1 product -> many fresh pins).
// `keyword` = the trending Pinterest search term to weave into every pin for SEO.
async function generateVariantSpecs(title, type, n = 6, keyword = '') {
  const schema = { name: 'pin_variants', strict: true, schema: { type: 'object', additionalProperties: false, required: ['variants'],
    properties: { variants: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['headline', 'subhead', 'pin_title', 'pin_description'], properties: {
        headline: { type: 'string', description: '<=22 char punchy overlay headline' },
        subhead: { type: 'string', description: '<=34 char benefit line' },
        pin_title: { type: 'string', description: '<=95 char Pinterest title with the target keyword near the front' },
        pin_description: { type: 'string', description: '<=480 char description: keyword in the first sentence, natural keywords throughout, then a clear CTA' },
      } } } } } };
  const kwLine = keyword
    ? ` Target Pinterest search keyword: "${keyword}" — put it (or a close variant) at the FRONT of every pin_title and in the first sentence of every pin_description for SEO.`
    : '';
  const { variants } = await chatJSON({
    system: `You write high-CTR, SEO-optimized Pinterest pin variations. Each MUST use a different angle: core benefit, target audience, occasion/gift, what's-included, aesthetic/style, urgency/seasonal. Pinterest is a search engine — lead with the searchable keyword. US English. No hashtags in the headline.${kwLine}`,
    user: `Product: "${title}" (a printable ${type}). Give ${n} distinct pin-angle variations.`,
    schema, temperature: 0.9,
  });
  return variants.slice(0, n);
}

// ── Trend-brief picker (feeds generators with real search demand) ────────────
const TREND_BRIEFS = path.join(process.cwd(), 'content', 'trend-briefs.json');
const USED_BRIEFS = path.join(process.cwd(), 'content', 'used-briefs.json');
function loadBriefs() { try { return JSON.parse(fs.readFileSync(TREND_BRIEFS, 'utf-8')).briefs || []; } catch { return []; } }
function loadUsedBriefs() { try { return new Set(JSON.parse(fs.readFileSync(USED_BRIEFS, 'utf-8'))); } catch { return new Set(); } }
function markBriefUsed(keyword) { const s = loadUsedBriefs(); s.add(keyword); fs.mkdirSync(path.dirname(USED_BRIEFS), { recursive: true }); fs.writeFileSync(USED_BRIEFS, JSON.stringify([...s], null, 2)); }
// Highest-scored unused brief whose niche is in `niches` (or any, if null).
function pickBrief(niches) {
  const used = loadUsedBriefs();
  return loadBriefs()
    .filter((b) => !used.has(b.keyword) && (!niches || niches.includes(b.niche)))
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
}

function loadQueue() { try { return JSON.parse(fs.readFileSync(PIN_QUEUE, 'utf-8')); } catch { return []; } }
function saveQueue(q) { fs.mkdirSync(path.dirname(PIN_QUEUE), { recursive: true }); fs.writeFileSync(PIN_QUEUE, JSON.stringify(q, null, 2)); }

// SEO board description for a keyword-named board (Megan strategy).
function kwBoardDesc(name) {
  return `${name} — curated finds, printables and ideas for inspiration. Tap any pin for instant downloads and the full details.`.slice(0, 480);
}

// Enqueue N pin variants that link to the product's OWNED landing page (/shop/<slug>).
async function enqueueProductVariants({ slug, type, title, price, board, boards = null, keyword = '' }) {
  // 3 variants/product. Each variant is pinned to a DIFFERENT keyword-named board
  // (from the trend brief) so the same URL reaches several keyword audiences over
  // the weeks it drips out. Falls back to the generator's single niche board when
  // the brief has no keyword boards.
  const specs = await generateVariantSpecs(title, type, 3, keyword);
  const link = `${SITE_URL}/shop/${slug}`;
  const boardList = (boards && boards.length)
    ? boards.filter(Boolean).map((name) => ({ name: name.slice(0, 50), description: kwBoardDesc(name) }))
    : [board];
  const entries = specs.map((s, i) => ({
    slug, link, board: boardList[i % boardList.length], price, keyword,
    headline: s.headline, subhead: s.subhead, title: s.pin_title, description: s.pin_description,
    alt: keyword ? `${s.pin_title} — ${keyword}` : s.pin_title,
    accent: VARIANT_ACCENTS[i % VARIANT_ACCENTS.length],
    status: 'pending', created_at: new Date().toISOString(),
  }));
  const q = loadQueue(); q.push(...entries); saveQueue(q);
  return entries.length;
}

// Drip-post pending pins: up to maxPerRun, at most 1 per product per day.
// Renders each variant on the fly from the committed shop-asset images (no PNG bloat in git).
async function postQueue({ maxPerRun = 5 } = {}) {
  let q = loadQueue();
  if (!q.length) { console.log('Pin queue empty.'); return; }
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  // Keep the queue lean + current: drop stale PENDING pins (>14d — the trend has
  // passed, no point posting them) and very old POSTED records (>45d). This stops
  // the backlog ballooning since we add more variants/day than we post.
  const before = q.length;
  q = q.filter((e) => {
    const ageDays = (now - new Date(e.created_at).getTime()) / 864e5;
    return e.status === 'pending' ? ageDays <= 21 : ageDays <= 45;
  });
  if (before - q.length) console.log(`Pruned ${before - q.length} stale queue entries.`);
  // Hard DAILY cap (not just per-run) so manual re-triggers can't exceed the shop's share.
  const postedTodayTotal = q.filter((e) => e.status === 'posted' && (e.posted_at || '').startsWith(today)).length;
  const allowance = Math.max(0, maxPerRun - postedTodayTotal);
  if (allowance === 0) { console.log(`Daily shop pin cap (${maxPerRun}) already reached — posting 0.`); saveQueue(q); return; }
  await pinRefresh();
  // Megan-strategy: don't post another pin for a product whose pin went out within
  // the last ~7 days, so each product's variants drip ~a week apart (Pinterest
  // tests each one; avoids same-URL self-competition / spam signals).
  const SPACING_DAYS = 7;
  const recentlyPostedSlugs = new Set(
    q.filter((e) => e.status === 'posted' && e.posted_at && (now - new Date(e.posted_at).getTime()) / 864e5 < SPACING_DAYS).map((e) => e.slug)
  );
  let posted = 0;
  // Post NEWEST pending pins first so fresh, in-season trend products get pinned
  // while the keyword is still trending (not buried behind old backlog).
  const pending = q.filter((e) => e.status === 'pending')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  for (const e of pending) {
    if (posted >= allowance) break;
    if (e.status !== 'pending' || recentlyPostedSlugs.has(e.slug)) continue;
    const recPath = path.join(SHOP_DIR, `${e.slug}.json`);
    const assetDir = path.join(PUBLIC_SHOP, e.slug);
    if (!fs.existsSync(recPath) || !fs.existsSync(assetDir)) continue;
    const rec = JSON.parse(fs.readFileSync(recPath, 'utf-8'));
    const images = [rec.cover, ...rec.images.filter((f) => f !== rec.cover)]
      .map((f) => path.join(assetDir, f)).filter((f) => fs.existsSync(f));
    if (!images.length) continue;
    const tmpPin = path.join(assetDir, '_pin_tmp.png');
    try {
      const scene = (rec.type === 'wall-art' || rec.type === 'bundle') ? 'wall' : 'desk';
      await renderShopPin({ images, headline: e.headline, subhead: e.subhead, price: e.price, accent: e.accent, scene }, tmpPin);
      const boardId = await pinGetOrCreateBoard(e.board.name, e.board.description);
      const url = await pinPost({ boardId, title: e.title, description: e.description, link: e.link, pngPath: tmpPin, altText: e.alt });
      e.status = 'posted'; e.pin_url = url; e.posted_at = new Date().toISOString();
      recentlyPostedSlugs.add(e.slug); posted++;
      console.log(`  ✓ ${e.slug} -> ${url}`);
      fs.unlinkSync(tmpPin);
      await new Promise((r) => setTimeout(r, 4000));
    } catch (err) {
      console.error(`  ✗ ${e.slug} pin failed:`, err.message);
    }
  }
  saveQueue(q);
  console.log(`Posted ${posted} pins. Pending remaining: ${q.filter((e) => e.status === 'pending').length}`);
}

module.exports = {
  BRAND, openai, generateImage, chatJSON,
  htmlToPng, htmlToPdf, dataUrl, zip, renderShopPin, esc,
  gumroadCreateAndPublish,
  pinRefresh, pinGetOrCreateBoard, pinPost,
  persistShopProduct, enqueueProductVariants, postQueue, loadQueue,
  pickBrief, markBriefUsed, loadBriefs,
  PUBLIC_SHOP, SHOP_DIR, PIN_QUEUE, SITE_URL,
};
