#!/usr/bin/env python3
"""SF57 leak5: who keeps each live unowned upload alive.

  python3 retainers.py <heap.heapsnapshot> [hops]

Finds the renderer's UploadOwnership in the snapshot, takes the targets of its orphan WeakRefs (the live unowned
uploads) and prints the shortest strong path from the GC root to it (weak edges and WeakMap
entries skipped), grouped by the path's last useful hops, with closures named by their source location.
"""
import collections, json, sys

snap = json.load(open(sys.argv[1]))
cap = int(sys.argv[2]) if len(sys.argv) > 2 else 12
meta = snap['snapshot']['meta']
nf, ef = meta['node_fields'], meta['edge_fields']
ntypes, etypes = meta['node_types'][0], meta['edge_types'][0]
N, E = len(nf), len(ef)
nodes, edges, strings = snap['nodes'], snap['edges'], snap['strings']
iT, iN, iEC = nf.index('type'), nf.index('name'), nf.index('edge_count')
eT, eN, eTo = ef.index('type'), ef.index('name_or_index'), ef.index('to_node')
count = len(nodes) // N
first = [0] * (count + 1)
for i in range(count): first[i + 1] = first[i] + nodes[i * N + iEC]
def name(i): return strings[nodes[i * N + iN]]
def ntype(i): return ntypes[nodes[i * N + iT]]
def out(i):
    for e in range(first[i], first[i + 1]):
        b = e * E; t = etypes[edges[b + eT]]; nm = edges[b + eN]
        yield t, (strings[nm] if t in ('context', 'property', 'internal', 'shortcut') else str(nm)), edges[b + eTo] // N
locs = {}
L = snap.get('locations') or []
lf = meta.get('location_fields') or ['object_index', 'script_id', 'line', 'column']
iO, iSO, iL, iC = lf.index('object_index'), (lf.index('script_object_index') if 'script_object_index' in lf else None), lf.index('line'), lf.index('column')
url_cache = {}
def script_url(k):
    if iSO is None: return '?'
    so = L[k + iSO] // N if L[k + iSO] >= 0 else -1
    if so < 0: return '?'
    if so in url_cache: return url_cache[so]
    url_cache[so] = name(so)
    for t, label, to in out(so):
        if label == 'name' and ntype(to).endswith('string'): url_cache[so] = name(to); break
    return url_cache[so]
for k in range(0, len(L), len(lf)): locs[L[k + iO] // N] = f"{script_url(k)}:{L[k + iL] + 1}:{L[k + iC] + 1}"


# the renderer's UploadOwnership: an object with `owned`, `orphans` and `orphanRefs`; its orphans Set holds WeakRefs whose
# targets are the live unowned uploads (a WeakRef's target edge is weak)
def prop(i, key):
    for t, label, to in out(i):
        if label == key and t in ('property', 'internal'): return to
    return None
owners = [i for i in range(count) if ntype(i) == 'object' and prop(i, 'orphans') is not None and prop(i, 'orphanRefs') is not None and prop(i, 'hints') is not None]
print(f'UploadOwnership objects: {len(owners)}')
found = {}
def weakrefs(i, depth=0):
    if depth > 4: return
    for t, label, to in out(i):
        if name(to) == 'WeakRef':
            for t2, l2, tgt in out(to):
                if t2 == 'weak': found[tgt] = tgt
        elif t in ('internal', 'element', 'property', 'hidden') and ntype(to) in ('array', 'object', 'hidden') and depth < 4: weakrefs(to, depth + 1)
for o in owners: weakrefs(prop(o, 'orphans'))
def label_of(i):
    nm = prop(i, 'name'); ty = name(i)
    return f"{ty} {name(nm) if nm is not None and ntype(nm).endswith('string') else ''}"
print(f'live orphans in the snapshot: {len(found)}')
parent = [-1] * count; pedge = [None] * count
seen = bytearray(count); seen[0] = 1
q = collections.deque([0])
while q:
    i = q.popleft()
    for t, label, to in out(i):
        if t == 'weak' or seen[to] or 'part of key' in label or 'pair in WeakMap' in label: continue
        seen[to] = 1; parent[to] = i; pedge[to] = (t, label); q.append(to)
def hop(j):
    t, label = pedge[j]; nm = name(j)
    if ntype(j) == 'closure': return f'{label}->fn {nm or "anon"}@{locs.get(j, "?")}'
    return f'{label}->{nm[:40]}'
groups = collections.Counter(); examples = {}
for uuid, i in found.items():
    u = {'type': label_of(i), 'name': ''}
    if not seen[i]: groups['(unreachable: weak only)'] += 1; continue
    path = []; j = i
    while j > 0: path.append(j); j = parent[j]
    path.reverse()
    hops = [hop(j) for j in path]
    key = ' | '.join(hops[-cap:])
    groups[key] += 1; examples.setdefault(key, u['type'])
for k, n in groups.most_common(40):
    print(f'\n{n:4d}  [{examples.get(k, "")}]\n      {k}')
