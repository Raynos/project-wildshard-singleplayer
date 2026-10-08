# Usage: python3 props.py <snapshot> <id> [<id> …] — every outgoing edge of the nodes with these snapshot ids
import sys
exec(open('snapshot_lib.py').read().split('# region roots')[0])
want = set(int(x) for x in sys.argv[2:])
byid = {}
for i in range(count):
    if nodes[i*N+iId] in want: byid[nodes[i*N+iId]] = i
for w in sys.argv[2:]:
    i = byid.get(int(w))
    if i is None: print(w, 'missing'); continue
    print(f'== @{w} {ntype(i)} {name(i)[:80]!r}')
    for t, label, to in out(i):
        if t in ('hidden',) : continue
        print(f'   {t:9s} {label[:40]:40s} -> @{nodes[to*N+iId]} {ntype(to)} {name(to)[:80]!r}')
print(meta.get('location_fields'))
