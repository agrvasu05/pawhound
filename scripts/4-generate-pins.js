const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');
const PINS_DIR = path.join(process.cwd(), 'public', 'pins');
const BRAND = 'valuefindsdaily.com';

// Stable names for each template, index-aligned with TEMPLATES below. Written
// to public/pins/<slug>/manifest.json per generated pin so the weekly feedback
// loop (scripts/6-template-feedback.js) can attribute saves/clicks to a
// template and kill/scale accordingly (playbook rule 10).
// Warm editorial template set (2026 rebuild). Loud color-block / dark-clickbait
// styles were retired — they earned impressions but 0 saves. Pinterest 2026
// rewards pins that "feel alive, not staged": warm bright imagery, cohesive
// palette, an elegant serif + clean sans, minimal purposeful text, no dead space.
// A subtle warm image filter (.warm) unifies mismatched stock into one cozy set.
const TEMPLATE_KEYS = [
  'editorial-hero', // 0 — single image + cream caption band (serif)
  'warm-collage',   // 1 — 2×2 warm collage, number badge, caption fills the pin
  'hero-stack',     // 2 — one hero + two stacked, "save for later" chip
  'soft-overlay',   // 3 — full-bleed image, warm gradient, serif headline over it
  'framed-inspo',   // 4 — image as a framed print on a cream wall, minimal text
];

function breedToSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Warm editorial templates. Shared design tokens (palette + fonts + the .warm
// image filter) live in the <head> injected by generatePin(), so each template
// just references var(--serif)/var(--terra) etc. and adds class="warm" to imgs.
// Order in TEMPLATES is index-aligned with TEMPLATE_KEYS above.
const TEMPLATES = [
  // 0 — editorial-hero: one image on top, cream caption band with a serif
  // headline, hairline rule, and small-caps URL. Calm, magazine cover feel.
  ({ headline, image }) => {
    const num = (String(headline).match(/\d+/) || [])[0];
    return `
    <div style="width:1000px;height:1500px;background:var(--cream);position:relative;">
      <div style="height:1070px;position:relative;overflow:hidden;">
        <img class="warm" src="${image}" style="width:100%;height:100%;object-fit:cover;"/>
        ${num ? `<div style="position:absolute;top:40px;left:40px;background:var(--terra);color:#fff;font-family:var(--sans);font-weight:600;font-size:29px;padding:13px 25px;border-radius:13px;box-shadow:0 10px 24px rgba(0,0,0,0.18);">${num} ideas</div>` : ''}
      </div>
      <div style="height:430px;padding:52px 74px 0;box-sizing:border-box;text-align:center;">
        <div style="width:56px;height:2px;background:var(--terra);margin:0 auto 26px;"></div>
        <div style="font-family:var(--serif);font-weight:700;font-size:60px;line-height:1.1;color:var(--ink);">${headline}</div>
        <div style="margin-top:26px;font-family:var(--sans);font-size:21px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);">${BRAND}</div>
      </div>
    </div>`;
  },

  // 1 — warm-collage: 2×2 (or hero+3) on a cream mat with rounded, warm-toned
  // cells; number badge; serif caption fills the lower band (no dead space).
  ({ headline, image, images = [] }) => {
    const pics = (images.length >= 3 ? images : [image]).slice(0, 4);
    const num = (String(headline).match(/\d+/) || [])[0];
    const cells = pics
      .map((src, i) => `<img class="warm" src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:5px;${pics.length === 3 && i === 0 ? 'grid-column:1/3;' : ''}"/>`)
      .join('');
    return `
    <div style="width:1000px;height:1500px;background:var(--frame);padding:28px;box-sizing:border-box;position:relative;">
      <div style="height:1150px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:20px;overflow:hidden;">${cells}</div>
      ${num ? `<div style="position:absolute;top:52px;left:52px;background:var(--terra);color:#fff;font-family:var(--sans);font-weight:600;font-size:44px;line-height:1;padding:19px 25px;border-radius:16px;text-align:center;box-shadow:0 10px 26px rgba(0,0,0,0.22);">${num}<div style="font-size:16px;letter-spacing:3px;margin-top:6px;">IDEAS</div></div>` : ''}
      <div style="height:294px;padding-top:36px;box-sizing:border-box;text-align:center;">
        <div style="font-family:var(--serif);font-weight:700;font-size:50px;line-height:1.12;color:var(--ink);">${headline}</div>
        <div style="margin-top:18px;font-family:var(--sans);font-size:20px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);">${BRAND}</div>
      </div>
    </div>`;
  },

  // 2 — hero-stack: one tall hero + two stacked images on a cream mat, a soft
  // sage "save for later" chip, then the serif headline below.
  ({ headline, image, images = [] }) => {
    const pics = (images.length >= 3 ? images : [image, image, image]).slice(0, 3);
    return `
    <div style="width:1000px;height:1500px;background:var(--frame);padding:30px;box-sizing:border-box;">
      <div style="display:flex;gap:20px;height:1120px;">
        <img class="warm" src="${pics[0]}" style="flex:1.5;height:100%;object-fit:cover;min-width:0;border-radius:5px;"/>
        <div style="flex:1;display:flex;flex-direction:column;gap:20px;min-width:0;">
          ${pics.slice(1, 3).map((s) => `<img class="warm" src="${s}" style="flex:1;min-height:0;width:100%;object-fit:cover;border-radius:5px;"/>`).join('')}
        </div>
      </div>
      <div style="height:290px;padding-top:34px;box-sizing:border-box;text-align:center;">
        <div style="display:inline-block;font-family:var(--sans);font-size:18px;font-weight:500;letter-spacing:4px;text-transform:uppercase;color:#fff;background:var(--sage);padding:9px 22px;border-radius:30px;">Save for later</div>
        <div style="margin-top:22px;font-family:var(--serif);font-weight:700;font-size:50px;line-height:1.12;color:var(--ink);">${headline}</div>
        <div style="margin-top:14px;font-family:var(--sans);font-size:20px;letter-spacing:3px;color:var(--muted);">${BRAND}</div>
      </div>
    </div>`;
  },

  // 3 — soft-overlay: full-bleed image with a warm bottom gradient; serif
  // headline reads over it. Best when the single image is strong on its own.
  ({ headline, image }) => {
    const num = (String(headline).match(/\d+/) || [])[0];
    return `
    <div style="width:1000px;height:1500px;position:relative;">
      <img class="warm" src="${image}" style="width:100%;height:100%;object-fit:cover;"/>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(40,26,15,0.22),rgba(40,26,15,0) 34%,rgba(40,26,15,0.82));"></div>
      ${num ? `<div style="position:absolute;top:44px;left:44px;background:var(--terra);color:#fff;font-family:var(--sans);font-weight:600;font-size:29px;padding:13px 25px;border-radius:13px;">${num} ideas</div>` : ''}
      <div style="position:absolute;left:64px;right:64px;bottom:150px;text-align:center;color:#fff;">
        <div style="width:56px;height:2px;background:rgba(255,255,255,0.85);margin:0 auto 24px;"></div>
        <div style="font-family:var(--serif);font-weight:700;font-size:64px;line-height:1.08;text-shadow:0 2px 22px rgba(0,0,0,0.4);">${headline}</div>
        <div style="margin-top:22px;font-family:var(--sans);font-size:21px;letter-spacing:4px;text-transform:uppercase;opacity:0.92;">${BRAND}</div>
      </div>
    </div>`;
  },

  // 4 — framed-inspo: the image shown as a framed print on a warm cream "wall"
  // with a soft cast shadow. Minimal text — reads as decor inspiration, not an ad.
  ({ headline, image }) => `
    <div style="width:1000px;height:1500px;background:linear-gradient(165deg,#f4ece0,#e7dbc7);position:relative;">
      <div style="position:absolute;top:132px;left:50%;transform:translateX(-50%);background:#fff;padding:26px;box-shadow:0 34px 70px rgba(60,40,20,0.26);">
        <img class="warm" src="${image}" style="width:540px;height:760px;object-fit:cover;display:block;"/>
      </div>
      <div style="position:absolute;left:70px;right:70px;bottom:150px;text-align:center;">
        <div style="width:54px;height:2px;background:var(--terra);margin:0 auto 22px;"></div>
        <div style="font-family:var(--serif);font-weight:700;font-size:50px;line-height:1.14;color:var(--ink);">${headline}</div>
        <div style="margin-top:18px;font-family:var(--sans);font-size:20px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);">${BRAND}</div>
      </div>
    </div>`,
];

async function generatePin({ headline, images, output, templateIdx }) {
  // Embed images as base64 to avoid file:// protocol issues
  const dataUrls = images.map(
    (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`
  );

  // Shared design tokens. Playfair (serif) + Poppins (sans) are the aesthetic
  // upgrade; if the font CDN is unreachable the stack falls back to Georgia/
  // Helvetica, so the pin still renders cleanly offline. The .warm filter nudges
  // every photo toward the same cozy tone so mismatched stock reads as one set.
  const head = `<head><style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Poppins:wght@400;500;600&display=swap');
    :root{--serif:'Playfair Display',Georgia,'Times New Roman',serif;--sans:'Poppins','Helvetica Neue',Arial,sans-serif;
      --cream:#faf6ee;--frame:#efe6d6;--ink:#33271c;--muted:#a08a6e;--terra:#b05a3c;--sage:#6b7355;}
    *{box-sizing:border-box;} img{display:block;}
    .warm{filter:saturate(1.06) brightness(1.02) sepia(0.05);}
  </style></head>`;
  const html = `<html>${head}<body style="margin:0;">${TEMPLATES[templateIdx]({ headline, image: dataUrls[0], images: dataUrls })}</body></html>`;
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  // Wait for web fonts (bounded) so serif headlines don't screenshot as fallback.
  try { await Promise.race([page.evaluate(() => document.fonts.ready), new Promise((r) => setTimeout(r, 4000))]); } catch { /* offline → fallback fonts */ }
  await page.screenshot({ path: output, type: 'png' });
  await browser.close();
}

// Measured template verdicts from the weekly feedback loop
// (content/template-performance.json, written by scripts/6-template-feedback.js):
// drop 'kill' templates from the rotation, move 'scale' templates to the front.
// Missing/empty file = no reordering (cold start).
function applyVerdicts(order) {
  let verdicts = {};
  try {
    verdicts = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'content', 'template-performance.json'), 'utf-8')
    ).templates || {};
  } catch { return order; }
  const v = (i) => (verdicts[TEMPLATE_KEYS[i]] || {}).verdict;
  const kept = order.filter((i) => v(i) !== 'kill');
  const base = kept.length ? kept : order; // never kill everything
  return [...base.filter((i) => v(i) === 'scale'), ...base.filter((i) => v(i) !== 'scale')];
}

(async () => {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error('No articles found. Run `npm run generate` first.');
    process.exit(1);
  }

  // Optional --only=<substr> filter (same convention as 5-post-pins.js).
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !onlyArg || f.includes(onlyArg));
  console.log(`Generating pins for ${files.length} article(s)...`);
  let total = 0;

  for (const file of files) {
    const article = JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8'));
    const pinDir = path.join(PINS_DIR, article.topic_slug);
    fs.mkdirSync(pinDir, { recursive: true });

    // Collect up to 4 pick images (rank order). The top pick's image feeds the
    // single-image templates; 3+ images unlock the save-optimized collage
    // templates (see pinterest-playbook-2026.md rule 1).
    const imgPaths = [];
    for (const p of [...article.picks].sort((a, b) => a.rank - b.rank)) {
      const ip = path.resolve(process.cwd(), 'public', 'images', 'breeds', breedToSlug(p.breed), '1.jpg');
      if (fs.existsSync(ip)) imgPaths.push(ip);
      if (imgPaths.length >= 4) break;
    }
    if (!imgPaths.length) {
      console.warn(`  Skipping ${article.topic_slug}: no pick images found`);
      continue;
    }
    // Pins post in pin-1..N order (one per article per ~week), so lead with the
    // collage templates — the highest-save format — then rotate the rest.
    // The weekly feedback loop then reshuffles: measured 'kill' templates are
    // dropped and 'scale' templates move to the front (playbook rule 10).
    // Lead with the collage (highest-save idea format) when ≥3 pick images are
    // available, then hero-stack; fall back to the single-image editorial styles.
    // The weekly feedback loop reshuffles from measured saves (playbook rule 10).
    const order = applyVerdicts(
      imgPaths.length >= 3 ? [1, 2, 0, 3, 4] : [0, 3, 4]
    );

    const manifestPath = path.join(pinDir, 'manifest.json');
    let manifest = {};
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch { /* first run */ }

    for (let i = 0; i < article.pin_headlines.length; i++) {
      const output = path.join(pinDir, `pin-${i + 1}.png`);
      if (fs.existsSync(output)) continue;
      const templateIdx = order[i % order.length];
      await generatePin({
        headline: article.pin_headlines[i],
        images: imgPaths,
        output,
        templateIdx,
      });
      manifest[`pin-${i + 1}.png`] = TEMPLATE_KEYS[templateIdx];
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      total++;
      process.stdout.write(`\r${total} pins generated`);
    }
  }
  console.log(`\nDone. ${total} pins saved to public/pins/`);
})();
