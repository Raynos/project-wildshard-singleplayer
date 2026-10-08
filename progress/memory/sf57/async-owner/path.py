# Usage: python3 path.py <snapshot> <substring> — shortest root path (with node ids) to the first ArrayBuffer whose path
# contains <substring>, plus the WeakMap entry key when the path crosses one
import sys, collections
exec(open('snapshot_lib.py').read().split('# region roots')[0])
parent = [-1] * count; pedge = [None] * count
seen = bytearray(count); seen[0] = 1
q = collections.deque([0])
while q:
    i = q.popleft()
    for t, label, to in out(i):
        if t == 'weak' or seen[to] or 'pair in WeakMap' in label: continue
        seen[to] = 1; parent[to] = i; pedge[to] = (t, label); q.append(to)
want = sys.argv[2]
for i in range(count):
    if name(i) != 'system / JSArrayBufferData': continue
    path = []; j = i
    while j > 0:
        path.append(j); j = parent[j]
    path.reverse()
    s = ' > '.join(f"{name(j)[:30]}.{pedge[j][1][:30]}" for j in path)
    if want in s:
        for j in path: print(f'  @{nodes[j*N+iId]} {ntype(j)} {name(j)[:70]!r} via {pedge[j]}')
        break
