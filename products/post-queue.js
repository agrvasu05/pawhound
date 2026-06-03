/**
 * post-queue.js — drip-posts pending pin variants to Pinterest, linking to the
 * owned /shop/<slug> landing pages. Run daily AFTER the site has deployed.
 * Posts at most 1 pin per product per day, up to --max total (default 5).
 */
const lib = require('./lib');
const maxArg = process.argv.find((a) => a.startsWith('--max='));
const maxPerRun = maxArg ? parseInt(maxArg.split('=')[1]) : 5;
lib.postQueue({ maxPerRun }).catch((e) => { console.error(e); process.exit(1); });
