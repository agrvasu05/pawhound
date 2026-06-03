// Printable wall-art set (3 coordinating AI prints). Highest-volume Pinterest category.
const fs = require('fs');
const path = require('path');
const lib = require('../lib');

const THEMES = [
  'boho minimalist dog line art in warm neutral beige, cream and terracotta',
  'soft watercolor sleeping dogs in cozy sunlit rooms, calming pastel tones',
  'Japandi style minimalist dog portraits, muted sage and oatmeal palette',
  'vintage botanical illustration with a gentle dog, soft antique tones',
  'cozy cottage home scenes with a dog, warm watercolor, hygge mood',
  'abstract pastel mid-century dog art, mustard, blush and teal',
];

const SCHEMA = {
  name: 'wall_art', strict: true,
  schema: { type: 'object', additionalProperties: false,
    required: ['title', 'slug', 'description_html', 'tags', 'art_prompts', 'pin_title', 'pin_description', 'pin_headline', 'pin_subhead'],
    properties: {
      title: { type: 'string', description: 'Etsy-style title 60-90 chars, mentions "Printable Wall Art Set"' },
      slug: { type: 'string', description: 'lowercase-hyphen slug max 5 words' },
      description_html: { type: 'string', description: 'HTML description 120-180 words: what you get, sizes, how to print, for personal use' },
      tags: { type: 'array', items: { type: 'string' }, description: '5 lowercase tags' },
      art_prompts: { type: 'array', items: { type: 'string' }, description: '3 cohesive prompts, same style/palette, no text in image' },
      pin_title: { type: 'string' }, pin_description: { type: 'string' },
      pin_headline: { type: 'string', description: 'punchy <=22 chars' },
      pin_subhead: { type: 'string', description: '<=34 chars' },
    } } };

async function generate(outRoot, brief) {
  const theme = brief
    ? `the trending Pinterest search "${brief.keyword}"${brief.season && brief.season !== 'evergreen' ? ` (${brief.season} season)` : ''}`
    : THEMES[Math.floor(Math.random() * THEMES.length)];
  const kwRule = brief ? ` The product title MUST contain "${brief.keyword}" and the tags must include keyword terms — this targets real Pinterest search demand.` : '';
  const c = await lib.chatJSON({
    system: 'You create on-trend printable WALL ART sets that sell on Pinterest (home & lifestyle, US women). Lean into proven aesthetics. No text in the art. US English.',
    user: `Theme: ${theme}. Design a SET of 3 coordinating prints. Give the listing + Pinterest copy.${kwRule}`,
    schema: SCHEMA,
  });
  const slug = c.slug.replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const dir = path.join(outRoot, slug); fs.mkdirSync(dir, { recursive: true });
  const suffix = ', gallery-quality printable wall art, trending Pinterest aesthetic, portrait, clean negative space, no text, no letters, no frame, no watermark';
  const prints = [];
  for (let i = 0; i < c.art_prompts.length; i++) {
    const buf = await lib.generateImage(c.art_prompts[i] + suffix, { quality: 'low' });
    const f = path.join(dir, `print-${i + 1}.png`); fs.writeFileSync(f, buf); prints.push(f);
  }
  fs.copyFileSync(prints[0], path.join(dir, 'cover.png'));
  fs.writeFileSync(path.join(dir, 'README.txt'),
    `${c.title}\n\nThank you! Included: 3 high-resolution PNG prints. Print up to 11x14" on matte paper or at a print shop. Personal use only.\n\n— ${lib.BRAND}`);
  const zipFile = lib.zip(dir, `${slug}.zip`, ['print-1.png', 'print-2.png', 'print-3.png', 'README.txt']);
  const board = brief && brief.boards && brief.boards[0]
    ? { name: brief.boards[0].slice(0, 50), description: `${brief.keyword} — curated printable wall art & decor, instant downloads.` }
    : { name: 'Printable Wall Art & Cozy Decor', description: 'Printable wall art and cozy home decor — instant digital downloads for warm, calming spaces.' };
  return {
    type: 'wall-art', slug, dir, keyword: brief ? brief.keyword : '',
    listing: { title: c.title, description_html: c.description_html, tags: c.tags, price: 5, slug, file: zipFile, fileName: `${c.title}.zip`, cover: path.join(dir, 'cover.png') },
    board,
    pin: { images: prints, headline: c.pin_headline, subhead: c.pin_subhead, price: 5, accent: '#2d4a3e', title: c.pin_title, description: c.pin_description },
  };
}
module.exports = { generate };
