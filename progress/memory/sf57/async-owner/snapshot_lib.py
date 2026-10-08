import json, sys, collections
snap = json.load(open(sys.argv[1]))
meta = snap['snapshot']['meta']
nf = meta['node_fields']; ef = meta['edge_fields']
ntypes = meta['node_types'][0]; etypes = meta['edge_types'][0]
N = len(nf); E = len(ef)
nodes = snap['nodes']; edges = snap['edges']; strings = snap['strings']
iT, iN, iId, iS, iEC = nf.index('type'), nf.index('name'), nf.index('id'), nf.index('self_size'), nf.index('edge_count')
eT, eN, eTo = ef.index('type'), ef.index('name_or_index'), ef.index('to_node')
count = len(nodes) // N
first = [0] * (count + 1)
for i in range(count):
    first[i + 1] = first[i] + nodes[i * N + iEC]
def name(i): return strings[nodes[i * N + iN]]
def ntype(i): return ntypes[nodes[i * N + iT]]
def out(i):
    for e in range(first[i], first[i + 1]):
        b = e * E
        t = etypes[edges[b + eT]]
        nm = edges[b + eN]
        label = strings[nm] if t in ('context', 'property', 'internal', 'shortcut') else str(nm)
        yield t, label, edges[b + eTo] // N
# region roots: objects with a `name` property whose string starts with region:
targets = []
for i in range(count):
    if ntype(i) != 'object': continue
    for t, label, to in out(i):
        if t == 'property' and label == 'name' and ntype(to) in ('string', 'concatenated string', 'sliced string') and name(to).startswith('region:'):
            targets.append((i, name(to)))
print('region roots:', collections.Counter(n for _, n in targets))
# BFS from the root (node 0), skipping weak edges, parents for shortest paths
parent = [-1] * count; pedge = [None] * count
seen = bytearray(count); seen[0] = 1
q = collections.deque([0])
while q:
    i = q.popleft()
    for t, label, to in out(i):
        if t == 'weak' or seen[to]: continue
        seen[to] = 1; parent[to] = i; pedge[to] = (t, label); q.append(to)
shown = set()
for i, rn in targets:
    if rn in shown or not seen[i]: continue
    shown.add(rn)
    path = []; j = i
    while j > 0 and len(path) < 60:
        path.append(f"{ntype(j)}:{name(j)[:50]} via {pedge[j]}")
        j = parent[j]
    print('\n== retained', rn)
    for p in reversed(path): print('  ', p)
