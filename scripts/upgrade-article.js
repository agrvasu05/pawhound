/**
 * upgrade-article.js — rewrites an existing guide into an answer-first,
 * data-grounded version and marks it `upgraded_at` (only upgraded guides are
 * indexable; see lib/articles.ts isIndexable).
 *
 * Dog guides: every claim is grounded in content/breeds.json, passed to the
 * model per pick. Ranks and breed names are never changed (image paths and the
 * comparison table derive from them).
 * Home guides: each pick gets a specific, widely sold product name (linked as
 * an exact Amazon search), a "skip if", and concrete specs.
 *
 *   node scripts/upgrade-article.js --slugs=best-apartment-dogs,calm-dog-breeds
 *   node scripts/upgrade-article.js --count=2            # next in the priority queue
 *   node scripts/upgrade-article.js --count=2 --dry-run  # print, don't write
 *
 * Env: UPGRADE_START=YYYY-MM-DD — the scheduled job no-ops before this date
 * (batch 1 is measured in Search Console before scaling).
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const fs = require('fs');
const path = require('path');
const lib = require('../products/lib');

const ARTICLES = path.join(process.cwd(), 'content', 'articles');
const BREEDS = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'breeds.json'), 'utf-8'));
const BY_NAME = new Map(BREEDS.map((b) => [b.name.toLowerCase(), b]));
let REDIRECTED = {};
try { REDIRECTED = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'article-canonical.json'), 'utf-8')); } catch { /* none */ }
const NOINDEX = new Set(['beauty', 'fashion']);
const AUTHOR = 'Elena Marsh';
const YEAR = new Date().getFullYear();

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const DRY = process.argv.includes('--dry-run');

const BANNED = 'Do not use these phrases or anything like them: "is essential", "transform your space", "elevate", "game-changer", "look no further", "in today\'s world", "whether you\'re", "perfect addition", "seamlessly", "dive in", "wonderful experience". No exclamation marks.';
const HONESTY = 'Never claim first-hand testing, living with, owning, or personally trying anything ("we tested", "in our home", "our dog"). Never invent statistics, studies, prices or quotes. Use only the facts provided plus widely known, uncontroversial breed or product knowledge.';

function factsLine(b) {
  if (!b) return 'no dataset entry';
  return [
    `size ${b.size}`, `energy ${b.energy}`, `shedding ${b.shedding}`, `grooming ${b.grooming}`,
    `trainability ${b.trainability}`, `barking ${b.barking}`, `lifespan ${b.lifespan_min}-${b.lifespan_max} yrs`,
    `good with kids ${b.good_with_kids ? 'yes' : 'no'}`, `good with cats ${b.good_with_cats ? 'yes' : 'no'}`,
    `good with other dogs ${b.good_with_other_dogs ? 'yes' : 'no'}`, `temperament ${(b.temperament || []).join('/')}`,
    `coat ${(b.coat || []).join('/')}`, b.group ? `group ${b.group}` : '',
  ].filter(Boolean).join('; ');
}

const PICK_PROPS = {
  rank: { type: 'integer' },
  description: { type: 'string', description: '110-160 words. Specific to THIS pick for THIS guide\'s situation: concrete details (size, exercise needs in minutes/day where reasonable, grooming routine, noise, space). Plain, confident prose; no filler.' },
  best_for: { type: 'string', description: '6-14 words: the specific person/home this suits' },
  skip_if: { type: 'string', description: '8-20 words: who should NOT choose this, and why (the real trade-off)' },
  quirky_fact: { type: 'string', description: 'one genuinely useful, specific tip or fact (1 sentence)' },
};

function schema(isDogs) {
  const pickProps = { ...PICK_PROPS };
  const req = ['rank', 'description', 'best_for', 'skip_if', 'quirky_fact'];
  if (!isDogs) {
    pickProps.product_name = { type: 'string', description: 'a specific, widely sold product (brand + model or a precise generic product name) a reader can buy for this item' };
    req.push('product_name');
  }
  return {
    name: 'upgrade', strict: true,
    schema: {
      type: 'object', additionalProperties: false,
      required: ['seo_title', 'answer', 'intro', 'method', 'picks', 'faqs'],
      properties: {
        seo_title: { type: 'string', description: `≤ 60 characters, keyword first, include ${YEAR}; no "Top N Best"` },
        answer: { type: 'string', description: '2-3 sentences that directly answer the search. Name the top 3 picks (ranks 1-3) and the single deciding factor. No hype.' },
        intro: { type: 'string', description: '60-100 words: what actually matters when choosing for this situation, stated concretely. No restating the title.' },
        method: { type: 'string', description: isDogs
          ? '1-2 sentences describing how this list was made: candidates were filtered from a 150-breed dataset on the attributes that matter for this situation (name them), then ordered by fit. Must be literally true; no testing claims.'
          : '1-2 sentences describing how the picks were chosen (what was weighed). Must be literally true; no testing claims.' },
        picks: { type: 'array', items: { type: 'object', additionalProperties: false, required: req, properties: pickProps } },
        faqs: { type: 'array', description: '4-5 questions people actually search, each answered in 40-80 words', items: { type: 'object', additionalProperties: false, required: ['question', 'answer'], properties: { question: { type: 'string' }, answer: { type: 'string' } } } },
      },
    },
  };
}

function queue() {
  const all = fs.readdirSync(ARTICLES).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(ARTICLES, f), 'utf-8')));
  const eligible = all.filter((a) => !a.upgraded_at && !REDIRECTED[a.topic_slug] && !NOINDEX.has(a.niche || 'dogs') && a.picks.length >= 3);
  const order = (a) => ((a.niche || 'dogs') === 'dogs' ? 0 : a.niche === 'home decor' ? 1 : 2);
  return eligible.sort((x, y) => order(x) - order(y) || y.picks.length - x.picks.length);
}

async function upgrade(article) {
  const isDogs = (article.niche || 'dogs') === 'dogs';
  const picks = [...article.picks].sort((a, b) => a.rank - b.rank);
  const list = picks.map((p) => isDogs
    ? `#${p.rank} ${p.breed} — ${factsLine(BY_NAME.get(p.breed.toLowerCase()))}`
    : `#${p.rank} ${p.breed}${p.shop_query ? ` (shopping query: ${p.shop_query})` : ''}`).join('\n');

  const system = `You are the editor of Value Finds Daily, rewriting a ranked guide so it is genuinely useful and specific. Answer first, then detail. US English, plain and warm, short sentences. ${HONESTY} ${BANNED}`;
  const user = `Guide title: "${article.topic_title}"
Situation the reader is in: ${article.topic_title.replace(/^top\s+\d+\s+/i, '')}
The ranking is FIXED — keep every rank and item exactly as given:
${list}

Rewrite the guide. Return one entry in "picks" per item above, same rank numbers, in rank order.${isDogs ? ' Ground every breed claim in its facts line; if the facts say "good with kids no", say so plainly in skip_if.' : ''}`;

  const out = await lib.chatJSON({ system, user, schema: schema(isDogs), temperature: 0.5 });
  const byRank = new Map(out.picks.map((p) => [p.rank, p]));
  if (byRank.size !== picks.length || picks.some((p) => !byRank.has(p.rank))) {
    throw new Error(`model returned ranks ${[...byRank.keys()].join(',')} for ${picks.length} picks`);
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...article,
    seo_title: out.seo_title.slice(0, 70),
    answer: out.answer,
    intro: out.intro,
    method: out.method,
    faqs: out.faqs,
    author: AUTHOR,
    updated_at: today,
    upgraded_at: today,
    picks: article.picks.map((p) => {
      const n = byRank.get(p.rank);
      return {
        ...p,                       // keeps rank, breed (image key), image_query, shop_query
        description: n.description,
        best_for: n.best_for,
        skip_if: n.skip_if,
        quirky_fact: n.quirky_fact,
        ...(n.product_name ? { product_name: n.product_name } : {}),
      };
    }),
  };
}

(async () => {
  const start = process.env.UPGRADE_START;
  if (start && new Date().toISOString().slice(0, 10) < start) {
    console.log(`UPGRADE_START=${start}: scheduled upgrades begin then (batch 1 is being measured). Skipping.`);
    return;
  }
  const slugs = arg('slugs');
  const targets = slugs
    ? slugs.split(',').map((s) => JSON.parse(fs.readFileSync(path.join(ARTICLES, `${s}.json`), 'utf-8')))
    : queue().slice(0, parseInt(arg('count') || '2', 10));
  if (!targets.length) { console.log('Nothing left to upgrade.'); return; }

  let ok = 0;
  for (const a of targets) {
    try {
      const up = await upgrade(a);
      if (DRY) { console.log(JSON.stringify({ slug: a.topic_slug, seo_title: up.seo_title, answer: up.answer, method: up.method, pick1: up.picks.find((p) => p.rank === 1) }, null, 2)); }
      else { fs.writeFileSync(path.join(ARTICLES, `${a.topic_slug}.json`), JSON.stringify(up, null, 2)); }
      ok++;
      console.log(`✓ ${a.topic_slug}: "${up.seo_title}"`);
    } catch (e) {
      console.error(`✗ ${a.topic_slug}: ${e.message.slice(0, 200)}`);
    }
  }
  console.log(`\nUpgraded ${ok}/${targets.length}.${DRY ? ' (dry run — nothing written)' : ''}`);
  if (ok < targets.length) process.exitCode = 1;
})();
