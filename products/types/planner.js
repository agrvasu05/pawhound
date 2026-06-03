// Printable planner / tracker / checklist (HTML→PDF, ~$0 image cost). Highest purchase intent.
const fs = require('fs');
const path = require('path');
const lib = require('../lib');

const IDEAS = [
  'New Puppy Checklist & First-Year Planner', 'Dog Care & Health Tracker',
  'Weekly Meal Planner & Grocery List', 'Cozy Home Cleaning Schedule',
  'Daily Self-Care & Habit Tracker', 'Pet Feeding & Walk Schedule',
  'Home Budget & Bill Tracker', 'Dog Training Progress Tracker',
];

const SCHEMA = {
  name: 'planner', strict: true,
  schema: { type: 'object', additionalProperties: false,
    required: ['title', 'slug', 'subtitle', 'description_html', 'tags', 'pages', 'pin_title', 'pin_description', 'pin_headline', 'pin_subhead'],
    properties: {
      title: { type: 'string', description: 'Etsy-style title, mentions "Printable" / "Planner" / "Tracker"' },
      slug: { type: 'string' },
      subtitle: { type: 'string', description: 'short cover subtitle' },
      description_html: { type: 'string', description: 'HTML 120-180 words: what it includes, US Letter PDF, print or use on tablet, personal use' },
      tags: { type: 'array', items: { type: 'string' }, description: '5 lowercase tags' },
      pages: { type: 'array', description: '4-6 useful pages',
        items: { type: 'object', additionalProperties: false, required: ['heading', 'type', 'items', 'columns'],
          properties: {
            heading: { type: 'string' },
            type: { type: 'string', enum: ['checklist', 'table', 'weekly'] },
            items: { type: 'array', items: { type: 'string' }, description: 'checklist items (else empty array)' },
            columns: { type: 'array', items: { type: 'string' }, description: 'table column headers (else empty array)' },
          } } },
      pin_title: { type: 'string' }, pin_description: { type: 'string' },
      pin_headline: { type: 'string', description: '<=22 chars' }, pin_subhead: { type: 'string', description: '<=34 chars' },
    } } };

const COVER_CSS = `font-family:Georgia,serif;background:linear-gradient(160deg,#f3ede1,#e7ddc9);color:#33271c;`;
function coverHtml(c, w = '8.5in', h = '11in') {
  return `<div style="width:${w};height:${h};box-sizing:border-box;padding:1.1in 0.9in;${COVER_CSS}display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always;">
    <div style="font-size:15px;letter-spacing:3px;color:#8a7257;text-transform:uppercase;">${lib.BRAND}</div>
    <div style="font-size:52px;font-weight:bold;line-height:1.1;margin-top:24px;">${lib.esc(c.title)}</div>
    <div style="width:80px;height:3px;background:#8a7257;margin:28px auto;"></div>
    <div style="font-size:22px;color:#6b5844;">${lib.esc(c.subtitle)}</div>
  </div>`;
}
function pageHtml(pg) {
  let body = '';
  if (pg.type === 'checklist') {
    body = pg.items.map((it) => `<div style="display:flex;align-items:center;gap:14px;padding:11px 0;border-bottom:1px solid #e7ddc9;font-size:17px;">
      <span style="width:20px;height:20px;border:2px solid #8a7257;border-radius:4px;flex:0 0 auto;"></span>${lib.esc(it)}</div>`).join('');
  } else if (pg.type === 'weekly') {
    body = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) =>
      `<div style="padding:14px 0;border-bottom:1px solid #e7ddc9;"><div style="font-size:15px;color:#8a7257;letter-spacing:1px;">${d.toUpperCase()}</div><div style="height:34px;"></div></div>`).join('');
  } else { // table
    const cols = pg.columns.length ? pg.columns : ['Item', 'Notes'];
    const head = cols.map((c) => `<th style="text-align:left;padding:10px 8px;border-bottom:2px solid #8a7257;font-size:14px;letter-spacing:1px;color:#6b5844;">${lib.esc(c.toUpperCase())}</th>`).join('');
    const rows = Array.from({ length: 16 }).map(() => `<tr>${cols.map(() => `<td style="border-bottom:1px solid #e7ddc9;height:36px;"></td>`).join('')}</tr>`).join('');
    body = `<table style="width:100%;border-collapse:collapse;"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  return `<div style="width:8.5in;height:11in;box-sizing:border-box;padding:0.9in 0.85in;font-family:Georgia,serif;color:#33271c;background:#fffdf8;page-break-after:always;">
    <div style="font-size:30px;font-weight:bold;border-bottom:3px solid #8a7257;padding-bottom:12px;margin-bottom:22px;">${lib.esc(pg.heading)}</div>
    ${body}
    <div style="position:relative;margin-top:24px;text-align:center;font-size:12px;color:#b3a890;">${lib.BRAND}</div>
  </div>`;
}

async function generate(outRoot, brief) {
  const idea = brief
    ? `${brief.keyword} — a printable planner/tracker/checklist for this trending search`
    : IDEAS[Math.floor(Math.random() * IDEAS.length)];
  const kwRule = brief ? ` The product title MUST contain "${brief.keyword}"; tags must include keyword terms.` : '';
  const c = await lib.chatJSON({
    system: 'You design genuinely useful printable PLANNERS/TRACKERS/CHECKLISTS that sell on Pinterest/Etsy. Practical, clean, real fields people use. US English.',
    user: `Make a printable: "${idea}". Provide 4-6 useful pages (checklist/table/weekly). Give the listing + Pinterest copy. For non-applicable fields use empty arrays.${kwRule}`,
    schema: SCHEMA,
  });
  const slug = c.slug.replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const dir = path.join(outRoot, slug); fs.mkdirSync(dir, { recursive: true });
  // Full PDF: cover + pages
  const pdfHtml = `<html><body style="margin:0;">${coverHtml(c)}${c.pages.map(pageHtml).join('')}</body></html>`;
  const pdf = path.join(dir, `${slug}.pdf`); await lib.htmlToPdf(pdfHtml, pdf);
  // Cover PNG (portrait) for pin hero + Gumroad cover
  const coverPng = path.join(dir, 'cover.png');
  await lib.htmlToPng(`<html><body style="margin:0;">${coverHtml(c, '800px', '1035px')}</body></html>`, coverPng, { width: 800, height: 1035 });
  const board = brief && brief.boards && brief.boards[0]
    ? { name: brief.boards[0].slice(0, 50), description: `${brief.keyword} — printable planners, trackers & checklists, instant downloads.` }
    : { name: 'Printable Planners & Organizers', description: 'Printable planners, trackers and checklists for a calmer, more organized life — instant digital downloads.' };
  return {
    type: 'planner', slug, dir, keyword: brief ? brief.keyword : '',
    listing: { title: c.title, description_html: c.description_html, tags: c.tags, price: 4, slug, file: pdf, fileName: `${c.title}.pdf`, cover: coverPng },
    board,
    pin: { images: [coverPng], headline: c.pin_headline, subhead: c.pin_subhead, price: 4, accent: '#7a5c3a', title: c.pin_title, description: c.pin_description },
  };
}
module.exports = { generate };
