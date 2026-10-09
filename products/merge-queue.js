/**
 * merge-queue.js — resolves a git merge conflict in the JSON trackers that
 * several workflows append to concurrently (content/pin-queue.json,
 * content/posted-pins.json, content/gumroad-products.json, content/used-briefs.json).
 *
 * Called from the workflows' commit steps when `git pull --rebase` stops on a
 * conflict. For each conflicted tracker it reads "ours" and "theirs" from the
 * index, unions them, writes the result and stages it. Arrays are unioned by a
 * stable key; objects are shallow-merged (theirs wins on a key present in both
 * only when ours lacks posted_at — i.e. the posted record always survives).
 *
 *   node products/merge-queue.js   # then: GIT_EDITOR=true git rebase --continue
 */
const { execSync } = require('child_process');
const fs = require('fs');

const TRACKERS = {
  'content/pin-queue.json': { kind: 'array', key: (e) => `${e.slug}|${e.title}|${e.created_at}` },
  'content/gumroad-products.json': { kind: 'array', key: (e) => e.gumroad_id || `${e.slug}|${e.created_at}` },
  'content/used-briefs.json': { kind: 'array', key: (e) => String(e) },
  'content/posted-pins.json': { kind: 'object' },
  'content/pinterest-boards.json': { kind: 'object' },
};

function stage(path, n) {
  try { return JSON.parse(execSync(`git show :${n}:${path}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })); }
  catch { return null; }
}

const conflicted = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf-8' }).split('\n').filter(Boolean);
let resolved = 0;
for (const file of conflicted) {
  const spec = TRACKERS[file];
  if (!spec) { console.error(`Unresolved conflict outside the trackers: ${file}`); continue; }
  const ours = stage(file, 2), theirs = stage(file, 3);
  if (ours == null || theirs == null) { console.error(`Could not read both sides of ${file}`); continue; }
  let merged;
  if (spec.kind === 'array') {
    const map = new Map();
    for (const e of [...theirs, ...ours]) {
      const k = spec.key(e);
      const prev = map.get(k);
      // keep the entry that has progressed further (posted beats pending)
      if (!prev || (e && e.status === 'posted' && prev.status !== 'posted')) map.set(k, e);
    }
    merged = [...map.values()];
  } else {
    merged = { ...theirs, ...ours };
    for (const [k, v] of Object.entries(theirs)) if (v && v.posted_at && !(ours[k] && ours[k].posted_at)) merged[k] = v;
  }
  fs.writeFileSync(file, JSON.stringify(merged, null, 2));
  execSync(`git add "${file}"`);
  resolved++;
  console.log(`✓ merged ${file} (${Array.isArray(merged) ? merged.length + ' entries' : Object.keys(merged).length + ' keys'})`);
}
if (conflicted.length && resolved !== conflicted.length) process.exit(1);
console.log(resolved ? 'Trackers merged; continue the rebase.' : 'No tracker conflicts.');
