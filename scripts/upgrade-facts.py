#!/usr/bin/env python3
"""Prints a guide's picks with the facts to ground the rewrite in.
Dog guides: one line of content/breeds.json data per breed. Other guides: the item and its shop query.
    python3 scripts/upgrade-facts.py <slug> [<slug> ...]"""
import json, sys
B = {b['name'].lower(): b for b in json.load(open('content/breeds.json'))}
for slug in sys.argv[1:]:
    a = json.load(open(f'content/articles/{slug}.json')); dogs = (a.get('niche') or 'dogs') == 'dogs'
    print(f"== {slug} | {a['topic_title']} | niche {a.get('niche') or 'dogs'}")
    for p in sorted(a['picks'], key=lambda p: p['rank']):
        b = B.get(p['breed'].lower()) if dogs else None
        if b:
            print(f"#{p['rank']} {p['breed']}: {b['size']}, energy {b['energy']}, shed {b['shedding']}, groom {b['grooming']}, train {b['trainability']}, "
                  f"bark {b['barking']}, {b['lifespan_min']}-{b['lifespan_max']}y, kids {b['good_with_kids']}, cats {b['good_with_cats']}, dogs {b['good_with_other_dogs']}, "
                  f"{'/'.join(b['temperament'])}, coat {'/'.join(b['coat'])}")
        else:
            print(f"#{p['rank']} {p['breed']} | shop query: {p.get('shop_query','')} | current: {p['description'][:160]}")
