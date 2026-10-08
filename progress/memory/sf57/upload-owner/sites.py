#!/usr/bin/env python3
"""SF57 upload-owner: summarize the live set's unowned uploads at each heap pose of a drive.mjs result.json.

  python3 sites.py <result.json> [cycleA cycleB]

Prints, per heap pose, the GL counts, the orphan census and the scope rows; then the unowned uploads grouped by
type | name | the first useful frames of their upload site (a DIAG build records `site`), with the growth from cycleA to
cycleB (default: the last two poses).
"""
import json, re, sys
from collections import Counter

r = json.load(open(sys.argv[1]))
heap = r['heap']
for h in heap:
    g = h.get('gpu', {})
    print(f"c{h['cycle']}: heap {h['usedMB']:.1f} MB  gl {g.get('memory')}  live {g.get('live')}  unowned {len(g.get('unowned', []))}"
          f"  orphans {g.get('orphans')}  stray {(h.get('owners') or {}).get('strayReads')}")
    for name, row in sorted((g.get('scopes') or {}).items()):
        print(f"    {name}: {row}")

def frames(site):
    if not site:
        return '-'
    parts = [p.strip() for p in site.split('|')]
    head = parts[0].split(' ')[0]
    keep = []
    for p in parts:
        m = re.search(r'at (?:new )?([\w$.<>]+)', p)
        name = m.group(1) if m else p[:40]
        if re.search(r'UploadOwnership|properties\.get|renderer\.properties|setProgram|getProgram|initTexture|uploadTexture|setTexture2D|WebGLRenderer|renderBufferDirect|refreshUniforms|^Object\.|bound ', name + ' ' + p):
            continue
        keep.append(name)
        if len(keep) >= 3:
            break
    return head + ' ' + ' < '.join(keep)

def groups(h):
    c = Counter()
    for u in h.get('gpu', {}).get('unowned', []):
        c[f"{u['type']} | {u.get('name') or ''} | {u.get('owner')} | {frames(u.get('site'))}"] += 1
    return c

a, b = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (heap[-2]['cycle'], heap[-1]['cycle'])
ga = groups(next(h for h in heap if h['cycle'] == a)); gb = groups(next(h for h in heap if h['cycle'] == b))
print(f"\nunowned growth c{a} -> c{b}:")
for k in sorted(set(ga) | set(gb), key=lambda k: -(gb[k] - ga[k])):
    if gb[k] != ga[k]:
        print(f"  {gb[k] - ga[k]:+4d}  ({gb[k]:4d})  {k}")
print(f"\nunowned at c{b}, top:")
for k, n in gb.most_common(25):
    print(f"  {n:4d}  {k}")
