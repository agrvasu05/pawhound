/**
 * fetch-scenes.js — one-off: download a few royalty-free interior + desk
 * backgrounds from Pexels into public/scenes/. The pin renderer composites the
 * product onto these so pins look like real lifestyle mockups (art on a wall,
 * page on a desk) — which earn far more SAVES than a flat gradient.
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const fs = require('fs');
const path = require('path');

const KEY = process.env.PEXELS_API_KEY;
if (!KEY) { console.error('PEXELS_API_KEY missing'); process.exit(1); }
const DIR = path.join(process.cwd(), 'public', 'scenes');
fs.mkdirSync(DIR, { recursive: true });

// category -> search queries (we keep the cleanest results)
const SETS = {
  wall: ['minimalist living room wall sofa', 'scandinavian living room neutral wall', 'cozy bedroom wall decor', 'neutral interior wall shelf plant', 'beige living room minimal'],
  desk: ['wooden desk flatlay minimal top view', 'cozy desk coffee notebook top view', 'neutral stationery flatlay', 'minimal desk plant flatlay'],
};

async function search(q, n = 3) {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}&orientation=landscape`, { headers: { Authorization: KEY } });
  if (!r.ok) return [];
  return (await r.json()).photos || [];
}
async function dl(url, out) { const r = await fetch(url); if (!r.ok) return false; fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); return true; }

(async () => {
  for (const [cat, queries] of Object.entries(SETS)) {
    let i = 1;
    for (const q of queries) {
      const photos = await search(q, 2);
      for (const p of photos) {
        const out = path.join(DIR, `${cat}-${i}.jpg`);
        if (await dl(p.src.large, out)) { console.log(`✓ ${cat}-${i}.jpg  (${q})`); i++; }
        if (i > 5) break;
        await new Promise((r) => setTimeout(r, 300));
      }
      if (i > 5) break;
    }
  }
  console.log('Done. Scenes in public/scenes/');
})();
