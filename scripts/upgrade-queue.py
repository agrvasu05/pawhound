#!/usr/bin/env python3
"""Lists the next guides to upgrade (dogs first, then home decor, then home), skipping
duplicates (content/article-canonical.json), off-niche archives and already-upgraded guides.
    python3 scripts/upgrade-queue.py [N]"""
import json, glob, sys
N = int(sys.argv[1]) if len(sys.argv) > 1 else 2
red = json.load(open('content/article-canonical.json'))
rows = []
for f in glob.glob('content/articles/*.json'):
    a = json.load(open(f)); n = a.get('niche') or 'dogs'
    if a.get('upgraded_at') or a['topic_slug'] in red or n in ('beauty', 'fashion') or len(a['picks']) < 3: continue
    rows.append(({'dogs': 0, 'home decor': 1}.get(n, 2), -len(a['picks']), a['topic_slug'], n))
rows.sort()
print(f"{len(rows)} guides left to upgrade")
for r in rows[:N]: print(r[2], f"(niche: {r[3]})")
