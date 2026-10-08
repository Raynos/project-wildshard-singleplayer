# Usage: python3 live.py <snapshot> <out.json> — the UploadOwnership live set (via __perfHud > game.uploads.live): each entry's id, class, name, props
import sys, json
exec(open('snapshot_lib.py').read().split('# region roots')[0])
def prop(i, key):
    for t, label, to in out(i):
        if label == key and t in ('property', 'internal'): return to
    return None
# find UploadOwnership: object with properties live, level, assets, drawOwner
uo = None
for i in range(count):
    if ntype(i) != 'object': continue
    labels = set(label for t, label, to in out(i) if t == 'property')
    if {'live', 'level', 'assets', 'drawOwner'} <= labels: uo = i; break
live = prop(uo, 'live'); tab = prop(live, 'table')
rows = []
for t, label, to in out(tab):
    if ntype(to) != 'object': continue
    props = {label: (ntype(x), name(x)[:60]) for tt, label, x in out(to) if tt == 'property'}
    rows.append({'id': nodes[to*N+iId], 'cls': name(to), 'self': nodes[to*N+iS], 'props': props})
json.dump(rows, open(sys.argv[2], 'w'))
print(len(rows))
