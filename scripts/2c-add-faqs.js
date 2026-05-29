/**
 * 2c-add-faqs.js — one-time backfill that adds a unique FAQ section to every
 * existing article that doesn't already have one. FAQs are original, useful Q&A
 * that strengthen content quality (and add FAQPage structured data on the site).
 *
 * Idempotent: skips articles that already have `faqs`. Safe to re-run.
 * Usage: node scripts/2c-add-faqs.js [--limit=N] [--force]
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');

const FAQ_SCHEMA = {
  name: 'article_faqs',
  strict: true,
  schema: {
    type: 'object',
    properties: {
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
    required: ['faqs'],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You write concise, genuinely helpful FAQ sections for buyer's-guide style listicles.
Voice: warm, knowledgeable, conversational US English.
Rules:
- Questions must be ones a real reader of THIS specific list would ask (practical, on-topic), not generic filler
- Answers must be specific and useful — no medical or financial guarantees, no fluff, no "it depends" cop-outs
- Do not repeat the article's title verbatim as a question
- US spelling and idioms`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function addFaqs(file) {
  const filePath = path.join(ARTICLES_DIR, file);
  const article = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const force = process.argv.includes('--force');
  if (article.faqs && article.faqs.length && !force) {
    return { skipped: true };
  }

  const items = article.picks
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((p) => p.breed)
    .join(', ');

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Article title: "${article.topic_title}"\nIt ranks these ${article.item_noun || 'items'}: ${items}\n\nWrite 4 FAQs a reader of this article would genuinely have, with helpful answers.`,
      },
    ],
    response_format: { type: 'json_schema', json_schema: FAQ_SCHEMA },
    temperature: 0.7,
  });

  const { faqs } = JSON.parse(response.choices[0].message.content);
  article.faqs = faqs;
  article.updated_at = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(filePath, JSON.stringify(article, null, 2));

  const { prompt_tokens, completion_tokens } = response.usage;
  const cost = ((prompt_tokens * 0.4 + completion_tokens * 1.6) / 1_000_000).toFixed(4);
  return { skipped: false, cost, count: faqs.length };
}

(async () => {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;

  const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.json'));
  let done = 0;
  let totalCost = 0;

  for (const file of files) {
    if (done >= limit) break;
    try {
      const res = await addFaqs(file);
      if (res.skipped) {
        console.log(`– ${file} (already has FAQs)`);
        continue;
      }
      done++;
      totalCost += parseFloat(res.cost);
      console.log(`✓ ${file} | ${res.count} FAQs | $${res.cost}`);
      await sleep(500);
    } catch (e) {
      console.error(`Failed: ${file}`, e.message);
    }
  }
  console.log(`\nDone. Added FAQs to ${done} article(s). Total cost: $${totalCost.toFixed(4)}`);
})();
