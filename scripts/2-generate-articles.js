require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { TOPICS } = require('./topics');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const breedsFile = path.join(process.cwd(), 'content', 'breeds.json');
if (!fs.existsSync(breedsFile)) {
  console.error('Error: content/breeds.json not found. Run `npm run scrape` first.');
  process.exit(1);
}
const breeds = JSON.parse(fs.readFileSync(breedsFile, 'utf-8'));

const SYSTEM_PROMPT = `You write Pinterest-style dog breed listicles for US audiences.
Voice: warm, knowledgeable, conversational American English. Like a friend who happens to know a lot about dogs.
Rules:
- No medical claims (avoid "best for allergies" → use "low-shedding")
- No "the perfect breed for X" → use "a great fit for X"
- No celebrity references, no copyrighted character names
- Each breed description must feel distinct (no template phrases)
- US spelling and idioms only
- Avoid overused tropes: "furry friend", "fur baby", "pawsome", "tail-wagging"

Available breed database (use EXACT names from this list):
${JSON.stringify(breeds.map((b) => ({ name: b.name, slug: b.slug, extract: b.extract.slice(0, 300) })))}`;

const ARTICLE_SCHEMA = {
  name: 'dog_listicle',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      topic_slug: { type: 'string' },
      topic_title: { type: 'string' },
      intro: { type: 'string', description: '80-120 word intro paragraph' },
      picks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            rank: { type: 'integer' },
            breed: { type: 'string' },
            description: { type: 'string', description: '180-220 words' },
            best_for: { type: 'string' },
            quirky_fact: { type: 'string' },
          },
          required: ['rank', 'breed', 'description', 'best_for', 'quirky_fact'],
          additionalProperties: false,
        },
      },
      pin_headlines: {
        type: 'array',
        items: { type: 'string' },
        description: '10 Pinterest pin headlines, 6-12 words each',
      },
    },
    required: ['topic_slug', 'topic_title', 'intro', 'picks', 'pin_headlines'],
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
        content: `Topic: "${topic.title}"\nSelection criteria: ${topic.filter}\nPick 15 breeds from the database, rank them 15 down to 1, with rank 1 being the absolute best fit.`,
      },
    ],
    response_format: { type: 'json_schema', json_schema: ARTICLE_SCHEMA },
    temperature: 0.7,
  });

  const article = JSON.parse(response.choices[0].message.content);
  article.topic_slug = topic.slug;
  article.topic_title = topic.title;

  const outDir = path.join(process.cwd(), 'content', 'articles');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${topic.slug}.json`),
    JSON.stringify(article, null, 2)
  );

  const { prompt_tokens, completion_tokens } = response.usage;
  const cost = ((prompt_tokens * 0.4 + completion_tokens * 1.6) / 1_000_000).toFixed(4);
  console.log(`✓ ${topic.slug} | tokens: ${prompt_tokens + completion_tokens} | cost: $${cost}`);
}

// Support --count=N flag to generate only N articles
const countArg = process.argv.find((a) => a.startsWith('--count='));
const count = countArg ? parseInt(countArg.split('=')[1]) : TOPICS.length;

// Only generate topics that don't have a file yet
const pending = TOPICS.filter((t) => {
  const file = path.join(process.cwd(), 'content', 'articles', `${t.slug}.json`);
  return !fs.existsSync(file);
}).slice(0, count);

if (pending.length === 0) {
  console.log('All topics already generated. Delete article files to regenerate.');
  process.exit(0);
}

console.log(`Generating ${pending.length} article(s) with gpt-4.1-mini...`);

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
