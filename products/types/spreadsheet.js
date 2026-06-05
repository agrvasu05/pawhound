// Editable spreadsheet template (.xlsx) — budget/savings/meal/fitness trackers.
// High-intent Pinterest/Etsy seller, fully automatable, ~$0 API cost (no images).
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const lib = require('../lib');

const IDEAS = [
  'Monthly Budget & Bill Tracker', 'Savings & Money Goals Tracker',
  'Weekly Meal Planner & Grocery List', 'Debt Payoff Tracker',
  'Expense & Spending Log', 'Fitness & Workout Tracker',
  'Wedding Budget Planner', 'Net Worth & Investment Tracker',
];

const SCHEMA = {
  name: 'spreadsheet', strict: true,
  schema: { type: 'object', additionalProperties: false,
    required: ['title', 'slug', 'description_html', 'tags', 'sheets', 'pin_headline', 'pin_subhead', 'pin_title', 'pin_description'],
    properties: {
      title: { type: 'string', description: 'Etsy-style title, mentions "Spreadsheet Template" or "Tracker (Excel/Google Sheets)"' },
      slug: { type: 'string' },
      description_html: { type: 'string', description: 'HTML 120-180 words: what it tracks, works in Excel & Google Sheets, editable, instant download, personal use' },
      tags: { type: 'array', items: { type: 'string' }, description: '5 lowercase tags' },
      sheets: { type: 'array', description: '2-4 worksheets',
        items: { type: 'object', additionalProperties: false, required: ['name', 'headers', 'amount_column'],
          properties: {
            name: { type: 'string', description: 'tab name, <=28 chars' },
            headers: { type: 'array', items: { type: 'string' }, description: '4-7 column headers' },
            amount_column: { type: 'integer', description: '1-based index of the numeric column to auto-total, or 0 if none' },
          } } },
      pin_headline: { type: 'string', description: '<=22 chars' }, pin_subhead: { type: 'string', description: '<=34 chars' },
      pin_title: { type: 'string' }, pin_description: { type: 'string' },
    } } };

const HEADER_FILL = 'FF2D4A3E';
function buildWorkbook(c, file) {
  const wb = new ExcelJS.Workbook();
  wb.creator = lib.BRAND;
  for (const s of c.sheets) {
    const ws = wb.addWorksheet((s.name || 'Sheet').slice(0, 28));
    ws.addRow(s.headers);
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    head.height = 22;
    s.headers.forEach((h, i) => { ws.getColumn(i + 1).width = Math.max(16, String(h).length + 4); });
    const ROWS = 24;
    for (let r = 0; r < ROWS; r++) {
      const row = ws.addRow([]);
      if (r % 2 === 1) row.eachCell({ includeEmpty: true }, (cell, col) => { if (col <= s.headers.length) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3EFE6' } }; });
    }
    // Auto-total row if a numeric column is flagged
    if (s.amount_column && s.amount_column >= 1 && s.amount_column <= s.headers.length) {
      const col = s.amount_column;
      const letter = ws.getColumn(col).letter;
      const totalRow = ws.addRow([]);
      totalRow.getCell(Math.max(1, col - 1)).value = 'TOTAL';
      totalRow.getCell(Math.max(1, col - 1)).font = { bold: true };
      const tcell = totalRow.getCell(col);
      tcell.value = { formula: `SUM(${letter}2:${letter}${1 + ROWS})` };
      tcell.font = { bold: true };
      tcell.border = { top: { style: 'thin' } };
    }
  }
  return wb.xlsx.writeFile(file);
}

function coverHtml(c) {
  const cols = (c.sheets[0] && c.sheets[0].headers) || ['Date', 'Item', 'Amount'];
  const cell = (t, head) => `<div style="flex:1;padding:9px 8px;border:1px solid #e2dccb;${head ? 'background:#2d4a3e;color:#fff;font-weight:bold;' : 'background:#fff;color:#9a907e;'};font-size:13px;overflow:hidden;white-space:nowrap;">${lib.esc(t)}</div>`;
  const row = (cells, head) => `<div style="display:flex;">${cells.map((t) => cell(t, head)).join('')}</div>`;
  const blanks = Array.from({ length: 6 }).map(() => row(cols.map(() => ''), false)).join('');
  return `<div style="width:800px;height:1035px;box-sizing:border-box;padding:70px 56px;font-family:Georgia,serif;background:linear-gradient(160deg,#f3ede1,#e7dccb);color:#33271c;">
    <div style="font-size:15px;letter-spacing:3px;color:#8a7257;text-transform:uppercase;">${lib.BRAND}</div>
    <div style="font-size:46px;font-weight:bold;line-height:1.1;margin:18px 0 8px;">${lib.esc(c.title)}</div>
    <div style="font-size:22px;color:#6b5844;margin-bottom:30px;">Editable · Excel &amp; Google Sheets</div>
    <div style="box-shadow:0 16px 40px rgba(60,44,32,.22);">${row(cols, true)}${blanks}</div>
    <div style="margin-top:26px;font-size:18px;color:#8a7257;">Auto-calculating · ${c.sheets.length} tabs · instant download</div>
  </div>`;
}

async function generate(outRoot, brief) {
  const idea = brief ? `${brief.keyword} — an editable spreadsheet tracker/template for this trending search` : IDEAS[Math.floor(Math.random() * IDEAS.length)];
  const kwRule = brief ? ` The title MUST contain "${brief.keyword}"; tags include keyword terms.` : '';
  const c = await lib.chatJSON({
    system: 'You design genuinely useful EDITABLE SPREADSHEET TEMPLATES (Excel/Google Sheets) that sell on Pinterest/Etsy — budgets, trackers, planners with real, usable columns. US English.',
    user: `Design a spreadsheet template: "${idea}". Give 2-4 worksheets with real column headers; mark the numeric column to auto-total (amount_column), else 0. Then the listing + Pinterest copy.${kwRule}`,
    schema: SCHEMA,
  });
  const slug = c.slug.replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const dir = path.join(outRoot, slug); fs.mkdirSync(dir, { recursive: true });
  const xlsx = path.join(dir, `${slug}.xlsx`);
  await buildWorkbook(c, xlsx);
  const coverPng = path.join(dir, 'cover.png');
  await lib.htmlToPng(`<html><body style="margin:0;">${coverHtml(c)}</body></html>`, coverPng, { width: 800, height: 1035 });

  const board = brief && brief.boards && brief.boards[0]
    ? { name: brief.boards[0].slice(0, 50), description: `${brief.keyword} — editable spreadsheet templates & trackers, instant download.` }
    : { name: 'Spreadsheet Templates & Trackers', description: 'Editable budget, savings and planner spreadsheet templates for Excel & Google Sheets — instant downloads.' };
  return {
    type: 'spreadsheet', slug, dir, keyword: brief ? brief.keyword : '',
    listing: { title: c.title, description_html: c.description_html, tags: c.tags, price: 5, slug, file: xlsx, fileName: `${c.title}.xlsx`, cover: coverPng },
    board,
    pin: { images: [coverPng], headline: c.pin_headline, subhead: c.pin_subhead, price: 5, accent: '#2d4a3e', title: c.pin_title, description: c.pin_description },
  };
}
module.exports = { generate };
