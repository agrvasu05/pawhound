require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { TOPICS } = require('./topics');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const breedsFile = path.join(process.cwd(), 'content', 'breeds.json');
if (!fs.existsSync(breedsFile)) {
  console.error('Error: content/breeds.json not found. Run `npm run breed` first.');
  process.exit(1);
}
const allBreeds = JSON.parse(fs.readFileSync(breedsFile, 'utf-8'));

// ── Load AI-generated topics and merge with static ones ───────────────────────
function filterFromSpec(spec) {
  return (b) => {
    if (spec.size?.length && !spec.size.includes(b.size)) return false;
    if (spec.not_size?.length && spec.not_size.includes(b.size)) return false;
    if (spec.energy?.length && !spec.energy.includes(b.energy)) return false;
    if (spec.not_energy?.length && spec.not_energy.includes(b.energy)) return false;
    if (spec.barking?.length && !spec.barking.includes(b.barking)) return false;
    if (spec.not_barking?.length && spec.not_barking.includes(b.barking)) return false;
    if (spec.shedding?.length && !spec.shedding.includes(b.shedding)) return false;
    if (spec.grooming?.length && !spec.grooming.includes(b.grooming)) return false;
    if (spec.trainability?.length && !spec.trainability.includes(b.trainability)) return false;
    if (spec.cold_tolerance?.length && !spec.cold_tolerance.includes(b.cold_tolerance)) return false;
    if (spec.hot_tolerance?.length && !spec.hot_tolerance.includes(b.hot_tolerance)) return false;
    if (spec.temperament_includes?.length) {
      if (!spec.temperament_includes.some((t) => (b.temperament || []).includes(t))) return false;
    }
    if (spec.coat_includes?.length) {
      if (!spec.coat_includes.some((c) => (b.coat || []).includes(c))) return false;
    }
    if (spec.good_with_kids != null && b.good_with_kids !== spec.good_with_kids) return false;
    if (spec.good_with_cats != null && b.good_with_cats !== spec.good_with_cats) return false;
    if (spec.good_with_other_dogs != null && b.good_with_other_dogs !== spec.good_with_other_dogs) return false;
    if (spec.rare != null && b.rare !== spec.rare) return false;
    if (spec.lifespan_min_gte != null && b.lifespan_min < spec.lifespan_min_gte) return false;
    return true;
  };
}

const generatedTopicsPath = path.join(process.cwd(), 'content', 'generated-topics.json');
const generatedTopics = fs.existsSync(generatedTopicsPath)
  ? JSON.parse(fs.readFileSync(generatedTopicsPath, 'utf-8')).map((t) => ({
      ...t,
      filter: filterFromSpec(t.filter || {}),
    }))
  : [];

// Merge: static topics first, then AI-generated ones (deduped by slug)
const staticSlugs = new Set(TOPICS.map((t) => t.slug));
const ALL_TOPICS = [
  ...TOPICS,
  ...generatedTopics.filter((t) => !staticSlugs.has(t.slug)),
];

const SYSTEM_PROMPT = `You write Pinterest-style dog breed listicles for US audiences.
Voice: warm, knowledgeable, conversational American English. Like a friend who knows a lot about dogs.
Rules:
- Use ONLY breeds from the provided list — use their exact names
- No medical claims — use "low-shedding" not "hypoallergenic"
- No "the perfect breed for X" → use "a great fit for X"
- No celebrity references
- Each description must feel distinct, not templated
- US spelling and idioms
- Avoid: "furry friend", "fur baby", "pawsome", "tail-wagging"`;

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
    required: ['topic_slug', 'topic_title', 'intro', 'picks', 'pin_headlines', 'faqs'],
    additionalProperties: false,
  },
};

async function generateArticle(topic) {
  const pool = allBreeds.filter(topic.filter);

  if (pool.length === 0) {
    console.log(`  (filter returned 0 breeds, skipping)`);
    return;
  }

  const breedNames = pool.map((b) => b.name).join(', ');

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Topic: "${topic.title}"\nCriteria: ${topic.desc}\n\nFrom this list, pick only the breeds that GENUINELY and strongly fit this topic — between 5 and 15 breeds max. Do NOT pad with weak picks. Rank them from worst to best fit (rank 1 = absolute best):\n${breedNames}`,
      },
    ],
    response_format: { type: 'json_schema', json_schema: ARTICLE_SCHEMA },
    temperature: 0.7,
  });

  const article = JSON.parse(response.choices[0].message.content);
  article.topic_slug = topic.slug;
  // Strip any leading count the AI baked into the title (e.g. "5+ Dog Breeds...",
  // "10 Most Photogenic...") so we don't get "Top 6 5+ Dog Breeds..."
  const cleanTitle = topic.title.replace(/^\s*\d+\+?\s+/, '');
  article.topic_title = `Top ${article.picks.length} ${cleanTitle}`;
  article.updated_at = new Date().toISOString().slice(0, 10);

  const outDir = path.join(process.cwd(), 'content', 'articles');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${topic.slug}.json`),
    JSON.stringify(article, null, 2)
  );

  const { prompt_tokens, completion_tokens } = response.usage;
  const cost = ((prompt_tokens * 0.4 + completion_tokens * 1.6) / 1_000_000).toFixed(4);
  console.log(`✓ ${topic.slug} | pool: ${pool.length} breeds | cost: $${cost}`);
}

const countArg = process.argv.find((a) => a.startsWith('--count='));
const count = countArg ? parseInt(countArg.split('=')[1]) : ALL_TOPICS.length;

const pending = ALL_TOPICS.filter((t) => {
  const file = path.join(process.cwd(), 'content', 'articles', `${t.slug}.json`);
  return !fs.existsSync(file);
}).slice(0, count);

if (pending.length === 0) {
  console.log('All topics already generated. Run 1b-generate-topics.js to create new ones.');
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
