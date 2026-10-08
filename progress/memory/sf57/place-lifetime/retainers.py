import json, sys, collections
exec(open('snapshot_lib.py').read().split('# region roots')[0])
# BFS parents (no weak edges)
parent = [-1] * count; pedge = [None] * count
seen = bytearray(count); seen[0] = 1
q = collections.deque([0])
while q:
    i = q.popleft()
    for t, label, to in out(i):
        if t == 'weak' or seen[to]: continue
        seen[to] = 1; parent[to] = i; pedge[to] = (t, label); q.append(to)
bufs = [i for i in range(count) if name(i) == 'system / JSArrayBufferData']
bufs.sort(key=lambda i: -nodes[i*N+iS])
total = sum(nodes[i*N+iS] for i in bufs)
print('buffers', len(bufs), 'MB', round(total/1e6,1))
# group by the path signature (first 12 hops from root, labels only)
sig = collections.Counter(); sigsize = collections.Counter(); sample = {}
for i in bufs:
    path = []; j = i
    while j > 0:
        path.append(f"{name(j)[:40]}.{pedge[j][1][:30]}" if pedge[j] else name(j)[:40]); j = parent[j]
    path.reverse()
    k = ' > '.join(path[:14])
    sig[k] += 1; sigsize[k] += nodes[i*N+iS]; sample.setdefault(k, ' > '.join(path))
for k, v in sigsize.most_common(12):
    print(f"\n{round(v/1e6,1)} MB in {sig[k]} buffers:\n  {sample[k][:1800]}")
