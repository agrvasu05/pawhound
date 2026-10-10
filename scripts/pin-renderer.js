/**
 * pin-renderer.js — the content-pin templates, shared by scripts/4-generate-pins.js
 * (batch pre-render, optional) and scripts/5-post-pins.js (render-at-post-time).
 *
 * Why a separate module: pins used to be rendered a day ahead and committed to
 * public/pins (2.8 GB of PNGs by October 2026 — every Actions checkout and
 * Netlify build paid for it). Now the poster renders only the pin it is about
 * to post and uploads it as base64, so nothing new is committed.
 *
 * Headline sizing: the October 2026 audit found the 50–60px serif captions were
 * unreadable at feed size (a pin is ~236px wide in the feed, so 60px becomes
 * ~14px). fitHeadline() now picks the largest size (96→58px) that fits the
 * caption band, so a 6-word hook renders at ~90px and a 12-word one at ~62px.
 */
const fs = require('fs');
const path = require('path');

const BRAND = 'valuefindsdaily.com';

// Stable names, index-aligned with TEMPLATES. Written to manifests so the
// weekly feedback loop (6-template-feedback.js) can grade each template.
const TEMPLATE_KEYS = [
  'editorial-hero', // 0 — single image + cream caption band (serif)
  'warm-collage',   // 1 — 2×2 warm collage, number badge, caption fills the pin
  'hero-stack',     // 2 — one hero + two stacked, "save for later" chip
  'soft-overlay',   // 3 — full-bleed image, warm gradient, serif headline over it
  'framed-inspo',   // 4 — image as a framed print on a cream wall, minimal text
];

// Largest font size whose wrapped line count fits the band. Playfair Display
// bold averages ~0.52em per character; bands are ~850px wide.
function fitHeadline(text, { maxLines = 3, width = 850, sizes = [96, 88, 80, 72, 66, 60, 56] } = {}) {
  // Word-wrap estimate: walk the words and break when the next one overflows,
  // with a conservative 0.58em average glyph width for Playfair Display bold.
  const words = String(text).split(/\s+/).filter(Boolean);
  for (const size of sizes) {
    const maxChars = Math.max(6, Math.floor(width / (size * 0.58)));
    let lines = 1, len = 0;
    for (const w of words) {
      const add = len ? len + 1 + w.length : w.length;
      if (add > maxChars && len) { lines++; len = w.length; } else len = add;
    }
    if (lines <= maxLines) return size;
  }
  return sizes[sizes.length - 1];
}

const TEMPLATES = [
  // 0 — editorial-hero
  ({ headline, image }) => {
    const num = (String(headline).match(/\d+/) || [])[0];
    const fs = fitHeadline(headline, { maxLines: 3 });
    return `
    <div style="width:1000px;height:1500px;background:var(--cream);position:relative;">
      <div style="height:1020px;position:relative;overflow:hidden;">
        <img class="warm" src="${image}" style="width:100%;height:100%;object-fit:cover;"/>
        ${num ? `<div style="position:absolute;top:40px;left:40px;background:var(--terra);color:#fff;font-family:var(--sans);font-weight:600;font-size:34px;padding:14px 28px;border-radius:14px;box-shadow:0 10px 24px rgba(0,0,0,0.18);">${num} ideas</div>` : ''}
      </div>
      <div style="height:480px;padding:44px 70px 0;box-sizing:border-box;text-align:center;">
        <div style="width:56px;height:3px;background:var(--terra);margin:0 auto 22px;"></div>
        <div style="font-family:var(--serif);font-weight:800;font-size:${fs}px;line-height:1.08;color:var(--ink);">${headline}</div>
        <div style="margin-top:20px;font-family:var(--sans);font-size:22px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);">${BRAND}</div>
      </div>
    </div>`;
  },

  // 1 — warm-collage
  ({ headline, image, images = [] }) => {
    const pics = (images.length >= 3 ? images : [image]).slice(0, 4);
    const num = (String(headline).match(/\d+/) || [])[0];
    const fs = fitHeadline(headline, { maxLines: 3, width: 880 });
    const cells = pics
      .map((src, i) => `<img class="warm" src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;${pics.length === 3 && i === 0 ? 'grid-column:1/3;' : ''}"/>`)
      .join('');
    return `
    <div style="width:1000px;height:1500px;background:var(--frame);padding:28px;box-sizing:border-box;position:relative;">
      <div style="height:1060px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:18px;overflow:hidden;">${cells}</div>
      ${num ? `<div style="position:absolute;top:52px;left:52px;background:var(--terra);color:#fff;font-family:var(--sans);font-weight:700;font-size:54px;line-height:1;padding:20px 26px;border-radius:18px;text-align:center;box-shadow:0 10px 26px rgba(0,0,0,0.22);">${num}<div style="font-size:18px;letter-spacing:3px;margin-top:6px;">IDEAS</div></div>` : ''}
      <div style="height:384px;padding:34px 20px 0;box-sizing:border-box;text-align:center;">
        <div style="font-family:var(--serif);font-weight:800;font-size:${fs}px;line-height:1.08;color:var(--ink);">${headline}</div>
        <div style="margin-top:18px;font-family:var(--sans);font-size:22px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);">${BRAND}</div>
      </div>
    </div>`;
  },

  // 2 — hero-stack
  ({ headline, image, images = [] }) => {
    const pics = (images.length >= 3 ? images : [image, image, image]).slice(0, 3);
    const fs = fitHeadline(headline, { maxLines: 3, width: 880 });
    return `
    <div style="width:1000px;height:1500px;background:var(--frame);padding:30px;box-sizing:border-box;">
      <div style="display:flex;gap:18px;height:1030px;">
        <img class="warm" src="${pics[0]}" style="flex:1.5;height:100%;object-fit:cover;min-width:0;border-radius:6px;"/>
        <div style="flex:1;display:flex;flex-direction:column;gap:18px;min-width:0;">
          ${pics.slice(1, 3).map((s) => `<img class="warm" src="${s}" style="flex:1;min-height:0;width:100%;object-fit:cover;border-radius:6px;"/>`).join('')}
        </div>
      </div>
      <div style="height:380px;padding-top:26px;box-sizing:border-box;text-align:center;">
        <div style="display:inline-block;font-family:var(--sans);font-size:19px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#fff;background:var(--sage);padding:10px 24px;border-radius:30px;">Save for later</div>
        <div style="margin-top:18px;font-family:var(--serif);font-weight:800;font-size:${fs}px;line-height:1.08;color:var(--ink);">${headline}</div>
        <div style="margin-top:14px;font-family:var(--sans);font-size:21px;letter-spacing:3px;color:var(--muted);">${BRAND}</div>
      </div>
    </div>`;
  },

  // 3 — soft-overlay
  ({ headline, image }) => {
    const num = (String(headline).match(/\d+/) || [])[0];
    const fs = fitHeadline(headline, { maxLines: 3, width: 860 });
    return `
    <div style="width:1000px;height:1500px;position:relative;">
      <img class="warm" src="${image}" style="width:100%;height:100%;object-fit:cover;"/>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(40,26,15,0.22),rgba(40,26,15,0) 30%,rgba(40,26,15,0.86));"></div>
      ${num ? `<div style="position:absolute;top:44px;left:44px;background:var(--terra);color:#fff;font-family:var(--sans);font-weight:600;font-size:34px;padding:14px 28px;border-radius:14px;">${num} ideas</div>` : ''}
      <div style="position:absolute;left:60px;right:60px;bottom:230px;text-align:center;color:#fff;">
        <div style="width:56px;height:3px;background:rgba(255,255,255,0.85);margin:0 auto 24px;"></div>
        <div style="font-family:var(--serif);font-weight:800;font-size:${fs}px;line-height:1.06;text-shadow:0 2px 26px rgba(0,0,0,0.45);">${headline}</div>
        <div style="margin-top:22px;font-family:var(--sans);font-size:22px;letter-spacing:4px;text-transform:uppercase;opacity:0.92;">${BRAND}</div>
      </div>
    </div>`;
  },

  // 4 — framed-inspo
  ({ headline, image }) => {
    const fs = fitHeadline(headline, { maxLines: 3, width: 860 });
    return `
    <div style="width:1000px;height:1500px;background:linear-gradient(165deg,#f4ece0,#e7dbc7);position:relative;">
      <div style="position:absolute;top:110px;left:50%;transform:translateX(-50%);background:#fff;padding:26px;box-shadow:0 34px 70px rgba(60,40,20,0.26);">
        <img class="warm" src="${image}" style="width:540px;height:700px;object-fit:cover;display:block;"/>
      </div>
      <div style="position:absolute;left:60px;right:60px;bottom:200px;text-align:center;">
        <div style="width:54px;height:3px;background:var(--terra);margin:0 auto 22px;"></div>
        <div style="font-family:var(--serif);font-weight:800;font-size:${fs}px;line-height:1.08;color:var(--ink);">${headline}</div>
        <div style="margin-top:18px;font-family:var(--sans);font-size:21px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);">${BRAND}</div>
      </div>
    </div>`;
  },
];

const HEAD = `<head><style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Poppins:wght@400;500;600&display=swap');
  :root{--serif:'Playfair Display',Georgia,'Times New Roman',serif;--sans:'Poppins','Helvetica Neue',Arial,sans-serif;
    --cream:#faf6ee;--frame:#efe6d6;--ink:#33271c;--muted:#a08a6e;--terra:#b05a3c;--sage:#6b7355;}
  *{box-sizing:border-box;} img{display:block;}
  .warm{filter:saturate(1.06) brightness(1.02) sepia(0.05);}
</style></head>`;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Renders one pin PNG. `images` are file paths; the first is the hero. */
async function renderPin({ headline, images, output, templateIdx }) {
  const puppeteer = require('puppeteer');
  const dataUrls = images.map((f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`);
  const html = `<html>${HEAD}<body style="margin:0;">${TEMPLATES[templateIdx]({ headline: esc(headline), image: dataUrls[0], images: dataUrls })}</body></html>`;
  const browser = await puppeteer.launch({ args: ['--no-sandbox'], executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    try { await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 4000))]); } catch { /* offline → fallback fonts */ }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    await page.screenshot({ path: output, type: 'png' });
  } finally {
    await browser.close();
  }
  return output;
}

function breedToSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Up to 4 pick images for an article (rank order), only those that exist on disk. */
function articleImages(article, root = process.cwd()) {
  const out = [];
  for (const p of [...article.picks].sort((a, b) => a.rank - b.rank)) {
    const ip = path.resolve(root, 'public', 'images', 'breeds', breedToSlug(p.breed), '1.jpg');
    if (fs.existsSync(ip)) out.push(ip);
    if (out.length >= 4) break;
  }
  return out;
}

// Measured template verdicts from the weekly feedback loop
// (content/template-performance.json): drop 'kill' templates, front 'scale' ones.
function templateOrder(imageCount, root = process.cwd()) {
  const order = imageCount >= 3 ? [1, 2, 0, 3, 4] : [0, 3, 4];
  let verdicts = {};
  try {
    verdicts = JSON.parse(fs.readFileSync(path.join(root, 'content', 'template-performance.json'), 'utf-8')).templates || {};
  } catch { return order; }
  const v = (i) => (verdicts[TEMPLATE_KEYS[i]] || {}).verdict;
  const kept = order.filter((i) => v(i) !== 'kill');
  const base = kept.length ? kept : order;
  return [...base.filter((i) => v(i) === 'scale'), ...base.filter((i) => v(i) !== 'scale')];
}

/** True when the destination URL is live (2xx/3xx). Netlify builds only run a
 *  few times a week to stay on the free tier, so a pin must never go out before
 *  its page exists. */
async function isLive(url, timeoutMs = 8000) {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal });
    clearTimeout(t);
    return r.status >= 200 && r.status < 400;
  } catch { return false; }
}

module.exports = { isLive, BRAND, TEMPLATE_KEYS, TEMPLATES, fitHeadline, renderPin, articleImages, templateOrder, breedToSlug };
