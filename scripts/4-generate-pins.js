const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');
const PINS_DIR = path.join(process.cwd(), 'public', 'pins');
const BRAND = 'valuefindsdaily.com';

function breedToSlug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// 5 pin templates — rotated to avoid Pinterest "templated content" detection
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
];

async function generatePin({ headline, image, output, templateIdx }) {
  // Embed image as base64 to avoid file:// protocol issues
  const imageBuffer = fs.readFileSync(image);
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;

  const html = `<html><head></head><body style="margin:0;">${TEMPLATES[templateIdx]({ headline, image: dataUrl })}</body></html>`;
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: output, type: 'png' });
  await browser.close();
}

(async () => {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error('No articles found. Run `npm run generate` first.');
    process.exit(1);
  }

  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.json'));
  console.log(`Generating pins for ${files.length} article(s)...`);
  let total = 0;

  for (const file of files) {
    const article = JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8'));
    const pinDir = path.join(PINS_DIR, article.topic_slug);
    fs.mkdirSync(pinDir, { recursive: true });

    const topBreed = article.picks.find((p) => p.rank === 1);
    if (!topBreed) continue;

    const breedImgPath = path.resolve(
      process.cwd(),
      'public',
      'images',
      'breeds',
      breedToSlug(topBreed.breed),
      '1.jpg'
    );

    if (!fs.existsSync(breedImgPath)) {
      console.warn(`  Skipping ${article.topic_slug}: missing image for ${topBreed.breed}`);
      continue;
    }

    for (let i = 0; i < article.pin_headlines.length; i++) {
      const output = path.join(pinDir, `pin-${i + 1}.png`);
      if (fs.existsSync(output)) continue;
      await generatePin({
        headline: article.pin_headlines[i],
        image: breedImgPath,
        output,
        templateIdx: i % TEMPLATES.length,
      });
      total++;
      process.stdout.write(`\r${total} pins generated`);
    }
  }
  console.log(`\nDone. ${total} pins saved to public/pins/`);
})();
