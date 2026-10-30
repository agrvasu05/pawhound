#!/usr/bin/env python3
"""Lists trending Pinterest keywords worth a new guide today, best first.
    python3 scripts/trend-pick.py [N]
Reads content/trend-keywords.json (daily GitHub job). Keeps keywords that are
in season (scripts/season.js), on theme (home & DIY decor or holidays/occasions),
not beauty, not a celebrity/character/brand, and not already covered by a guide.
In-season holiday keywords come first, then the rest by trend score."""
import json, re, sys, os, glob, subprocess
N = int(sys.argv[1]) if len(sys.argv) > 1 else 10
d = json.load(open('content/trend-keywords.json'))
print('keywords from', d.get('generated_at'))
kws = d['keywords']
covered = set()
for f in glob.glob('content/articles/*.json'):
    a = json.load(open(f))
    covered.add(a['topic_slug'])
    if a.get('keyword'): covered.add(re.sub(r'[^a-z0-9]+', '-', a['keyword'].lower()).strip('-'))
words = lambda s: set(re.sub(r'[^a-z0-9]+', ' ', s.lower()).split()) - {'ideas', 'idea', 'the', 'for', 'and', 'a', 'of', 'to', 'diy', '2026', 'best'}
covered_words = [words(c.replace('-', ' ')) for c in covered]
BEAUTY = re.compile(r'\b(nails?|manicure|hair(style)?s?|makeup|lashes|brows?|skin ?care|tattoo|outfits?|dress(es)?)\b')
NAMES = re.compile(r'\b(snoopy|peanuts|disney|mickey|marvel|pokemon|hello kitty|barbie|bluey|taylor swift|harry potter|star wars|stitch|grinch|michael jackson|beyonce|labubu|stanley|sanrio|wednesday|squid game|kpop|demon hunters|nightmare before christmas|coraline|room on the broom|top gun\w*|elf on the shelf|winnie the pooh|minions?|pennywise|corpse bride|grinch)\b')
# season check through the same JS module the posters use
js = "const {inSeason,seasonOf}=require('./scripts/season');const k=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(JSON.stringify(k.map(x=>[inSeason(x),(seasonOf(x)||{}).name||null])))"
res = json.loads(subprocess.run(['node', '-e', js], input=json.dumps([k['keyword'] for k in kws]), capture_output=True, text=True, check=True).stdout)
HOLIDAY = {'halloween', 'thanksgiving', 'christmas', 'new-year', 'valentines', 'easter', 'mothers-day', 'fathers-day', 'fourth-of-july', 'st-patricks', 'winter', 'fall'}
out = []
for k, (ok, season) in zip(kws, res):
    kw = k['keyword']; slug = re.sub(r'[^a-z0-9]+', '-', kw).strip('-')
    if not ok or BEAUTY.search(kw) or NAMES.search(kw): continue
    # pumpkin carving/painting/character pumpkins are Halloween searches; only
    # pumpkin DECOR (porch, table, centerpiece) lasts into November
    if 'pumpkin' in kw and not re.search(r'decor|centerpiece|porch|table|mantel|entryway', kw): continue
    if slug in covered: continue
    w = words(kw)
    if w and any(len(w & c) / len(w | c) >= 0.6 for c in covered_words if c): continue
    out.append((0 if season in HOLIDAY else 1, -k.get('score', 0), kw, k.get('niche'), season, k.get('pop'), k.get('mom')))
out.sort()
# collapse near-duplicate keywords (keep the strongest of each group)
kept = []
for row in out:
    w = words(row[2])
    if any(len(w & words(k[2])) / max(1, len(w | words(k[2]))) >= 0.5 or w <= words(k[2]) or words(k[2]) <= w for k in kept):
        continue
    kept.append(row)
out = kept
for i, (h, s, kw, niche, season, pop, mom) in enumerate(out[:N], 1):
    print(f"{i:2}. {kw}  [{season or 'evergreen'} | {niche} | vol {pop} | MoM {mom}%]")
if not out: print('No fresh in-season keywords. Use the fallback list in content/TREND_GUIDE.md.')
