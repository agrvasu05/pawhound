const fs = require('fs');
const path = require('path');

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const HEADERS = {
  'User-Agent': 'ValueFindsDaily/1.0 (https://valuefindsdaily.com; hello@valuefindsdaily.com) Node.js',
};

async function wikiGet(params) {
  const url = `${WIKI_API}?${new URLSearchParams({ ...params, format: 'json' })}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    if (text.startsWith('You are making')) {
      console.log(`\nRate limited — waiting ${attempt * 10}s...`);
      await new Promise((r) => setTimeout(r, attempt * 10000));
      continue;
    }
    return JSON.parse(text);
  }
  throw new Error('Rate limited after 5 retries');
}

async function getCategoryPages(category) {
  const pages = [];
  let cmcontinue = null;
  do {
    const data = await wikiGet({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmlimit: '500',
      cmtype: 'page',
      ...(cmcontinue && { cmcontinue }),
    });
    pages.push(...data.query.categorymembers);
    cmcontinue = data.continue?.cmcontinue || null;
    await new Promise((r) => setTimeout(r, 500));
  } while (cmcontinue);
  return pages;
}

async function getCategorySubcats(category) {
  const data = await wikiGet({
    action: 'query',
    list: 'categorymembers',
    cmtitle: category,
    cmlimit: '100',
    cmtype: 'subcat',
  });
  return data.query.categorymembers.map((c) => c.title);
}

function titleToSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isRealBreed(title) {
  const lower = title.toLowerCase();
  if (lower.startsWith('list of')) return false;
  if (lower === 'dog breed') return false;
  if (lower === 'dog breeds') return false;
  if (lower.includes('dog breeds by')) return false;
  if (lower.startsWith('category:')) return false;
  return true;
}

(async () => {
  console.log('Getting subcategories...');
  const subcats = await getCategorySubcats('Category:Dog_breeds');
  console.log(`Found ${subcats.length} subcategories`);

  const allBreeds = new Map();

  // Root category pages
  const rootPages = await getCategoryPages('Category:Dog_breeds');
  for (const p of rootPages) {
    if (isRealBreed(p.title)) allBreeds.set(p.title, p);
  }

  // Subcategory pages
  for (const subcat of subcats) {
    await new Promise((r) => setTimeout(r, 500)); // polite delay
    const pages = await getCategoryPages(subcat);
    for (const p of pages) {
      if (isRealBreed(p.title)) allBreeds.set(p.title, p);
    }
    process.stdout.write(`\r${allBreeds.size} breeds found...`);
  }

  // Save names and slugs only — GPT knows dog breeds, no descriptions needed
  const enriched = [...allBreeds.values()].slice(0, 300).map((b) => ({
    name: b.title,
    slug: titleToSlug(b.title),
    extract: '',
  }));

  const outDir = path.join(process.cwd(), 'content');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'breeds.json'),
    JSON.stringify(enriched, null, 2)
  );
  console.log(`\nSaved ${enriched.length} breeds to content/breeds.json`);
})();
