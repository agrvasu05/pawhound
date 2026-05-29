/**
 * 2b-generate-trending-articles.js — article generator for non-dog niches.
 *
 * Reads content/generated-topics-trending.json and writes full listicle articles
 * into content/articles/ (same dir + shape as the dog articles, so the existing
 * site, pin generator, and Pinterest poster handle them with no changes).
 *
 * Unlike the dog generator, there is no breed dataset — GPT produces the ranked
 * items directly. Each item also gets an `image_query` so 3-fetch-images.js can
 * pull a relevant, catchy Pexels photo.
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TRENDING_TOPICS_PATH = path.join(process.cwd(), 'content', 'generated-topics-trending.json');
const OUT_DIR = path.join(process.cwd(), 'content', 'articles');

if (!fs.existsSync(TRENDING_TOPICS_PATH)) {
  console.log('No trending topics yet. Run 1c-generate-trending-topics.js first.');
  process.exit(0);
}
const topics = JSON.parse(fs.readFileSync(TRENDING_TOPICS_PATH, 'utf-8'));

const SYSTEM_PROMPT = `You write Pinterest-style visual listicles for US audiences.
Voice: warm, knowledgeable, conversational American English — like a friend with great taste.
Rules:
- Every item must be CONCRETE and specific (a real, describable thing a reader can picture or do), never vague advice
- Each description must feel distinct, not templated
- No medical or financial guarantees; no celebrity references
- US spelling and idioms
- Avoid filler clichés ("game-changer", "elevate your space", "must-have")`;

// Schema mirrors the dog article schema so the site renders it identically, but
// adds image_query per item (for Pexels) — "breed" here = the list item name.
const ARTICLE_SCHEMA = {
  name: 'trending_listicle',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      intro: { type: 'string', description: '80-120 word intro paragraph' },
      picks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            rank: { type: 'integer' },
            breed: { type: 'string', description: 'the name of this list item (e.g. "Floating Corner Shelves")' },
            image_query: { type: 'string', description: '2-4 word literal Pexels photo search for this item, e.g. "floating wall shelves"' },
            description: { type: 'string', description: '150-200 words' },
            best_for: { type: 'string', description: 'short tagline: who/what this is best for' },
            quirky_fact: { type: 'string', description: 'one surprising or useful tip about this item' },
          },
          required: ['rank', 'breed', 'image_query', 'description', 'best_for', 'quirky_fact'],
          additionalProperties: false,
        },
      },
      pin_headlines: {
        type: 'array',
        items: { type: 'string' },
        description: '10 Pinterest pin headlines, 6-12 words each',
      },
      faqs: {
        type: 'array',
        description: '4 genuinely useful FAQs a reader of this list would ask',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'a natural question a reader would search for' },
            answer: { type: 'string', description: '40-80 word helpful, specific answer in plain US English' },
          },
          required: ['question', 'answer'],
          additionalProperties: false,
        },
      },
    },
    required: ['intro', 'picks', 'pin_headlines', 'faqs'],
    additionalProperties: false,
  },
};

async function generateArticle(topic) {
  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Topic: "${topic.title}"\nWhat the list should contain: ${topic.desc}\n\nProduce a ranked list of 8-12 concrete, specific items that genuinely fit this topic. Rank them from worst-to-best fit (rank 1 = the absolute best/standout). For each item give a vivid description and a literal image_query a stock-photo site would match.`,
      },
    ],
    response_format: { type: 'json_schema', json_schema: ARTICLE_SCHEMA },
    temperature: 0.75,
  });

  const article = JSON.parse(response.choices[0].message.content);
  article.topic_slug = topic.slug;
  article.niche = topic.niche || 'home';
  article.item_noun = topic.item_noun || 'ideas';
  // Strip any leading count GPT baked into the title so we don't double up
  const cleanTitle = topic.title.replace(/^\s*\d+\+?\s+/, '');
  article.topic_title = `Top ${article.picks.length} ${cleanTitle}`;
  article.updated_at = new Date().toISOString().slice(0, 10);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${topic.slug}.json`), JSON.stringify(article, null, 2));

  const { prompt_tokens, completion_tokens } = response.usage;
  const cost = ((prompt_tokens * 0.4 + completion_tokens * 1.6) / 1_000_000).toFixed(4);
  console.log(`✓ ${topic.slug} | ${article.picks.length} items | cost: $${cost}`);
}

const countArg = process.argv.find((a) => a.startsWith('--count='));
const count = countArg ? parseInt(countArg.split('=')[1]) : topics.length;

const pending = topics
  .filter((t) => !fs.existsSync(path.join(OUT_DIR, `${t.slug}.json`)))
  .slice(0, count);

if (pending.length === 0) {
  console.log('All trending topics already generated. Run 1c to create new ones.');
  process.exit(0);
}

console.log(`Generating ${pending.length} trending article(s) with gpt-4.1-mini...`);

(async () => {
  for (const topic of pending) {
    try {
      await generateArticle(topic);
    } catch (e) {
      console.error(`Failed: ${topic.slug}`, e.message);
    }
  }
  console.log('Done.');
})();
