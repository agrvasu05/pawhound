/**
 * generate-freebie.js — builds the lead-magnet PDF (the free printable people
 * opt in to get). Hand-crafted, on the proven home/cozy niche. Output:
 *   public/freebies/cozy-home-reset.pdf
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BRAND = 'Value Finds Daily';
const SITE = 'valuefindsdaily.com';
const ACCENT = '#b05a3c';
const OUT_DIR = path.join(process.cwd(), 'public', 'freebies');
const OUT = path.join(OUT_DIR, 'cozy-home-reset.pdf');

const DAYS = [
  { d: 'Day 1', t: 'The 15-Minute Reset', items: ['Clear every flat surface (counters, table, nightstand)', 'Make all the beds', 'Open the curtains + let light in', 'Light a candle or diffuse a scent you love'] },
  { d: 'Day 2', t: 'Entryway & First Impression', items: ['Clear shoes + coats to their home', 'Add a tray for keys/mail', 'One plant or a small framed print', 'Wipe the door + handle'] },
  { d: 'Day 3', t: 'The Cozy Living Room', items: ['Fluff + karate-chop the cushions', 'Fold throws into a basket', 'Group decor in odd numbers (1, 3, 5)', 'Hide cables; clear the coffee table to 3 items'] },
  { d: 'Day 4', t: 'Kitchen Calm', items: ['Clear counters to your 3 daily-use items', 'Decant coffee/tea into matching jars', 'A bowl of fruit or a small vase', 'Fresh tea towel on display'] },
  { d: 'Day 5', t: 'Bedroom Sanctuary', items: ['Layer the bed: sheet, duvet, throw, 2–3 pillows', 'Clear the nightstand to lamp + book + 1 object', 'Tuck a basket for laundry', 'Warm, low lighting only'] },
  { d: 'Day 6', t: 'Warmth & Texture', items: ['Add one woven, knit, or linen texture per room', 'Swap one cool light bulb for warm (2700K)', 'A scent per zone (citrus = kitchen, vanilla = bedroom)', 'Style one shelf: book stack + object + greenery'] },
  { d: 'Day 7', t: 'The Finishing Layer', items: ['Add greenery or dried stems to 2 rooms', 'Hang or lean one piece of art you love', 'Create one “cozy corner” (chair + throw + light)', 'Step back, take a photo, enjoy it'] },
];

function dayCard(x) {
  return `<div class="page">
    <div class="kick">${BRAND} · 7-Day Cozy Home Reset</div>
    <div class="dayhdr"><span class="daynum">${x.d}</span><h2>${x.t}</h2></div>
    <div class="checks">
      ${x.items.map((i) => `<label class="check"><span class="box"></span><span>${i}</span></label>`).join('')}
      <label class="check"><span class="box"></span><span style="color:#999">Your own touch: ________________________________</span></label>
    </div>
    <div class="note">Notes &amp; wins<br><span class="lines"></span><span class="lines"></span><span class="lines"></span></div>
    <div class="foot">${SITE}</div>
  </div>`;
}

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page{size:Letter;margin:0}*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Georgia,'Times New Roman',serif;color:#33271c}
.page{width:8.5in;height:11in;padding:0.85in 0.9in;position:relative;page-break-after:always;background:#fbf7f1}
.page:last-child{page-break-after:auto}
.kick{font-size:9pt;letter-spacing:.22em;text-transform:uppercase;color:${ACCENT};margin-bottom:24pt}
h1{font-size:40pt;line-height:1.05;color:#2c2117;margin:6pt 0 10pt}
h2{font-size:24pt;color:#2c2117}
.cover{background:linear-gradient(160deg,#f3e9dc,#e9d8c4);text-align:center;display:flex}
.cover .inner{margin:auto}
.tag{font-size:14pt;font-style:italic;color:#7d6a52;margin:14pt 0 24pt}
.cover .badge{display:inline-block;background:${ACCENT};color:#fff;font-size:11pt;letter-spacing:.15em;text-transform:uppercase;padding:10pt 22pt;border-radius:40pt}
.dayhdr{display:flex;align-items:baseline;gap:14pt;border-bottom:2px solid #e7d8c4;padding-bottom:10pt;margin-bottom:18pt}
.daynum{font-size:13pt;letter-spacing:.15em;text-transform:uppercase;color:${ACCENT};font-family:Helvetica,sans-serif;font-weight:bold}
.checks{display:flex;flex-direction:column;gap:14pt;margin-bottom:26pt}
.check{display:flex;align-items:flex-start;gap:12pt;font-size:13pt;line-height:1.4}
.box{width:18pt;height:18pt;border:2px solid ${ACCENT};border-radius:4pt;flex-shrink:0;margin-top:1pt}
.note{background:#f3e9dc;border-radius:8pt;padding:16pt 18pt;font-size:10pt;color:#8a7257;text-transform:uppercase;letter-spacing:.1em}
.lines{display:block;border-bottom:1px solid #d9c6ad;height:22pt}
.foot{position:absolute;bottom:0.5in;left:0;right:0;text-align:center;font-size:9pt;letter-spacing:.14em;text-transform:uppercase;color:#b09a7e}
.intro p{font-size:12.5pt;line-height:1.7;margin-bottom:12pt}
.intro h2{margin-bottom:14pt}
.tips{background:#f3e9dc;border-radius:8pt;padding:18pt 22pt;margin-top:18pt}
.tips li{font-size:11.5pt;line-height:1.6;margin-left:18pt;margin-bottom:6pt}
</style></head><body>
  <section class="page cover"><div class="inner">
    <div class="kick">${BRAND}</div>
    <h1>The Cozy Home Reset</h1>
    <div class="tag">A 7-day checklist to a warmer, calmer, more beautiful home — in 15 minutes a day.</div>
    <div class="badge">Free Printable</div>
    <div class="foot">${SITE}</div>
  </div></section>
  <section class="page intro">
    <div class="kick">${BRAND} · 7-Day Cozy Home Reset</div>
    <h2>Welcome — let's make home feel good again 🤎</h2>
    <p>You don't need a renovation or a big budget to love your space. You need a little intention, a few minutes a day, and a plan. That's exactly what this is.</p>
    <p>Each day has 4 quick wins — most take under 15 minutes. Print it, stick it on the fridge, and check off as you go. By Day 7 your home will feel warmer, calmer, and genuinely <em>yours</em>.</p>
    <div class="tips"><strong>How to use it</strong>
      <ul><li>Do one day at a time — no skipping ahead.</li><li>Set a 15-minute timer; stop when it dings.</li><li>Take a “before” photo today and an “after” on Day 7.</li></ul>
    </div>
    <div class="foot">${SITE}</div>
  </section>
  ${DAYS.map(dayCard).join('')}
  <section class="page">
    <div class="kick">${BRAND} · 7-Day Cozy Home Reset</div>
    <div class="dayhdr"><span class="daynum">Bonus</span><h2>Keep the cozy going</h2></div>
    <div class="intro">
      <p>Loved this? These pair perfectly with the reset:</p>
      <div class="tips"><ul>
        <li><strong>Home Organization &amp; Decor Planner</strong> — room-by-room, month-by-month.</li>
        <li><strong>Printable Wall Art Sets</strong> — warm, cozy prints to finish any wall.</li>
        <li>New free guides + trends every week at <strong>${SITE}</strong>.</li>
      </ul></div>
      <p style="margin-top:18pt;font-style:italic;color:#7d6a52;">Tag your reset — we love seeing it. Happy nesting!</p>
    </div>
    <div class="foot">${SITE}</div>
  </section>
</body></html>`;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 300));
  await page.pdf({ path: OUT, format: 'Letter', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });

  // Cover PNG for the pin pipeline (products/freebie-pins.js): screenshot the
  // cover page so freebie pins can use the same scene-mockup renderer as shop pins.
  const coverDir = path.join(process.cwd(), 'public', 'shop-assets', 'freebie');
  fs.mkdirSync(coverDir, { recursive: true });
  await page.setViewport({ width: 850, height: 1100, deviceScaleFactor: 1 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(coverDir, 'cover.png'), clip: { x: 0, y: 0, width: 816, height: 1056 } });

  await browser.close();
  console.log(`✓ freebie → ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
  console.log(`✓ cover  → ${path.join(coverDir, 'cover.png')}`);
})();
