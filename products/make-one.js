/**
 * make-one.js — generate ONE printable wall-art product end to end:
 *   1. GPT writes the listing (title, description, tags) + 3 coordinating art prompts
 *   2. gpt-image-1 renders the 3 prints (cheap)
 *   3. packages a ZIP deliverable + picks a cover + writes listing.json
 *
 * Output: products/output/<slug>/  (art PNGs, <slug>.zip, cover.png, listing.json)
 * Then upload with the Gumroad CLI using listing.json.
 */
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CONCEPT_SCHEMA = {
  name: 'wall_art_product',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Etsy/Gumroad-style product title, 60-90 chars, keyword-rich, mentions "Printable Wall Art Set"' },
      slug: { type: 'string', description: 'lowercase-hyphenated url slug, max 5 words' },
      description_html: { type: 'string', description: 'Compelling HTML product description: what they get, sizes, how to print, uses. 120-200 words, simple <p>/<ul> tags.' },
      tags: { type: 'array', items: { type: 'string' }, description: '5 short Gumroad tags (lowercase, no #)' },
      art_prompts: {
        type: 'array',
        description: '3 prompts for a COORDINATING set (same style/palette, different scenes). No text in the image.',
        items: { type: 'string' },
      },
      pin_title: { type: 'string', description: 'Pinterest pin title, keyword-rich, <=95 chars' },
      pin_description: { type: 'string', description: 'Pinterest pin description with keywords + a "Tap to shop" CTA, <=480 chars' },
      pin_headline: { type: 'string', description: 'Punchy 2-4 word overlay headline for the pin image, e.g. "Cozy Dog Art" — max 22 chars' },
      pin_subhead: { type: 'string', description: 'Short benefit line under the headline, e.g. "Set of 3 printable prints" — max 34 chars' },
    },
    required: ['title', 'slug', 'description_html', 'tags', 'art_prompts', 'pin_title', 'pin_description', 'pin_headline', 'pin_subhead'],
    additionalProperties: false,
  },
};

async function main() {
  const theme =
    process.argv.slice(2).join(' ') ||
    'cozy watercolor dog wall art for a warm, calming home — gentle pastel tones';

  console.log('1/4 Writing the listing + art prompts...');
  const chat = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: 'You create tasteful, on-trend printable WALL ART products that sell well on Pinterest/Gumroad (home & dog lovers, mostly US women). Lean into aesthetics that are PROVEN to sell on Pinterest: boho neutral, Japandi, minimalist line art, soft watercolor, vintage botanical — pick ONE cohesive trendy style per set. Premium, gallery-worthy, never spammy. US English.' },
      { role: 'user', content: `Theme: ${theme}\n\nDesign a printable wall art SET of 3 coordinating prints. The art must contain NO text or lettering (typography ruins AI art). Give 3 art prompts that share one cohesive on-trend style + palette but show different scenes. Then write the listing and Pinterest copy (pin_headline must be short + punchy for an image overlay).` },
    ],
    response_format: { type: 'json_schema', json_schema: CONCEPT_SCHEMA },
    temperature: 0.8,
  });
  const concept = JSON.parse(chat.choices[0].message.content);
  const slug = concept.slug.replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const outDir = path.join(process.cwd(), 'products', 'output', slug);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`   "${concept.title}"`);

  console.log('2/4 Rendering 3 prints with gpt-image-1 (low cost)...');
  const styleSuffix = ', gallery-quality printable wall art, trending Pinterest aesthetic, portrait orientation, refined composition, lots of clean negative space, no text, no words, no letters, no frame, no watermark';
  const pngs = [];
  for (let i = 0; i < concept.art_prompts.length; i++) {
    const r = await client.images.generate({
      model: 'gpt-image-1',
      prompt: concept.art_prompts[i] + styleSuffix,
      size: '1024x1536',
      quality: 'low', // ~$0.01/image vs ~$0.04 medium — looks great for this style
      n: 1,
    });
    const file = path.join(outDir, `print-${i + 1}.png`);
    fs.writeFileSync(file, Buffer.from(r.data[0].b64_json, 'base64'));
    pngs.push(file);
    console.log(`   ✓ print-${i + 1}.png`);
  }

  console.log('3/4 Packaging deliverable (ZIP) + cover...');
  fs.copyFileSync(pngs[0], path.join(outDir, 'cover.png'));
  fs.writeFileSync(
    path.join(outDir, 'README.txt'),
    `${concept.title}\n\nThank you for your purchase!\n\nIncluded: 3 high-resolution printable art files (PNG).\nFor best results print at up to 11x14 inches on matte photo paper, or use a local/online print shop.\nFor personal use. Please do not resell or redistribute the files.\n\n— Value Finds Daily\n`
  );
  const zipName = `${slug}.zip`;
  execSync(`cd "${outDir}" && zip -q "${zipName}" print-1.png print-2.png print-3.png README.txt`);

  const listing = {
    slug,
    title: concept.title,
    description_html: concept.description_html,
    tags: concept.tags,
    price: 5,
    currency: 'usd',
    deliverable: path.join(outDir, zipName),
    cover: path.join(outDir, 'cover.png'),
    prints: pngs,
    pin_title: concept.pin_title,
    pin_description: concept.pin_description,
    pin_headline: concept.pin_headline,
    pin_subhead: concept.pin_subhead,
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'listing.json'), JSON.stringify(listing, null, 2));

  console.log('4/4 Done.');
  console.log(`OUTPUT_DIR=${outDir}`);
  console.log(`SLUG=${slug}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
