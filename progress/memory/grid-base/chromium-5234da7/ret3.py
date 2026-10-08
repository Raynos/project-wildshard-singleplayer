import json, sys, collections
exec(open(__file__.rsplit('/',1)[0]+'/snapshot_lib.py' if '/' in __file__ else 'snapshot_lib.py').read().split('# region roots')[0])
g = json.load(open(sys.argv[2])); p = next(x for x in g['poses'] if x['label'] == 'pine-centre')
want = {}
for a in p['snap']['allocations']:
    if a['domain'] == 'ram' and a['kind'] == 'array-buffer' and a['bytes'] > 300000 and ('driftwood' in a['owner'] or 'driftwood-isle' in a['asset']):
        want.setdefault(a['bytes'], []).append(a['owner'] + ' ' + a['asset'][:80])
print('want sizes', len(want))
parent = [-1] * count; pedge = [None] * count
seen = bytearray(count); seen[0] = 1
q = collections.deque([0])
while q:
    i = q.popleft()
    for t, label, to in out(i):
        if t == 'weak' or seen[to]: continue
        seen[to] = 1; parent[to] = i; pedge[to] = (t, label); q.append(to)
hits = [i for i in range(count) if nodes[i*N+iS] in want and 'ArrayBuffer' in name(i)]
print('hits', len(hits))
sig = collections.Counter(); ex = {}; size = collections.Counter()
for i in hits:
    path = []; j = i
    while j > 0 and len(path) < 80:
        path.append(f"{ntype(j)}:{name(j)[:50]} via {pedge[j]}"); j = parent[j]
    path.reverse()
    k = ' > '.join(x.split(' via ')[0] for x in path[8:16])
    sig[k] += 1; size[k] += nodes[i*N+iS]; ex.setdefault(k, (want[nodes[i*N+iS]], path))
for k, c in size.most_common(6):
    w, path = ex[k]
    print(f'\n== {c/1e6:.1f} MB in {sig[k]} buffers like {w[0]}')
    for x in path[:40]: print('   ', x)
