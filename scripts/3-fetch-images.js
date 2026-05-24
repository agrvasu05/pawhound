require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const fs = require('fs');
const path = require('path');

const PEXELS_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_KEY) {
  console.error('Error: PEXELS_API_KEY not set in .env.local');
  process.exit(1);
}

const breedsFile = path.join(process.cwd(), 'content', 'breeds.json');
if (!fs.existsSync(breedsFile)) {
  console.error('Error: content/breeds.json not found. Run `npm run scrape` first.');
  process.exit(1);
}
const breeds = JSON.parse(fs.readFileSync(breedsFile, 'utf-8'));

async function fetchImagesForBreed(breed) {
  const dir = path.join(process.cwd(), 'public', 'images', 'breeds', breed.slug);
  if (fs.existsSync(path.join(dir, '1.jpg'))) return 'skip';

  const query = encodeURIComponent(`${breed.name} dog`);
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${query}&per_page=3&orientation=landscape`,
    { headers: { Authorization: PEXELS_KEY } }
  );

  if (!res.ok) throw new Error(`Pexels API error ${res.status}`);

  const data = await res.json();
  if (!data.photos || data.photos.length === 0) return 'no-image';

  fs.mkdirSync(dir, { recursive: true });

  for (let i = 0; i < data.photos.length; i++) {
    const imgUrl = data.photos[i].src.large;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) continue;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    fs.writeFileSync(path.join(dir, `${i + 1}.jpg`), buf);
  }

  // Save attribution (Pexels license requires credit)
  const attribution = data.photos.map((p) => ({
    photographer: p.photographer,
    url: p.photographer_url,
  }));
  fs.writeFileSync(path.join(dir, 'attribution.json'), JSON.stringify(attribution, null, 2));

  return 'ok';
}

// If --new-only flag, only fetch breeds used in articles that are missing images
const newOnly = process.argv.includes('--new-only');
let targetBreeds = breeds;

if (newOnly) {
  const articlesDir = path.join(process.cwd(), 'content', 'articles');
  if (fs.existsSync(articlesDir)) {
    const usedBreeds = new Set();
    for (const file of fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'))) {
      const article = JSON.parse(fs.readFileSync(path.join(articlesDir, file), 'utf-8'));
      for (const pick of article.picks) {
        usedBreeds.add(pick.breed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
      }
    }
    targetBreeds = breeds.filter((b) => usedBreeds.has(b.slug));
  }
}

const pending = targetBreeds.filter((b) => {
  return !fs.existsSync(path.join(process.cwd(), 'public', 'images', 'breeds', b.slug, '1.jpg'));
});

console.log(`Fetching images for ${pending.length} breeds from Pexels...`);

(async () => {
  let done = 0, skipped = 0;
  for (const breed of pending) {
    try {
      const result = await fetchImagesForBreed(breed);
      if (result === 'no-image') skipped++;
      else done++;
      process.stdout.write(`\r${done} downloaded, ${skipped} no result — ${breed.name}    `);
    } catch (e) {
      skipped++;
      process.stdout.write(`\r${done} downloaded, ${skipped} failed — ${breed.name}    `);
    }
    await new Promise((r) => setTimeout(r, 400)); // Pexels free tier: 200 req/hr
  }
  console.log(`\nDone. ${done} images saved, ${skipped} skipped.`);
})();
