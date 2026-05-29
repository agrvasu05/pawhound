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

// Collect all unique list items from generated articles. Each entry carries the
// niche + an image search query so non-dog niches get relevant photos.
function getBreedsFromArticles() {
  const articlesDir = path.join(process.cwd(), 'content', 'articles');
  if (!fs.existsSync(articlesDir)) return [];
  const items = new Map();
  for (const file of fs.readdirSync(articlesDir).filter((f) => f.endsWith('.json'))) {
    const article = JSON.parse(fs.readFileSync(path.join(articlesDir, file), 'utf-8'));
    const niche = article.niche || 'dogs';
    for (const pick of article.picks) {
      const slug = breedToSlug(pick.breed);
      if (!items.has(slug)) {
        items.set(slug, { slug, name: pick.breed, niche, query: pick.image_query || pick.breed });
      }
    }
  }
  return [...items.values()];
}

const DOG_KEYWORDS = ['dog', 'puppy', 'pup', 'canine', 'hound', 'breed', 'pet', 'pooch'];

function isDogPhoto(photo) {
  const alt = (photo.alt || '').toLowerCase();
  return DOG_KEYWORDS.some((kw) => alt.includes(kw));
}

async function searchPexels(query, perPage = 5) {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
    { headers: { Authorization: PEXELS_KEY } }
  );
  if (!res.ok) throw new Error(`Pexels API error ${res.status}`);
  const data = await res.json();
  return data.photos || [];
}

async function fetchImagesForBreed(breed) {
  const dir = path.join(process.cwd(), 'public', 'images', 'breeds', breed.slug);
  if (fs.existsSync(path.join(dir, '1.jpg'))) return 'skip';

  let photos = [];

  if ((breed.niche || 'dogs') === 'dogs') {
    // Dogs: try progressively broader queries, preferring photos whose alt text
    // mentions a dog keyword — prevents wrong images for rare breeds.
    const queries = [
      `${breed.name} dog`,
      `${breed.name} dog breed`,
      `${breed.name}`,
      `${breed.name} puppy`,
    ];
    for (const q of queries) {
      const results = await searchPexels(q, 6);
      const dogPhotos = results.filter(isDogPhoto);
      if (dogPhotos.length >= 3) { photos = dogPhotos.slice(0, 3); break; }
      if (dogPhotos.length > 0) { photos = dogPhotos; break; }
      await new Promise((r) => setTimeout(r, 300));
    }
    // Last resort: generic dog portrait.
    if (photos.length === 0) {
      const fallback = await searchPexels('purebred dog portrait', 6);
      photos = fallback.filter(isDogPhoto).slice(0, 3);
      if (photos.length === 0) photos = fallback.slice(0, 3);
    }
  } else {
    // Non-dog niches: use the item's image_query directly. No dog filtering.
    const queries = [breed.query, breed.name].filter(Boolean);
    for (const q of queries) {
      const results = await searchPexels(q, 6);
      if (results.length > 0) { photos = results.slice(0, 3); break; }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  if (photos.length === 0) return 'no-image';

  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < photos.length; i++) {
    const imgRes = await fetch(photos[i].src.large);
    if (!imgRes.ok) continue;
    fs.writeFileSync(path.join(dir, `${i + 1}.jpg`), Buffer.from(await imgRes.arrayBuffer()));
  }

  const attribution = photos.map((p) => ({
    photographer: p.photographer,
    url: p.photographer_url,
    alt: p.alt,
  }));
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
