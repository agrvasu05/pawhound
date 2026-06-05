// Clipart bundle (transparent PNGs) — the #1-demand digital category per research.
// AI-generated cohesive element sets; packaged as a ZIP. Modest API cost.
const fs = require('fs');
const path = require('path');
const lib = require('../lib');

const COUNT = 12; // ~$0.13 in image gen at low quality
const THEMES = [
  'watercolor wildflowers and botanicals', 'boho neutral arches and shapes',
  'cozy fall leaves and pumpkins', 'cute kawaii coffee and treats',
  'pastel celestial moons and stars', 'vintage spring florals',
];

const SCHEMA = {
  name: 'clipart', strict: true,
  schema: { type: 'object', additionalProperties: false,
    required: ['title', 'slug', 'description_html', 'tags', 'style', 'elements', 'pin_headline', 'pin_subhead', 'pin_title', 'pin_description'],
    properties: {
      title: { type: 'string', description: 'Etsy-style title, mentions "Clipart" / "PNG" / "Bundle"' },
      slug: { type: 'string' },
      description_html: { type: 'string', description: `HTML 120-180 words: ${COUNT} transparent PNG clipart elements, 300 DPI, commercial-use-friendly note, uses (planners, invites, stickers, POD), instant download` },
      tags: { type: 'array', items: { type: 'string' }, description: '5 lowercase tags' },
      style: { type: 'string', description: 'one cohesive visual style + palette for the whole set (e.g. "soft watercolor, blush + sage")' },
      elements: { type: 'array', items: { type: 'string' }, description: `${COUNT} distinct single-object element descriptions sharing the style` },
      pin_headline: { type: 'string', description: '<=22 chars' }, pin_subhead: { type: 'string', description: '<=34 chars' },
      pin_title: { type: 'string' }, pin_description: { type: 'string' },
    } } };

function coverHtml(c, thumbs) {
  const cells = thumbs.slice(0, 9).map((t) =>
    `<div style="background:#fff;border-radius:14px;padding:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(60,44,32,.12);">
       <img src="${t}" style="max-width:150px;max-height:150px;object-fit:contain;"/></div>`).join('');
  return `<div style="width:800px;height:1035px;box-sizing:border-box;padding:54px 46px;font-family:Georgia,serif;background:linear-gradient(160deg,#f6efe6,#ebe0d0);color:#33271c;">
    <div style="font-size:14px;letter-spacing:3px;color:#8a7257;text-transform:uppercase;text-align:center;">${lib.BRAND}</div>
    <div style="font-size:40px;font-weight:bold;line-height:1.1;text-align:center;margin:14px 0 6px;">${lib.esc(c.pin_headline || c.title)}</div>
    <div style="font-size:20px;color:#8a7257;text-align:center;margin-bottom:26px;">${COUNT} PNG clipart · transparent background</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">${cells}</div>
  </div>`;
}

async function generate(outRoot, brief) {
  const theme = brief
    ? `the trending Pinterest search "${brief.keyword}"${brief.season && brief.season !== 'evergreen' ? ` (${brief.season})` : ''}`
    : THEMES[Math.floor(Math.random() * THEMES.length)];
  const kwRule = brief ? ` The title MUST contain "${brief.keyword}"; tags include keyword terms.` : '';
  const c = await lib.chatJSON({
    system: 'You design cohesive CLIPART BUNDLES (transparent PNG sets) that sell on Pinterest/Etsy to crafters, planners and print-on-demand sellers. One unified style/palette across all elements. US English.',
    user: `Theme: ${theme}. Plan a ${COUNT}-element clipart set with one cohesive style. Give ${COUNT} distinct single-object elements, the listing, and Pinterest copy.${kwRule}`,
    schema: SCHEMA,
  });
  const slug = c.slug.replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const dir = path.join(outRoot, slug); fs.mkdirSync(dir, { recursive: true });
  const suffix = `, ${c.style}, flat minimalist clipart illustration, single isolated element, centered, transparent background, no text, no watermark`;
  const files = [];
  const pngs = [];
  for (let i = 0; i < c.elements.length; i++) {
    const buf = await lib.generateImage(c.elements[i] + suffix, { quality: 'low', size: '1024x1024', background: 'transparent' });
    const f = path.join(dir, `clipart-${i + 1}.png`); fs.writeFileSync(f, buf); files.push(`clipart-${i + 1}.png`); pngs.push(f);
  }
  fs.writeFileSync(path.join(dir, 'README.txt'),
    `${c.title}\n\nThank you! Included: ${files.length} transparent-background PNG clipart files.\nFor personal & small-business craft use. Do not resell the files as-is.\n\n— ${lib.BRAND}`);
  files.push('README.txt');
  const zipFile = lib.zip(dir, `${slug}.zip`, files);
  const coverPng = path.join(dir, 'cover.png');
  await lib.htmlToPng(`<html><body style="margin:0;">${coverHtml(c, pngs.map(lib.dataUrl))}</body></html>`, coverPng, { width: 800, height: 1035 });

  const board = brief && brief.boards && brief.boards[0]
    ? { name: brief.boards[0].slice(0, 50), description: `${brief.keyword} — clipart & PNG design bundles for crafters and creators.` }
    : { name: 'Clipart & PNG Design Bundles', description: 'Transparent PNG clipart sets for planners, invites, stickers and print-on-demand — instant downloads.' };
  return {
    type: 'clipart', slug, dir, keyword: brief ? brief.keyword : '',
    listing: { title: c.title, description_html: c.description_html, tags: c.tags, price: 6, slug, file: zipFile, fileName: `${c.title}.zip`, cover: coverPng },
    board,
    pin: { images: [coverPng], headline: c.pin_headline, subhead: c.pin_subhead, price: 6, accent: '#7a5c3a', title: c.pin_title, description: c.pin_description },
  };
}
module.exports = { generate };
