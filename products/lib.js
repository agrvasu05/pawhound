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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BRAND = 'Value Finds Daily';

// ── Image generation (cheap; swap IMAGE_PROVIDER to scale) ───────────────────
async function generateImage(prompt, { size = '1024x1536', quality = 'low' } = {}) {
  const r = await openai.images.generate({ model: 'gpt-image-1', prompt, size, quality, n: 1 });
  return Buffer.from(r.data[0].b64_json, 'base64');
}

// ── OpenAI chat JSON helper ──────────────────────────────────────────────────
async function chatJSON({ system, user, schema, temperature = 0.8 }) {
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
async function renderShopPin(spec, outPath) {
  const accent = spec.accent || '#2d4a3e';
  const imgs = spec.images.map(dataUrl);
  const hero = imgs[0];
  const framed = (src, w, h, pad) =>
    `<div style="background:#fff;padding:${pad}px;border:2px solid #e7ddcb;box-shadow:0 16px 40px rgba(60,44,32,0.22);">
       <img src="${src}" style="width:${w}px;height:${h}px;object-fit:cover;display:block;"/></div>`;
  const thumbs = imgs.length > 1
    ? `<div style="display:flex;justify-content:center;gap:22px;margin-top:26px;">
         ${imgs.slice(0, 3).map((t) => framed(t, 150, 200, 12)).join('')}</div>`
    : '';
  const html = `<html><body style="margin:0;">
   <div style="width:1000px;height:1500px;font-family:Georgia,serif;position:relative;box-sizing:border-box;
               background:linear-gradient(160deg,#f1e9dd 0%,#e7dccb 100%);overflow:hidden;">
     <div style="position:absolute;top:30px;left:30px;background:rgba(255,255,255,0.9);color:#6b5844;
                 padding:9px 20px;border-radius:30px;font-size:21px;letter-spacing:1px;z-index:3;">${BRAND}</div>
     <div style="display:flex;justify-content:center;padding-top:120px;">${framed(hero, 520, 700, 30)}</div>
     <div style="text-align:center;padding:34px 50px 0;">
       <div style="font-size:62px;font-weight:bold;line-height:1.05;color:#33271c;">${esc(spec.headline)}</div>
       <div style="margin-top:12px;font-size:28px;color:#8a7257;">${esc(spec.subhead)}</div>
     </div>
     ${thumbs}
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
async function pinPost({ boardId, title, description, link, pngPath }) {
  const res = await pinApi('POST', '/v5/pins', {
    board_id: boardId, title: title.slice(0, 95), description: description.slice(0, 480), link,
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
async function generateVariantSpecs(title, type, n = 6) {
  const schema = { name: 'pin_variants', strict: true, schema: { type: 'object', additionalProperties: false, required: ['variants'],
    properties: { variants: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['headline', 'subhead', 'pin_title', 'pin_description'], properties: {
        headline: { type: 'string', description: '<=22 char punchy overlay headline' },
        subhead: { type: 'string', description: '<=34 char benefit line' },
        pin_title: { type: 'string', description: '<=95 char keyword-rich Pinterest title' },
        pin_description: { type: 'string', description: '<=480 char keyword + CTA description' },
      } } } } } };
  const { variants } = await chatJSON({
    system: "You write high-CTR Pinterest pin variations. Each MUST use a different angle: core benefit, target audience, occasion/gift, what's-included, aesthetic/style, urgency/seasonal. US English. No hashtags in the headline.",
    user: `Product: "${title}" (a printable ${type}). Give ${n} distinct pin-angle variations.`,
    schema, temperature: 0.9,
  });
  return variants.slice(0, n);
}

function loadQueue() { try { return JSON.parse(fs.readFileSync(PIN_QUEUE, 'utf-8')); } catch { return []; } }
function saveQueue(q) { fs.mkdirSync(path.dirname(PIN_QUEUE), { recursive: true }); fs.writeFileSync(PIN_QUEUE, JSON.stringify(q, null, 2)); }

// Enqueue N pin variants that link to the product's OWNED landing page (/shop/<slug>).
async function enqueueProductVariants({ slug, type, title, price, board }) {
  const specs = await generateVariantSpecs(title, type);
  const link = `${SITE_URL}/shop/${slug}`;
  const entries = specs.map((s, i) => ({
    slug, link, board, price,
    headline: s.headline, subhead: s.subhead, title: s.pin_title, description: s.pin_description,
    accent: VARIANT_ACCENTS[i % VARIANT_ACCENTS.length],
    status: 'pending', created_at: new Date().toISOString(),
  }));
  const q = loadQueue(); q.push(...entries); saveQueue(q);
  return entries.length;
}

// Drip-post pending pins: up to maxPerRun, at most 1 per product per day.
// Renders each variant on the fly from the committed shop-asset images (no PNG bloat in git).
async function postQueue({ maxPerRun = 5 } = {}) {
  const q = loadQueue();
  if (!q.length) { console.log('Pin queue empty.'); return; }
  const today = new Date().toISOString().slice(0, 10);
  // Hard DAILY cap (not just per-run): count what was already posted today across
  // the whole queue, so manual re-triggers can never push the shop over its share.
  const postedTodayTotal = q.filter((e) => e.status === 'posted' && (e.posted_at || '').startsWith(today)).length;
  const allowance = Math.max(0, maxPerRun - postedTodayTotal);
  if (allowance === 0) { console.log(`Daily shop pin cap (${maxPerRun}) already reached — posting 0.`); return; }
  await pinRefresh();
  const postedTodayBySlug = new Set(q.filter((e) => e.status === 'posted' && (e.posted_at || '').startsWith(today)).map((e) => e.slug));
  let posted = 0;
  for (const e of q) {
    if (posted >= allowance) break;
    if (e.status !== 'pending' || postedTodayBySlug.has(e.slug)) continue;
    const recPath = path.join(SHOP_DIR, `${e.slug}.json`);
    const assetDir = path.join(PUBLIC_SHOP, e.slug);
    if (!fs.existsSync(recPath) || !fs.existsSync(assetDir)) continue;
    const rec = JSON.parse(fs.readFileSync(recPath, 'utf-8'));
    const images = [rec.cover, ...rec.images.filter((f) => f !== rec.cover)]
      .map((f) => path.join(assetDir, f)).filter((f) => fs.existsSync(f));
    if (!images.length) continue;
    const tmpPin = path.join(assetDir, '_pin_tmp.png');
    try {
      await renderShopPin({ images, headline: e.headline, subhead: e.subhead, price: e.price, accent: e.accent }, tmpPin);
      const boardId = await pinGetOrCreateBoard(e.board.name, e.board.description);
      const url = await pinPost({ boardId, title: e.title, description: e.description, link: e.link, pngPath: tmpPin });
      e.status = 'posted'; e.pin_url = url; e.posted_at = new Date().toISOString();
      postedTodayBySlug.add(e.slug); posted++;
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
  PUBLIC_SHOP, SHOP_DIR, PIN_QUEUE, SITE_URL,
};
