require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const fs = require('fs');
const path = require('path');

const PEXELS_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_KEY) {
  console.error('Error: PEXELS_API_KEY not set in .env.local');
  process.exit(1);
}

function breedToSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Collect all unique breeds from generated articles
function getBreedsFromArticles() {
  const articlesDir = path.join(process.cwd(), 'content', 'articles');
  if (!fs.existsSync(articlesDir)) return [];
  const breeds = new Map();
  for (const file of fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'))) {
    const article = JSON.parse(fs.readFileSync(path.join(articlesDir, file), 'utf-8'));
    for (const pick of article.picks) {
      const slug = breedToSlug(pick.breed);
      if (!breeds.has(slug)) breeds.set(slug, pick.breed);
    }
  }
  return [...breeds.entries()].map(([slug, name]) => ({ slug, name }));
}

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
    const imgRes = await fetch(data.photos[i].src.large);
    if (!imgRes.ok) continue;
    fs.writeFileSync(path.join(dir, `${i + 1}.jpg`), Buffer.from(await imgRes.arrayBuffer()));
  }

  const attribution = data.photos.map((p) => ({ photographer: p.photographer, url: p.photographer_url }));
  fs.writeFileSync(path.join(dir, 'attribution.json'), JSON.stringify(attribution, null, 2));
  return 'ok';
}

const allBreeds = getBreedsFromArticles();
const pending = allBreeds.filter((b) => {
  return !fs.existsSync(path.join(process.cwd(), 'public', 'images', 'breeds', b.slug, '1.jpg'));
});

if (pending.length === 0) {
  console.log('All breed images already downloaded.');
  process.exit(0);
}

console.log(`Fetching images for ${pending.length} breeds from Pexels...`);

(async () => {
  let done = 0, skipped = 0;
  for (const breed of pending) {
    try {
      const result = await fetchImagesForBreed(breed);
      if (result === 'no-image') skipped++;
      else if (result === 'ok') done++;
      process.stdout.write(`\r${done} downloaded, ${skipped} not found — ${breed.name}    `);
    } catch (e) {
      skipped++;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`\nDone. ${done} images saved, ${skipped} skipped.`);
})();
