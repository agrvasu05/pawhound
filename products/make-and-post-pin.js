/**
 * make-and-post-pin.js <output-dir> — renders a "shop" pin for a Gumroad product
 * and posts it to Pinterest, linking to the product's Gumroad URL.
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const https = require('https');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET;
let REFRESH_TOKEN = process.env.PINTEREST_REFRESH_TOKEN;
let ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN;
const API_HOST = 'api.pinterest.com';
const SHOP_BOARD_NAME = 'Printable Wall Art & Cozy Decor';

const dir = process.argv[2];
if (!dir) { console.error('usage: node products/make-and-post-pin.js <output-dir>'); process.exit(1); }
const L = JSON.parse(fs.readFileSync(path.join(dir, 'listing.json'), 'utf-8'));
if (!L.gumroad_url) { console.error('listing.json has no gumroad_url — upload first.'); process.exit(1); }

function api(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const isOAuth = endpoint === '/v5/oauth/token';
    const auth = isOAuth
      ? 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
      : `Bearer ${ACCESS_TOKEN}`;
    const payload = isOAuth ? new URLSearchParams(body).toString() : body ? JSON.stringify(body) : null;
    const ct = isOAuth ? 'application/x-www-form-urlencoded' : 'application/json';
    const opts = { hostname: API_HOST, path: endpoint, method, headers: {
      Authorization: auth,
      ...(payload ? { 'Content-Type': ct, 'Content-Length': Buffer.byteLength(payload) } : {}),
    } };
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function refreshToken() {
  const res = await api('POST', '/v5/oauth/token', { grant_type: 'refresh_token', refresh_token: REFRESH_TOKEN });
  if (!res.body.access_token) { console.error('Refresh failed:', JSON.stringify(res.body)); process.exit(1); }
  ACCESS_TOKEN = res.body.access_token;
  console.log('✓ Pinterest token refreshed.');
}

async function getOrCreateBoard() {
  const list = await api('GET', '/v5/boards?page_size=100');
  const match = (list.body.items || []).find((b) => b.name === SHOP_BOARD_NAME);
  if (match) return match.id;
  const res = await api('POST', '/v5/boards', {
    name: SHOP_BOARD_NAME,
    description: 'Printable wall art and cozy home decor — instant digital downloads for dog lovers and warm, calming spaces.',
    privacy: 'PUBLIC',
  });
  if (res.status !== 201 && res.status !== 200) { console.error('Board error:', JSON.stringify(res.body)); process.exit(1); }
  return res.body.id;
}

function dataUrl(file) {
  return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
}

async function renderPin() {
  const hero = dataUrl(L.prints[0]);
  const thumbs = L.prints.map(dataUrl);
  const headline = (L.pin_headline || 'Printable Wall Art').slice(0, 24);
  const subhead = (L.pin_subhead || `Set of ${L.prints.length} printable prints`).slice(0, 38);
  const priceLabel = `$${L.price}`;

  // A framed print: white mat + thin frame + soft shadow on a styled wall.
  const framed = (src, w, h, pad) =>
    `<div style="background:#fff;padding:${pad}px;border:2px solid #e7ddcb;box-shadow:0 16px 40px rgba(60,44,32,0.22);">
       <img src="${src}" style="width:${w}px;height:${h}px;object-fit:cover;display:block;"/>
     </div>`;

  const html = `<html><head></head><body style="margin:0;">
  <div style="width:1000px;height:1500px;font-family:Georgia,serif;position:relative;box-sizing:border-box;
              background:linear-gradient(160deg,#f1e9dd 0%,#e7dccb 100%);overflow:hidden;">

    <!-- brand chip -->
    <div style="position:absolute;top:30px;left:30px;background:rgba(255,255,255,0.9);color:#6b5844;
                padding:9px 20px;border-radius:30px;font-size:21px;letter-spacing:1px;z-index:3;">Value Finds Daily</div>

    <!-- hero framed print (gallery mockup) -->
    <div style="display:flex;justify-content:center;padding-top:120px;">
      ${framed(hero, 520, 700, 30)}
    </div>

    <!-- title -->
    <div style="text-align:center;padding:34px 50px 0;">
      <div style="font-size:62px;font-weight:bold;line-height:1.05;color:#33271c;">${headline}</div>
      <div style="margin-top:12px;font-size:28px;color:#8a7257;letter-spacing:.3px;">${subhead}</div>
    </div>

    <!-- set thumbnails -->
    <div style="display:flex;justify-content:center;gap:22px;margin-top:26px;">
      ${thumbs.map((t) => framed(t, 150, 200, 12)).join('')}
    </div>

    <!-- BIG full-width bottom CTA bar (sits where Pinterest overlays "Visit site") -->
    <div style="position:absolute;bottom:0;left:0;right:0;height:150px;background:#2d4a3e;color:#fff;
                display:flex;align-items:center;justify-content:center;gap:20px;">
      <span style="font-size:48px;font-weight:bold;letter-spacing:.5px;">Tap to shop</span>
      <span style="font-size:40px;opacity:.85;">·</span>
      <span style="font-size:48px;font-weight:bold;">${priceLabel}</span>
      <span style="font-size:52px;font-weight:bold;margin-left:6px;">→</span>
    </div>
  </div></body></html>`;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const out = path.join(dir, 'pin.png');
  await page.screenshot({ path: out, type: 'png' });
  await browser.close();
  console.log('✓ pin rendered:', out);
  return out;
}

(async () => {
  await refreshToken();
  const pinPng = await renderPin();
  const boardId = await getOrCreateBoard();
  console.log('Posting pin to board', boardId);
  const res = await api('POST', '/v5/pins', {
    board_id: boardId,
    title: L.pin_title.slice(0, 95),
    description: L.pin_description.slice(0, 480),
    link: L.gumroad_url,
    media_source: { source_type: 'image_base64', content_type: 'image/png', data: fs.readFileSync(pinPng).toString('base64') },
  });
  if (res.status === 201) {
    console.log(`✓ POSTED: https://pinterest.com/pin/${res.body.id}`);
  } else {
    console.error(`✗ Pinterest ${res.status}:`, JSON.stringify(res.body, null, 2));
    process.exit(1);
  }
})();
