#!/usr/bin/env python3
"""SF57 leak5: self size and count by (type, name) for two heap snapshots, and the biggest growth between them.

  python3 classdiff.py <a.heapsnapshot> <b.heapsnapshot> [top]
"""
import collections, json, sys

def census(path):
    snap = json.load(open(path))
    meta = snap['snapshot']['meta']; nf = meta['node_fields']; ntypes = meta['node_types'][0]
    N = len(nf); iT, iN, iS = nf.index('type'), nf.index('name'), nf.index('self_size')
    nodes, strings = snap['nodes'], snap['strings']
    size = collections.Counter(); n = collections.Counter()
    for k in range(0, len(nodes), N):
        t = ntypes[nodes[k + iT]]
        nm = strings[nodes[k + iN]] if t not in ('string', 'number', 'concatenated string', 'sliced string') else ''
        key = f'{t}:{nm[:60]}'
        size[key] += nodes[k + iS]; n[key] += 1
    return size, n

top = int(sys.argv[3]) if len(sys.argv) > 3 else 30
sa, na = census(sys.argv[1]); sb, nb = census(sys.argv[2])
print(f'total self size: {sum(sa.values()) / 1e6:.1f} MB -> {sum(sb.values()) / 1e6:.1f} MB')
for k in sorted(set(sa) | set(sb), key=lambda k: -(sb[k] - sa[k]))[:top]:
    print(f'{(sb[k] - sa[k]) / 1e3:+10.1f} KB  {nb[k] - na[k]:+7d}  {k}')
