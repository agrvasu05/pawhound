#!/usr/bin/env python3
"""Creates the base file for a NEW guide from a spec, after validating it.
    python3 scripts/new-guide.py <spec.json>
Spec: {topic_slug, topic_title, keyword, item_noun, picks:[{rank, breed, image_query}],
pin_headlines:[...]} . Then write the upgrade JSON and run scripts/apply-upgrade.py.
"breed" is the item's name (the site's field name is historical)."""
import json, re, sys, os, datetime
s = json.load(open(sys.argv[1]))
slug = s['topic_slug']
assert re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', slug), 'slug must be lowercase-hyphenated'
p = f'content/articles/{slug}.json'
assert not os.path.exists(p), 'a guide with this slug already exists'
for k in ('topic_title', 'keyword', 'item_noun', 'picks', 'pin_headlines'):
    assert s.get(k), 'missing ' + k
picks = s['picks']
assert 6 <= len(picks) <= 12, 'need 6-12 picks'
assert [x['rank'] for x in picks] == list(range(1, len(picks) + 1)), 'ranks must be 1..N in order'
names = [x['breed'].strip().lower() for x in picks]
assert len(set(names)) == len(names), 'duplicate pick names'
for x in picks:
    assert x.get('breed') and x.get('image_query'), (x.get('rank'), 'need breed (item name) and image_query')
    assert len(x['image_query'].split()) >= 2, (x['rank'], 'image_query should name the object, 2+ words')
hl = s['pin_headlines']
assert 6 <= len(hl) <= 10, 'need 6-10 pin headlines'
for h in hl:
    assert not re.match(r'^(top\s+)?\d', h.strip(), re.I), ('headline must lead with the keyword, not a number', h)
    assert len(h.split()) <= 10, ('headline too long', h)
    n = re.findall(r'\b(\d+)\b', h)
    assert not n or int(n[0]) in (len(picks), 2026, 2027), ('number in headline must match pick count', h)
assert 'hypoallergenic' not in json.dumps(s).lower()
today = datetime.date.today().isoformat()
a = {'topic_slug': slug, 'topic_title': s['topic_title'], 'niche': 'home decor', 'keyword': s['keyword'],
     'item_noun': s['item_noun'], 'intro': '', 'picks': [{'rank': x['rank'], 'breed': x['breed'].strip(), 'image_query': x['image_query'].strip()} for x in picks],
     'pin_headlines': hl, 'faqs': [], 'created_at': today, 'updated_at': today}
json.dump(a, open(p, 'w'), indent=2, ensure_ascii=False)
print('created', p, len(picks), 'picks')
