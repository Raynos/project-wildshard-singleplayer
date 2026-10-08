# Usage: python3 sig.py <snapshot> <out.json> — ArrayBuffer bytes by retainer signature (WeakMap ephemerons skipped, @ids stripped)
import sys, collections, re, json
exec(open('snapshot_lib.py').read().split('# region roots')[0])
parent = [-1] * count; pedge = [None] * count
seen = bytearray(count); seen[0] = 1
q = collections.deque([0])
while q:
    i = q.popleft()
    for t, label, to in out(i):
        if t == 'weak' or seen[to] or 'pair in WeakMap' in label: continue
        seen[to] = 1; parent[to] = i; pedge[to] = (t, label); q.append(to)
strip = lambda s: re.sub(r'@\d+', '', s)
sig = collections.Counter(); n = collections.Counter(); sample = {}
for i in range(count):
    if name(i) != 'system / JSArrayBufferData': continue
    path = []; j = i
    while j > 0:
        e = pedge[j]
        lab = e[1] if e and e[0] != 'element' else '#'
        path.append(strip(f"{name(j)[:30]}.{lab[:30]}")); j = parent[j]
    path.reverse()
    # cut at the first hop that names a class-ish property after the root chain: 16 hops
    k = ' > '.join(path[3:17])
    sig[k] += nodes[i*N+iS]; n[k] += 1; sample.setdefault(k, ' > '.join(path))
json.dump({k: [sig[k], n[k], sample[k]] for k in sig}, open(sys.argv[2], 'w'))
