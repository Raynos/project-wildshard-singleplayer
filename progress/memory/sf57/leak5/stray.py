#!/usr/bin/env python3
"""SF57 leak5: the distinct stray owner-read stacks a drive.mjs result kept (pipe into symstack.mjs to symbolize).

  python3 stray.py <result.json> > s.txt; node symstack.mjs <dist dir> s.txt
"""
import json, sys

r = json.load(open(sys.argv[1]))
seen = set()
for s in r['samples'] + r['heap']:
    for st in (s.get('owners') or {}).get('stacks', []):
        k = ' | '.join(l.strip() for l in st.split('\n')[1:9])
        if k not in seen:
            seen.add(k); print(k)
