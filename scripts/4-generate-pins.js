/**
 * 4-generate-pins.js — OPTIONAL batch pre-render of content pins to
 * public/pins/<slug>/pin-N.png (+ a Ken Burns video of pin-1).
 *
 * Since October 2026 the daily pipeline no longer runs this: 5-post-pins.js
 * renders each pin at post time and uploads it as base64, so public/pins stopped
 * growing (it had reached 2.8 GB and slowed every checkout + Netlify build).
 * Keep this for local previews:  node scripts/4-generate-pins.js --only=<slug>
 * Templates live in scripts/pin-renderer.js.
 */
const fs = require('fs');
const path = require('path');
const { renderKenBurnsFromImage } = require('./lib-video');
const { TEMPLATE_KEYS, renderPin, articleImages, templateOrder } = require('./pin-renderer');

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');
const PINS_DIR = path.join(process.cwd(), 'public', 'pins');

(async () => {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error('No articles found. Run `npm run generate` first.');
    process.exit(1);
  }
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
  const limitArg = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0', 10);
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !onlyArg || f.includes(onlyArg));
  console.log(`Generating pins for ${files.length} article(s)...`);
  let total = 0;

  for (const file of files) {
    const article = JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf-8'));
    const pinDir = path.join(PINS_DIR, article.topic_slug);
    const imgPaths = articleImages(article);
    if (!imgPaths.length) { console.warn(`  Skipping ${article.topic_slug}: no pick images found`); continue; }
    fs.mkdirSync(pinDir, { recursive: true });
    const order = templateOrder(imgPaths.length);
    const manifestPath = path.join(pinDir, 'manifest.json');
    let manifest = {};
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')); } catch { /* first run */ }

    const n = limitArg ? Math.min(limitArg, article.pin_headlines.length) : article.pin_headlines.length;
    for (let i = 0; i < n; i++) {
      const output = path.join(pinDir, `pin-${i + 1}.png`);
      if (fs.existsSync(output)) continue;
      const templateIdx = order[i % order.length];
      await renderPin({ headline: article.pin_headlines[i], images: imgPaths, output, templateIdx });
      manifest[`pin-${i + 1}.png`] = TEMPLATE_KEYS[templateIdx];
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      total++;
      process.stdout.write(`\r${total} pins generated`);
    }

    const videoOut = path.join(pinDir, 'video-1.mp4');
    const videoCover = path.join(pinDir, 'video-1-cover.jpg');
    const leadPin = path.join(pinDir, 'pin-1.png');
    if (!fs.existsSync(videoOut) && fs.existsSync(leadPin)) {
      await renderKenBurnsFromImage({ imagePath: leadPin, outPath: videoOut, coverPath: videoCover });
      manifest['video-1.mp4'] = 'video';
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`\n  ✓ video-1.mp4`);
    }
  }
  console.log(`\nDone. ${total} pins saved to public/pins/`);
})();
