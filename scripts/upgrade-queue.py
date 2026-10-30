#!/usr/bin/env python3
"""Lists the next guides to upgrade (in-season home & holiday guides first, then dogs, then the
rest), skipping
duplicates (content/article-canonical.json), off-niche archives and already-upgraded guides.
    python3 scripts/upgrade-queue.py [N]"""
import json, glob, sys
N = int(sys.argv[1]) if len(sys.argv) > 1 else 2
red = json.load(open('content/article-canonical.json'))
import subprocess
cands = []
for f in glob.glob('content/articles/*.json'):
    a = json.load(open(f)); n = a.get('niche') or 'dogs'
    if a.get('upgraded_at') or a['topic_slug'] in red or n in ('beauty', 'fashion') or len(a['picks']) < 3: continue
    cands.append(a)
# Oct 2026: home/holiday guides get the Pinterest reach, so upgrade the ones that
# are in season now first; off-season ones wait for their season.
js = "const {inSeason,seasonOf}=require('./scripts/season');const k=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(JSON.stringify(k.map(x=>[inSeason(x),!!seasonOf(x)])))"
flags = json.loads(subprocess.run(['node', '-e', js], input=json.dumps([a['topic_slug'] + ' ' + a['topic_title'] for a in cands]), capture_output=True, text=True, check=True).stdout)
rows = []
for a, (ins, seasonal) in zip(cands, flags):
    n = a.get('niche') or 'dogs'
    if n == 'dogs': pri = 2
    elif ins and seasonal: pri = 0
    elif ins: pri = 1
    else: pri = 3
    rows.append((pri, -len(a['picks']), a['topic_slug'], n))
rows.sort()
print(f"{len(rows)} guides left to upgrade")
for r in rows[:N]: print(r[2], f"(niche: {r[3]})")
