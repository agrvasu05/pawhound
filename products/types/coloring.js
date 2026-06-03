// Printable coloring pages pack (AI line art). Easy to mass-produce, parents love them.
const fs = require('fs');
const path = require('path');
const lib = require('../lib');

const PAGE_COUNT = 6; // ~$0.06 in image gen
const THEMES = [
  'adorable dog breeds in cute poses', 'cozy home scenes with sleeping dogs',
  'puppies playing in a garden', 'dogs celebrating holidays and seasons',
  'whimsical dogs with flowers and hearts', 'farmhouse pets and cozy cottage life',
];

const SCHEMA = {
  name: 'coloring', strict: true,
  schema: { type: 'object', additionalProperties: false,
    required: ['title', 'slug', 'description_html', 'tags', 'page_subjects', 'pin_title', 'pin_description', 'pin_headline', 'pin_subhead'],
    properties: {
      title: { type: 'string', description: 'Etsy-style title, mentions "Printable Coloring Pages"' },
      slug: { type: 'string' },
      description_html: { type: 'string', description: `HTML 120-180 words: ${PAGE_COUNT} pages, US Letter, print at home, kids & adults, personal use` },
      tags: { type: 'array', items: { type: 'string' }, description: '5 lowercase tags' },
      page_subjects: { type: 'array', items: { type: 'string' }, description: `${PAGE_COUNT} distinct subjects to draw as coloring pages` },
      pin_title: { type: 'string' }, pin_description: { type: 'string' },
      pin_headline: { type: 'string', description: '<=22 chars' }, pin_subhead: { type: 'string', description: '<=34 chars' },
    } } };

async function generate(outRoot, brief) {
  const theme = brief
    ? `the trending Pinterest search "${brief.keyword}"${brief.season && brief.season !== 'evergreen' ? ` (${brief.season} season)` : ''}`
    : THEMES[Math.floor(Math.random() * THEMES.length)];
  const kwRule = brief ? ` The product title MUST contain "${brief.keyword}"; tags must include keyword terms.` : '';
  const c = await lib.chatJSON({
    system: 'You create printable COLORING PAGE packs that sell on Pinterest/Etsy (lifestyle, families, kids & adults). US English.',
    user: `Theme: ${theme}. Plan a ${PAGE_COUNT}-page coloring book. Give the listing, Pinterest copy, and ${PAGE_COUNT} distinct page subjects.${kwRule}`,
    schema: SCHEMA,
  });
  const slug = c.slug.replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const dir = path.join(outRoot, slug); fs.mkdirSync(dir, { recursive: true });
  const suffix = ', black and white line art coloring page, bold clean outlines only, no shading, no grayscale, pure white background, simple, printable, no text';
  const pages = [];
  for (let i = 0; i < c.page_subjects.length; i++) {
    const buf = await lib.generateImage(c.page_subjects[i] + suffix, { quality: 'low' });
    const f = path.join(dir, `page-${i + 1}.png`); fs.writeFileSync(f, buf); pages.push(f);
  }
  // Build a print-ready PDF (one page per image, US Letter)
  const html = `<html><body style="margin:0;">${pages.map((p) =>
    `<div style="width:8.5in;height:11in;display:flex;align-items:center;justify-content:center;page-break-after:always;">
       <img src="${lib.dataUrl(p)}" style="max-width:7.5in;max-height:10in;"/></div>`).join('')}</body></html>`;
  const pdf = path.join(dir, `${slug}.pdf`);
  await lib.htmlToPdf(html, pdf);
  fs.copyFileSync(pages[0], path.join(dir, 'cover.png'));
  const board = brief && brief.boards && brief.boards[0]
    ? { name: brief.boards[0].slice(0, 50), description: `${brief.keyword} — printable coloring pages, instant downloads for kids & adults.` }
    : { name: 'Printable Coloring Pages', description: 'Printable coloring pages for kids and adults — instant digital downloads.' };
  return {
    type: 'coloring', slug, dir, keyword: brief ? brief.keyword : '',
    listing: { title: c.title, description_html: c.description_html, tags: c.tags, price: 4, slug, file: pdf, fileName: `${c.title}.pdf`, cover: path.join(dir, 'cover.png') },
    board,
    pin: { images: pages, headline: c.pin_headline, subhead: c.pin_subhead, price: 4, accent: '#5b4a8a', title: c.pin_title, description: c.pin_description },
  };
}
module.exports = { generate };
