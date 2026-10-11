#!/usr/bin/env python3
"""Merges a written upgrade (JSON) into a guide after validating it, then marks it upgraded.
    python3 scripts/apply-upgrade.py <slug> <upgrade.json>
Upgrade JSON: {seo_title, answer, intro, method, faqs:[{question,answer}], picks:[{rank, breed?,
description, best_for, skip_if, quirky_fact, product_name? (non-dog guides)}]}. Ranks must match
the guide's ranks exactly; if "breed" is given it must match. Rejects hype phrases and testing claims."""
import json, re, sys, datetime
slug, src = sys.argv[1], sys.argv[2]
p = f'content/articles/{slug}.json'; a = json.load(open(p)); u = json.load(open(src))
dogs = (a.get('niche') or 'dogs') == 'dogs'
by = {x['rank']: x for x in u['picks']}
assert set(by) == {x['rank'] for x in a['picks']}, ('rank mismatch', sorted(by), sorted(x['rank'] for x in a['picks']))
for x in a['picks']:
    n = by[x['rank']]
    if 'breed' in n: assert n['breed'].lower() == x['breed'].lower(), (n['breed'], x['breed'])
    for k in ('description', 'best_for', 'skip_if', 'quirky_fact'):
        assert n.get(k), (x['rank'], 'missing ' + k); x[k] = n[k]
    if not dogs:
        assert n.get('product_name'), (x['rank'], 'missing product_name'); x['product_name'] = n['product_name']
for k in ('seo_title', 'answer', 'intro', 'method', 'faqs'):
    assert u.get(k), 'missing ' + k; a[k] = u[k]
assert len(a['seo_title']) <= 60, ('seo_title too long', len(a['seo_title']))
assert 4 <= len(a['faqs']) <= 6, 'need 4-6 faqs'
banned = ['is essential', 'transform your space', 'elevate', 'game-changer', 'look no further', "in today's world", 'whether you',
          'perfect addition', 'seamlessly', 'dive in', 'wonderful experience', 'furry friend', 'we tested', 'our dog', 'in our home', 'we tried', '!']
text = json.dumps(u).lower()
bad = [w for w in banned if re.search(r'(?<![a-z])' + re.escape(w) + r'(?![a-z])', text)]
assert not bad, ('banned phrases', bad)
today = datetime.date.today().isoformat()
a['author'] = 'Elena Marsh'; a['updated_at'] = a['upgraded_at'] = today
json.dump(a, open(p, 'w'), indent=2)
print('saved', slug, len(a['picks']), 'picks |', a['seo_title'])
