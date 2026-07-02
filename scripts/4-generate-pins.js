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
const TEMPLATE_KEYS = [
  'color-block-hero',   // 0
  'dark-editorial',     // 1
  'serif-split',        // 2
  'full-bleed-overlay', // 3
  'polaroid',           // 4
  'list-badge',         // 5
  'save-ribbon',        // 6
  'bold-color',         // 7
  'collage-grid',       // 8
  'collage-stack',      // 9
];

function breedToSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// 8 pin templates — rotated to avoid Pinterest "templated content" detection.
// Templates 6–7 are SAVE-optimized (list-count badge + explicit "save" cue);
// template 8 is the bold colored-background "clickbait" style (rotates red/blue/
// purple/gold) that classic Pinterest growth guides swear by; 1–5 lean click-through.
const TEMPLATES = [
  ({ headline, image }) => `
    <div style="width:1000px;height:1500px;font-family:'Georgia',serif;position:relative;">
      <div style="position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(135deg,#b05a3c,#d98a63);color:#fff;padding:90px 70px;box-sizing:border-box;">
        <div style="font-size:24px;opacity:0.85;margin-bottom:20px;">${BRAND}</div>
        <div style="font-size:78px;font-weight:bold;line-height:1.05;letter-spacing:-1px;">${headline}</div>
      </div>
      <img src="${image}" style="position:absolute;bottom:0;width:100%;height:60%;object-fit:cover;"/>
      <div style="position:absolute;bottom:50px;right:50px;background:#fff;color:#b05a3c;padding:24px 44px;border-radius:60px;font-weight:bold;font-size:30px;">Tap to see →</div>
    </div>`,

  ({ headline, image }) => `
    <div style="width:1000px;height:1500px;font-family:'Inter',sans-serif;position:relative;background:#1a1a1a;">
      <img src="${image}" style="width:100%;height:60%;object-fit:cover;"/>
      <div style="padding:70px 60px;color:#fff;">
        <div style="font-size:22px;opacity:0.7;margin-bottom:15px;text-transform:uppercase;letter-spacing:3px;">${BRAND}</div>
        <div style="font-size:72px;font-weight:900;line-height:1.05;">${headline}</div>
        <div style="margin-top:40px;display:inline-block;background:#f5b942;color:#1a1a1a;padding:22px 40px;border-radius:50px;font-weight:bold;font-size:28px;">See the list →</div>
      </div>
    </div>`,

  ({ headline, image }) => `
    <div style="width:1000px;height:1500px;font-family:'Georgia',serif;position:relative;background:#f8f3ea;display:flex;flex-direction:column;">
      <div style="flex:1;display:flex;align-items:center;padding:60px;">
        <div>
          <div style="font-size:20px;color:#8b6f47;text-transform:uppercase;letter-spacing:4px;margin-bottom:25px;">${BRAND}</div>
          <div style="font-size:84px;font-weight:bold;line-height:1.0;color:#3a2817;">${headline}</div>
        </div>
      </div>
      <img src="${image}" style="width:100%;height:55%;object-fit:cover;"/>
    </div>`,

  ({ headline, image }) => `
    <div style="width:1000px;height:1500px;font-family:'Georgia',serif;position:relative;">
      <img src="${image}" style="width:100%;height:100%;object-fit:cover;"/>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.1) 40%,rgba(0,0,0,0.7) 100%);"></div>
      <div style="position:absolute;top:60px;left:60px;right:60px;color:#fff;font-size:24px;opacity:0.9;">${BRAND}</div>
      <div style="position:absolute;bottom:120px;left:60px;right:60px;color:#fff;">
        <div style="font-size:74px;font-weight:bold;line-height:1.05;text-shadow:0 2px 20px rgba(0,0,0,0.5);">${headline}</div>
      </div>
      <div style="position:absolute;bottom:50px;left:60px;background:#fff;color:#222;padding:20px 38px;border-radius:50px;font-weight:bold;font-size:26px;">Tap to read →</div>
    </div>`,

  ({ headline, image }) => `
    <div style="width:1000px;height:1500px;font-family:'Helvetica',sans-serif;background:#faf4ec;padding:60px;box-sizing:border-box;">
      <div style="background:#fff;padding:40px 40px 80px;box-shadow:0 20px 60px rgba(0,0,0,0.15);transform:rotate(-2deg);">
        <img src="${image}" style="width:100%;height:600px;object-fit:cover;"/>
        <div style="margin-top:40px;font-size:62px;font-weight:bold;line-height:1.1;color:#2d2d2d;">${headline}</div>
      </div>
      <div style="text-align:center;margin-top:60px;color:#999;font-size:24px;letter-spacing:3px;">${BRAND}</div>
    </div>`,

  // ── Save-optimized: list-count badge + explicit "Save it" cue (people bookmark
  // numbered idea lists to act on later → drives SAVES, the #1 reach signal). ──
  ({ headline, image }) => {
    const num = (String(headline).match(/\d+/) || [])[0];
    return `
    <div style="width:1000px;height:1500px;font-family:'Inter',sans-serif;position:relative;background:#fff;">
      <img src="${image}" style="width:100%;height:64%;object-fit:cover;"/>
      ${num ? `<div style="position:absolute;top:42px;left:42px;background:#b05a3c;color:#fff;font-weight:900;font-size:52px;line-height:1;padding:20px 28px;border-radius:18px;text-align:center;">${num}<div style="font-size:22px;font-weight:700;letter-spacing:3px;margin-top:6px;">IDEAS</div></div>` : ''}
      <div style="position:absolute;top:42px;right:42px;background:rgba(255,255,255,0.95);color:#b05a3c;font-weight:bold;font-size:27px;padding:15px 28px;border-radius:50px;box-shadow:0 6px 20px rgba(0,0,0,0.18);">📌 Save it</div>
      <div style="padding:52px 60px;box-sizing:border-box;">
        <div style="font-size:70px;font-weight:900;line-height:1.05;color:#1a1a1a;">${headline}</div>
        <div style="margin-top:28px;font-size:22px;color:#999;text-transform:uppercase;letter-spacing:3px;">${BRAND} · save for later</div>
      </div>
    </div>`;
  },

  // ── Save-optimized: full-bleed inspo image + "SAVE THIS" ribbon ──
  ({ headline, image }) => `
    <div style="width:1000px;height:1500px;font-family:'Georgia',serif;position:relative;">
      <img src="${image}" style="width:100%;height:100%;object-fit:cover;"/>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.04) 35%,rgba(0,0,0,0.78));"></div>
      <div style="position:absolute;top:50px;left:50px;background:#f5b942;color:#1a1a1a;font-weight:bold;font-size:27px;padding:15px 32px;border-radius:8px;letter-spacing:1px;">📌 SAVE THIS</div>
      <div style="position:absolute;bottom:80px;left:60px;right:60px;color:#fff;text-align:center;">
        <div style="font-size:76px;font-weight:bold;line-height:1.05;text-shadow:0 2px 18px rgba(0,0,0,0.6);">${headline}</div>
        <div style="margin-top:26px;font-size:24px;opacity:0.9;letter-spacing:2px;">${BRAND}</div>
      </div>
    </div>`,

  // Bold colored-background "clickbait" style (the classic Pinterest-growth look):
  // strong color block + photo + big high-contrast headline. Color rotates by
  // headline so pins vary.
  ({ headline, image }) => {
    const palette = ["#c0392b", "#21407a", "#6c3483", "#b8860b"]; // red, blue, purple, gold
    let h = 0;
    for (let i = 0; i < String(headline).length; i++) h = (h * 31 + String(headline).charCodeAt(i)) >>> 0;
    const bg = palette[h % palette.length];
    return `
    <div style="width:1000px;height:1500px;font-family:'Helvetica',sans-serif;background:${bg};position:relative;">
      <img src="${image}" style="width:100%;height:56%;object-fit:cover;"/>
      <div style="padding:58px 60px;color:#fff;">
        <div style="font-size:80px;font-weight:900;line-height:1.03;text-shadow:0 2px 14px rgba(0,0,0,0.35);">${headline}</div>
        <div style="margin-top:36px;display:inline-block;background:#fff;color:${bg};font-weight:800;font-size:30px;padding:18px 42px;border-radius:50px;">Read more →</div>
      </div>
      <div style="position:absolute;bottom:30px;left:0;right:0;text-align:center;color:rgba(255,255,255,0.85);font-size:22px;letter-spacing:2px;">${BRAND}</div>
    </div>`;
  },

  // ── Multi-image "N ideas" COLLAGE — the highest-save pin format for idea
  // content (Tailwind 2025, see content/pinterest-playbook-2026.md). Uses 3-4
  // DIFFERENT pick images so each pin is also a fresh image combination.
  // Only rotated in when the article has ≥3 pick images (see main loop). ──
  ({ headline, image, images = [] }) => {
    const pics = (images.length >= 3 ? images : [image]).slice(0, 4);
    const num = (String(headline).match(/\d+/) || [])[0];
    const cells = pics
      .map((src, i) =>
        `<img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;${pics.length === 3 && i === 0 ? 'grid-column:1/3;' : ''}"/>`
      )
      .join('');
    return `
    <div style="width:1000px;height:1500px;font-family:'Inter',sans-serif;background:#fff;position:relative;display:flex;flex-direction:column;">
      <div style="height:930px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:8px;overflow:hidden;">${cells}</div>
      ${num ? `<div style="position:absolute;top:40px;left:40px;background:#b05a3c;color:#fff;font-weight:900;font-size:54px;line-height:1;padding:22px 30px;border-radius:18px;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.25);">${num}<div style="font-size:20px;font-weight:700;letter-spacing:3px;margin-top:6px;">IDEAS</div></div>` : ''}
      <div style="flex:1;padding:48px 60px 0;box-sizing:border-box;text-align:center;">
        <div style="font-size:62px;font-weight:900;line-height:1.08;color:#1f1f1f;">${headline}</div>
        <div style="margin-top:24px;font-size:22px;color:#a09383;text-transform:uppercase;letter-spacing:3px;">${BRAND}</div>
      </div>
    </div>`;
  },

  // ── Magazine-stack collage: one hero + two stacked images, save cue on top,
  // headline BELOW the photos, bottom 15% kept clear of critical text. ──
  ({ headline, image, images = [] }) => {
    const pics = (images.length >= 3 ? images : [image, image, image]).slice(0, 3);
    return `
    <div style="width:1000px;height:1500px;font-family:'Georgia',serif;background:#f6f0e6;position:relative;box-sizing:border-box;padding:44px;">
      <div style="display:flex;gap:14px;height:820px;">
        <img src="${pics[0]}" style="flex:1.6;height:100%;object-fit:cover;min-width:0;"/>
        <div style="flex:1;display:flex;flex-direction:column;gap:14px;min-width:0;">
          ${pics.slice(1).map((s) => `<img src="${s}" style="flex:1;min-height:0;width:100%;object-fit:cover;"/>`).join('')}
        </div>
      </div>
      <div style="margin-top:44px;text-align:center;">
        <div style="display:inline-block;background:#2d4a3e;color:#fff;font-size:24px;padding:12px 30px;border-radius:40px;letter-spacing:2px;">📌 SAVE FOR LATER</div>
        <div style="margin-top:26px;font-size:64px;font-weight:bold;line-height:1.06;color:#33271c;">${headline}</div>
        <div style="margin-top:22px;font-size:22px;color:#a08a6e;letter-spacing:3px;">${BRAND}</div>
      </div>
    </div>`;
  },
];

async function generatePin({ headline, images, output, templateIdx }) {
  // Embed images as base64 to avoid file:// protocol issues
  const dataUrls = images.map(
    (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString('base64')}`
  );

  const html = `<html><head></head><body style="margin:0;">${TEMPLATES[templateIdx]({ headline, image: dataUrls[0], images: dataUrls })}</body></html>`;
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
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
    const order = applyVerdicts(
      imgPaths.length >= 3 ? [8, 9, 6, 0, 7, 1, 2, 3, 4, 5] : [6, 0, 7, 1, 2, 3, 4, 5]
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
