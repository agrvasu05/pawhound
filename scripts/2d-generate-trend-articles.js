/**
 * 2d-generate-trend-articles.js — publishes SEO listicle articles for the top
 * trending Pinterest keywords (fashion/beauty niches), in the same shape as the
 * existing articles so they render on /[slug] + the homepage and get Pexels
 * images via 3-fetch-images.js. Each item carries a `shop_query` so the affiliate
 * module can later drop in Awin product links (affiliate-ready, dormant for now).
 *
 * Seeds from content/trend-briefs.json; marks used keywords in content/used-briefs.json.
 * Usage: node scripts/2d-generate-trend-articles.js [--count=2]
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');
const BRIEFS = path.join(process.cwd(), 'content', 'trend-briefs.json');
const USED = path.join(process.cwd(), 'content', 'used-briefs.json');
const ARTICLE_NICHES = ['fashion', 'beauty', 'home decor']; // affiliate-heavy; products handle gifts/wellness/aesthetic

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
function loadBriefs() { try { return JSON.parse(fs.readFileSync(BRIEFS, 'utf-8')).briefs || []; } catch { return []; } }
function loadUsed() { try { return new Set(JSON.parse(fs.readFileSync(USED, 'utf-8'))); } catch { return new Set(); } }
function markUsed(kw) { const s = loadUsed(); s.add(kw); fs.mkdirSync(path.dirname(USED), { recursive: true }); fs.writeFileSync(USED, JSON.stringify([...s], null, 2)); }

const SCHEMA = {
  name: 'trend_article', strict: true,
  schema: { type: 'object', additionalProperties: false,
    required: ['intro', 'item_noun', 'picks', 'pin_headlines', 'faqs'],
    properties: {
      intro: { type: 'string', description: '90-130 word intro that uses the keyword naturally in the first sentence' },
      item_noun: { type: 'string', description: 'plural noun for the list items, e.g. "outfit ideas", "nail designs", "looks"' },
      picks: { type: 'array', description: '9-12 concrete, specific items',
        items: { type: 'object', additionalProperties: false,
          required: ['rank', 'breed', 'image_query', 'description', 'best_for', 'quirky_fact', 'shop_query'],
          properties: {
            rank: { type: 'integer' },
            breed: { type: 'string', description: 'the item NAME (e.g. "White Linen Midi Dress")' },
            image_query: { type: 'string', description: '2-4 word literal stock-photo search for this item' },
            description: { type: 'string', description: '110-170 words, specific and useful' },
            best_for: { type: 'string', description: 'who/what this is best for' },
            quirky_fact: { type: 'string', description: 'one styling tip or useful detail' },
            shop_query: { type: 'string', description: 'a precise shopping search phrase to find this product to buy (for affiliate matching)' },
          } } },
      pin_headlines: { type: 'array', items: { type: 'string' }, description: '10 Pinterest pin headlines, 6-12 words' },
      faqs: { type: 'array', description: '4 useful FAQs',
        items: { type: 'object', additionalProperties: false, required: ['question', 'answer'],
          properties: { question: { type: 'string' }, answer: { type: 'string', description: '40-80 word answer' } } } },
    } } };

async function generate(brief) {
  const r = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: 'You write genuinely useful, SEO-friendly listicle articles for a US Pinterest+blog audience (fashion, beauty, lifestyle). Each item is concrete and shoppable. Warm, specific, US English. No medical/financial guarantees, no celebrity endorsements.' },
      { role: 'user', content: `Write the article "${brief.article_topic}" targeting the trending Pinterest search "${brief.keyword}". Use the keyword in the first sentence. Give 9-12 specific, shoppable items with a precise shop_query for each.` },
    ],
    response_format: { type: 'json_schema', json_schema: SCHEMA },
    temperature: 0.75,
  });
  const a = JSON.parse(r.choices[0].message.content);
  a.topic_slug = slugify(brief.keyword) || slugify(brief.article_topic);
  a.topic_title = brief.article_topic;
  a.niche = brief.niche;
  a.keyword = brief.keyword;
  a.author = 'the Value Finds Daily Editorial Team';
  a.updated_at = new Date().toISOString().slice(0, 10);
  const { prompt_tokens, completion_tokens } = r.usage;
  const cost = ((prompt_tokens * 0.4 + completion_tokens * 1.6) / 1e6).toFixed(4);
  return { article: a, cost };
}

(async () => {
  const countArg = process.argv.find((x) => x.startsWith('--count='));
  const count = countArg ? parseInt(countArg.split('=')[1]) : 2;
  const used = loadUsed();
  const pool = loadBriefs()
    .filter((b) => ARTICLE_NICHES.includes(b.niche) && !used.has(b.keyword))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  if (!pool.length) { console.log('No unused fashion/beauty trend briefs available.'); return; }

  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  let made = 0, total = 0;
  for (const brief of pool.slice(0, count)) {
    try {
      const { article, cost } = await generate(brief);
      const file = path.join(ARTICLES_DIR, `${article.topic_slug}.json`);
      if (fs.existsSync(file)) { console.log(`– ${article.topic_slug} (exists)`); markUsed(brief.keyword); continue; }
      fs.writeFileSync(file, JSON.stringify(article, null, 2));
      markUsed(brief.keyword);
      made++; total += parseFloat(cost);
      console.log(`✓ [${article.niche}] "${article.topic_title}" (${article.picks.length} ${article.item_noun}) — $${cost}`);
    } catch (e) {
      console.error(`✗ ${brief.keyword}:`, e.message);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.log(`\nDone. ${made} trend articles. Cost: $${total.toFixed(4)}`);
})();
