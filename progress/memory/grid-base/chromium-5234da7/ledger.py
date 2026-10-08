import json, sys, collections
# ledger.py grid.json standalone.json: post-GC SF64 ledger by owner, Pine centre in the grid vs standalone
g = json.load(open(sys.argv[1])); s = json.load(open(sys.argv[2]))
def pose(d, label): return next(p for p in d['poses'] if p['label'] == label)
def agg(p, dom):
    c = collections.Counter()
    for a in p['snap']['allocations']:
        if a['domain'] == dom: c[a['owner']] += a['bytes']
    return c
for p in g['poses'] + s['poses']:
    print(f"{p['label']:20} heapMB {p['usedMB']:7.1f} ledger ram {p['snap']['totals']['ram']/1e6:7.1f} gpu {p['snap']['totals']['gpu']/1e6:7.1f}")
gc, sc = pose(g, 'pine-centre'), pose(s, 'standalone-centre')
for dom in ('ram', 'gpu'):
    a, b = agg(gc, dom), agg(sc, dom)
    diff = collections.Counter({k: a[k] - b[k] for k in set(a) | set(b)})
    print(f'\n== {dom}: grid-only (grid minus standalone), top 20')
    for k, v in sorted(diff.items(), key=lambda kv: -kv[1])[:20]: print(f'  {v/1e6:7.2f}  {k}  (grid {a[k]/1e6:.2f} / standalone {b[k]/1e6:.2f})')
    print(f'== {dom}: standalone-only, top 8')
    for k, v in sorted(diff.items(), key=lambda kv: kv[1])[:8]: print(f'  {v/1e6:7.2f}  {k}')
