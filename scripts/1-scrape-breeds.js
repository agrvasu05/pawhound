const fs = require('fs');
const path = require('path');

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

async function getBreedList() {
  const res = await fetch(
    `${WIKI_API}?action=query&list=categorymembers&cmtitle=Category:Dog_breeds&cmlimit=500&format=json`
  );
  const data = await res.json();
  return data.query.categorymembers.filter(
    (b) => !b.title.includes('Category:')
  );
}

async function enrichBreed(title) {
  const res = await fetch(
    `${WIKI_API}?action=query&prop=extracts|pageimages&titles=${encodeURIComponent(title)}&exintro=true&explaintext=true&piprop=original&format=json`
  );
  const data = await res.json();
  const pages = Object.values(data.query.pages);
  return pages[0];
}

(async () => {
  console.log('Fetching breed list from Wikipedia...');
  const breeds = await getBreedList();
  const enriched = [];

  for (const breed of breeds.slice(0, 200)) {
    try {
      const info = await enrichBreed(breed.title);
      enriched.push({
        name: breed.title,
        slug: breed.title.toLowerCase().replace(/\s+/g, '-'),
        extract: info.extract ? info.extract.slice(0, 500) : '',
        image: info.original?.source,
      });
      process.stdout.write(`\r${enriched.length}/${Math.min(breeds.length, 200)} breeds`);
    } catch (e) {
      console.error(`\nFailed: ${breed.title}`, e.message);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const outDir = path.join(process.cwd(), 'content');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'breeds.json'),
    JSON.stringify(enriched, null, 2)
  );
  console.log(`\nSaved ${enriched.length} breeds to content/breeds.json`);
})();
