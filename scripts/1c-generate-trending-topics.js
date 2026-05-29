/**
 * 1c-generate-trending-topics.js — AI topic generator for non-dog trending niches.
 *
 * Mirrors 1b but is DATASET-FREE: there is no breeds.json-style structured data
 * for niches like home decor, so GPT invents the topics directly. Each run:
 *  1. Reads every existing topic + article title (dog AND trending) so it never repeats
 *  2. Asks GPT for N new high-click Pinterest listicle topics in the target niche
 *  3. Runs the shared semantic dedup so themes don't overlap
 *  4. Appends survivors to content/generated-topics-trending.json
 *
 * Topics produced here are consumed by 2b-generate-trending-articles.js, NOT by
 * the dog article generator — the two pipelines stay fully isolated.
 */

require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { TOPICS } = require('./topics');
const { keywordSet, buildKeywordSets, isSemanticDuplicate } = require('./dedup');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const NEW_TOPICS_PER_RUN = 10;
const TRENDING_TOPICS_PATH = path.join(process.cwd(), 'content', 'generated-topics-trending.json');
const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');
const DOG_GENERATED_PATH = path.join(process.cwd(), 'content', 'generated-topics.json');

// ── Niche definitions ─────────────────────────────────────────────────────────
// Each niche carries the Pinterest persona + angle library used to prompt GPT.
// item_noun is the plural noun the site uses when rendering ("Top 10 cozy IDEAS").
const NICHES = {
  home: {
    label: 'Home & Cozy Living',
    item_noun: 'ideas',
    persona:
      'a Pinterest home & cozy-living strategist. You cover small-space decor, ' +
      'organization, cozy aesthetics, budget makeovers, and pet-friendly home ideas.',
    angles: [
      'small apartment storage hacks',
      'cozy reading nook ideas',
      'budget-friendly living room makeovers',
      'aesthetic bedroom ideas for small rooms',
      'genius kitchen organization tricks',
      'pet-friendly home decor ideas',
      'entryway ideas that make a great first impression',
      'calming bedroom color palettes',
      'rental-friendly decor that needs no drilling',
      'cozy fall living room decor',
    ],
  },
};

const niche = NICHES[(process.argv.find((a) => a.startsWith('--niche='))?.split('=')[1]) || 'home'];
if (!niche) {
  console.error('Unknown niche. Available:', Object.keys(NICHES).join(', '));
  process.exit(1);
}

// ── Load everything already published (for dedup) ─────────────────────────────
const existingTrending = fs.existsSync(TRENDING_TOPICS_PATH)
  ? JSON.parse(fs.readFileSync(TRENDING_TOPICS_PATH, 'utf-8'))
  : [];

const dogGenerated = fs.existsSync(DOG_GENERATED_PATH)
  ? JSON.parse(fs.readFileSync(DOG_GENERATED_PATH, 'utf-8'))
  : [];

// Only collect titles from NON-dog articles. Cross-niche overlap on a shared
// context word (e.g. "apartment", "calm") must not block home topics.
const trendingArticleTitles = fs.existsSync(ARTICLES_DIR)
  ? fs.readdirSync(ARTICLES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try { return JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf-8')); }
        catch { return null; }
      })
      .filter((a) => a && a.niche && a.niche !== 'dogs')
      .map((a) => a.topic_title)
  : [];

const existingSlugs = new Set([
  ...TOPICS.map((t) => t.slug),
  ...dogGenerated.map((t) => t.slug),
  ...existingTrending.map((t) => t.slug),
]);

// Dedup against THIS niche's own history (so home doesn't repeat home). We don't
// dedup home against dog titles — different niches rarely collide and shouldn't.
const existingTitles = [
  ...new Set([
    ...existingTrending.map((t) => t.title),
    ...trendingArticleTitles,
  ]),
];
const existingKeywordSets = buildKeywordSets(existingTitles);

// ── Generate topics via OpenAI ────────────────────────────────────────────────
async function generateTopics() {
  const existingList = existingTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const prompt = `You are ${niche.persona}

Your site is valuefindsdaily.com — a visual listicle site. The goal is HIGH CLICK-THROUGH from Pinterest: titles must create a curiosity gap so people tap the pin to see the full ranked list.

TOPICS ALREADY PUBLISHED (do NOT repeat or closely overlap these):
${existingList}

Generate ${NEW_TOPICS_PER_RUN} brand-new "${niche.label}" listicle topics that would go viral on Pinterest right now.

Good angles for inspiration (invent fresh ones, don't copy verbatim): ${niche.angles.join('; ')}.

Rules:
- Each topic must be UNIQUE and not overlap with existing ones or each other
- Each must work as a RANKED listicle of 7-15 concrete, specific items (e.g. specific decor ideas, products, room setups) — not vague advice
- Use trending, specific, emotional/curiosity-gap Pinterest angles
- Titles: 5-10 words, scroll-stopping, no clickbait lies
- US English

Return a JSON object with this exact structure:
{
  "topics": [
    {
      "slug": "url-friendly-slug-here",
      "title": "Curiosity-gap listicle title",
      "desc": "1-2 sentence description of what concrete items this list will contain"
    }
  ]
}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.9,
  });

  const result = JSON.parse(response.choices[0].message.content);
  const { prompt_tokens, completion_tokens } = response.usage;
  const cost = ((prompt_tokens * 0.4 + completion_tokens * 1.6) / 1_000_000).toFixed(4);
  console.log(`GPT response: ${result.topics?.length || 0} topics generated | cost: $${cost}`);
  return result.topics || [];
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`Niche: ${niche.label}`);
  console.log(`Existing topics (all niches): ${existingSlugs.size} — will not repeat any`);
  console.log('Generating new trending topics...\n');

  let rawTopics;
  try {
    rawTopics = await generateTopics();
  } catch (err) {
    console.error('OpenAI error:', err.message);
    process.exit(1);
  }

  const valid = [];

  for (const topic of rawTopics) {
    if (!topic.slug || !topic.title) continue;

    if (existingSlugs.has(topic.slug)) {
      console.log(`  ⏭  Skipping duplicate slug: ${topic.slug}`);
      continue;
    }

    if (isSemanticDuplicate(topic.title, existingKeywordSets)) {
      console.log(`  ⏭  Skipping similar topic: "${topic.title}"`);
      continue;
    }

    console.log(`  ✓ "${topic.title}"`);
    valid.push({
      slug: topic.slug,
      title: topic.title,
      desc: topic.desc || '',
      niche: 'home',
      item_noun: niche.item_noun,
    });
    existingSlugs.add(topic.slug);
    existingKeywordSets.push(keywordSet(topic.title));
  }

  if (valid.length === 0) {
    console.log('\nNo valid new topics generated this run.');
    process.exit(0);
  }

  const updated = [...existingTrending, ...valid];
  fs.writeFileSync(TRENDING_TOPICS_PATH, JSON.stringify(updated, null, 2));

  console.log(`\n✅ Added ${valid.length} new topics → content/generated-topics-trending.json`);
  console.log(`   Total trending topics: ${updated.length}`);
})();
