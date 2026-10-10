/**
 * prune-out.js — runs after `next build` (npm postbuild) on every host.
 * Removes files the browser never requests so the Cloudflare Pages deploy
 * stays far under its 20,000-file limit, then fails loudly near the limit.
 *  (Next's __next.*.txt prefetch files are KEPT: pruning them caused 404s
 *   on link prefetch, which Lighthouse counts as console errors.)
 *  - images/breeds/<item>/attribution.json  (read at build time only)
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(process.cwd(), 'out');
if (!fs.existsSync(OUT)) process.exit(0);
let removed = 0, total = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (e.name === 'attribution.json' && p.includes(`${path.sep}images${path.sep}`)) {
      fs.unlinkSync(p); removed++;
    } else total++;
  }
})(OUT);
console.log(`prune-out: removed ${removed} runtime-unused files; ${total} files remain`);
if (total > 19000) { console.error(`prune-out: ${total} files is near the 20,000-file Cloudflare Pages limit — move images to R2 (see content/OPERATIONS.md)`); process.exit(1); }
