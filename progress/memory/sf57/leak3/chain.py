# Usage: python3 chain.py <snapshot> <substring> [nth] — shortest path to the nth ArrayBuffer whose path has <substring>,
# naming Scope-shaped nodes (their `name`) and closures (with source line:col from the snapshot's locations)
import sys, collections
exec(open('snapshot_lib.py').read().split('# region roots')[0])
locs = {}
L = snap.get('locations') or []
lf = meta.get('location_fields') or ['object_index', 'script_id', 'line', 'column']
for k in range(0, len(L), len(lf)): locs[L[k] // N] = (L[k + 1], L[k + 2], L[k + 3])
parent = [-1] * count; pedge = [None] * count
seen = bytearray(count); seen[0] = 1
q = collections.deque([0])
while q:
    i = q.popleft()
    for t, label, to in out(i):
        if t == 'weak' or seen[to] or 'pair in WeakMap' in label: continue
        seen[to] = 1; parent[to] = i; pedge[to] = (t, label); q.append(to)
def prop(i, key):
    for t, label, to in out(i):
        if label == key and t in ('property', 'internal'): return to
    return None
def scope_name(i):
    labels = set(label for t, label, to in out(i) if t == 'property')
    if {'cleanups', 'children', 'owned'} <= labels:
        nm = prop(i, 'name'); return name(nm) if nm is not None else '?'
    return None
want = sys.argv[2]; nth = int(sys.argv[3]) if len(sys.argv) > 3 else 0
for i in range(count):
    if name(i) != 'system / JSArrayBufferData' or not seen[i]: continue
    path = []; j = i
    while j > 0: path.append(j); j = parent[j]
    path.reverse()
    s = ' > '.join(f"{name(j)[:30]}.{pedge[j][1][:30]}" for j in path)
    if want not in s: continue
    if nth > 0: nth -= 1; continue
    for j in path:
        extra = ''
        sn = scope_name(j) if ntype(j) == 'object' else None
        if sn: extra = f'  [Scope {sn}]'
        if ntype(j) == 'closure' and j in locs: extra = f'  [fn @script{locs[j][0]}:{locs[j][1]+1}:{locs[j][2]+1}]'
        print(f'  @{nodes[j*N+iId]} {ntype(j)} {name(j)[:60]!r} via {pedge[j]}{extra}')
    break
