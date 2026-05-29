/**
 * 1b-generate-topics.js — AI-powered Pinterest topic generator
 *
 * Every run:
 *  1. Reads all existing topics (static + previously generated) so it never repeats
 *  2. Asks GPT to invent 10 new trending dog breed listicle topics
 *  3. Validates each topic produces ≥ 5 matching breeds
 *  4. Appends valid topics to content/generated-topics.json
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { TOPICS } = require('./topics');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const GENERATED_TOPICS_PATH = path.join(process.cwd(), 'content', 'generated-topics.json');
const BREEDS_PATH = path.join(process.cwd(), 'content', 'breeds.json');
const NEW_TOPICS_PER_RUN = 10;
const MIN_BREED_POOL = 5; // reject a topic if fewer than this many breeds match

// ── Load existing data ────────────────────────────────────────────────────────
const allBreeds = JSON.parse(fs.readFileSync(BREEDS_PATH, 'utf-8'));

const existingGenerated = fs.existsSync(GENERATED_TOPICS_PATH)
  ? JSON.parse(fs.readFileSync(GENERATED_TOPICS_PATH, 'utf-8'))
  : [];

// Also read titles from already-generated article files so we never repeat topics
// even if the slug drifted from the original topic slug
const articlesDir = path.join(process.cwd(), 'content', 'articles');
const articleTitles = fs.existsSync(articlesDir)
  ? fs.readdirSync(articlesDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try { return JSON.parse(fs.readFileSync(path.join(articlesDir, f), 'utf-8')).topic_title; }
        catch { return null; }
      })
      .filter(Boolean)
  : [];

const existingSlugs = new Set([
  ...TOPICS.map((t) => t.slug),
  ...existingGenerated.map((t) => t.slug),
]);

// Combine all known titles (topics + generated + actual articles) for dedup prompt
const existingTitles = [
  ...new Set([
    ...TOPICS.map((t) => t.title),
    ...existingGenerated.map((t) => t.title),
    ...articleTitles,
  ]),
];

// ── Filter spec → function ────────────────────────────────────────────────────
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

// ── Generate topics via OpenAI ────────────────────────────────────────────────
async function generateTopics() {
  const existingList = existingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const prompt = `You are a Pinterest content strategist for a dog breed website (valuefindsdaily.com).

BREED DATA SCHEMA — each breed has these properties you can filter by:
- size: "toy" | "small" | "medium" | "large" | "giant"
- energy: "low" | "medium" | "high"
- barking: "low" | "medium" | "high"
- shedding: "low" | "medium" | "high"
- grooming: "low" | "medium" | "high"
- trainability: "easy" | "medium" | "hard"
- cold_tolerance: "low" | "medium" | "high"
- hot_tolerance: "low" | "medium" | "high"
- temperament: array containing any of: active, affectionate, alert, aloof, bold, calm, confident, courageous, curious, dignified, energetic, friendly, gentle, independent, intelligent, loyal, merry, playful, protective, quiet, stubborn
- coat: array containing any of: broken, corded, curly, dense, double, feathered, hairless, long, medium, medium-length, powderpuff, rough, short, silky, smooth, soft, straight, thick, water-resistant, wavy, wire
- good_with_kids: true | false
- good_with_cats: true | false
- good_with_other_dogs: true | false
- rare: true | false
- lifespan_min: number (years)

TOPICS ALREADY PUBLISHED (do NOT repeat these):
${existingList}

Generate ${NEW_TOPICS_PER_RUN} brand-new dog breed listicle topics that would go viral on Pinterest.

Rules:
- Each topic must be UNIQUE and not overlap with existing ones
- Use trending Pinterest angles: specific lifestyles, surprising contrasts, emotional hooks, niche audiences
- Good angles: "best dogs for introverts", "dog breeds that look intimidating but are gentle giants", "best dogs for people with anxiety", "dog breeds that stay small forever", "most photogenic dog breeds", "dog breeds that love swimming", "best dogs for night-shift workers", "dog breeds with the calmest energy", "best dogs for minimalist homes"
- Each filter spec must return AT LEAST 5 breeds from the dataset
- Use broad enough filters — if unsure, use fewer constraints

Return a JSON object with this exact structure:
{
  "topics": [
    {
      "slug": "url-friendly-slug-here",
      "title": "Article Title Here (5-10 words, Pinterest-style curiosity gap)",
      "desc": "2-sentence description of what kind of breeds fit this topic",
      "filter": {
        "size": [],
        "not_size": [],
        "energy": [],
        "not_energy": [],
        "barking": [],
        "not_barking": [],
        "shedding": [],
        "grooming": [],
        "trainability": [],
        "cold_tolerance": [],
        "hot_tolerance": [],
        "temperament_includes": [],
        "coat_includes": [],
        "good_with_kids": null,
        "good_with_cats": null,
        "good_with_other_dogs": null,
        "rare": null,
        "lifespan_min_gte": null
      }
    }
  ]
}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.9, // high creativity for diverse topics
  });

  const result = JSON.parse(response.choices[0].message.content);
  const { prompt_tokens, completion_tokens } = response.usage;
  const cost = ((prompt_tokens * 0.4 + completion_tokens * 1.6) / 1_000_000).toFixed(4);
  console.log(`GPT response: ${result.topics?.length || 0} topics generated | cost: $${cost}`);
  return result.topics || [];
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Existing topics: ${existingSlugs.size} (will not repeat any)`);
  console.log('Generating new Pinterest-trending topics...\n');

  let rawTopics;
  try {
    rawTopics = await generateTopics();
  } catch (err) {
    console.error('OpenAI error:', err.message);
    process.exit(1);
  }

  const valid = [];

  for (const topic of rawTopics) {
    // Skip duplicates
    if (existingSlugs.has(topic.slug)) {
      console.log(`  ⏭  Skipping duplicate: ${topic.slug}`);
      continue;
    }

    // Validate breed pool size
    try {
      const filterFn = filterFromSpec(topic.filter || {});
      const pool = allBreeds.filter(filterFn);
      if (pool.length < MIN_BREED_POOL) {
        console.log(`  ✗ "${topic.title}" — only ${pool.length} breeds match (need ≥ ${MIN_BREED_POOL}), skipping`);
        continue;
      }
      console.log(`  ✓ "${topic.title}" — ${pool.length} breeds in pool`);
      valid.push(topic);
      existingSlugs.add(topic.slug); // prevent intra-batch duplicates
    } catch (err) {
      console.log(`  ✗ "${topic.title}" — filter error: ${err.message}`);
    }
  }

  if (valid.length === 0) {
    console.log('\nNo valid new topics generated this run.');
    process.exit(0);
  }

  // Append to generated-topics.json
  const updated = [...existingGenerated, ...valid];
  fs.writeFileSync(GENERATED_TOPICS_PATH, JSON.stringify(updated, null, 2));

  console.log(`\n✅ Added ${valid.length} new topics → content/generated-topics.json`);
  console.log(`   Total generated topics: ${updated.length}`);
})();
