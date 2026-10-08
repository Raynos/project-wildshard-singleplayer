# Usage: python3 scopes.py <snapshot> [scope-name-substring]  — every live Scope: name, #cleanups, #children; with a
# substring, the cleanup closures of matching scopes (function name + context vars).
import sys, collections
exec(open('snapshot_lib.py').read().split('# region roots')[0])
def prop(i, key):
    for t, label, to in out(i):
        if label == key and t in ('property', 'internal'): return to
    return None
def set_size(i):
    if i is None: return -1, []
    tab = prop(i, 'table')
    if tab is None: return -1, []
    els = [to for t, label, to in out(tab) if t in ('element', 'internal', 'hidden') and ntype(to) not in ('number', 'hidden', 'array') or (t == 'element')]
    return len(els), els
def has_scope_shape(i):
    labels = set(label for t, label, to in out(i) if t == 'property')
    return 'cleanups' in labels and 'children' in labels and 'owned' in labels
rows = []
for i in range(count):
    if ntype(i) == 'object' and has_scope_shape(i):
        nm = prop(i, 'name'); n = name(nm) if nm is not None else '?'
        c, els = set_size(prop(i, 'cleanups')); ch, _ = set_size(prop(i, 'children'))
        rows.append((n, c, ch, i, els))
agg = collections.defaultdict(lambda: [0, 0, 0])
for n, c, ch, i, els in rows:
    a = agg[n]; a[0] += 1; a[1] += c; a[2] += ch
print('scope objects', len(rows))
for n, (k, c, ch) in sorted(agg.items(), key=lambda kv: -kv[1][1])[:40]:
    print(f'{k:5d}x cleanups {c:6d} children {ch:5d}  {n}')
if len(sys.argv) > 2:
    want = sys.argv[2]
    for n, c, ch, i, els in rows:
        if want != n: continue
        print('\n==', n, c)
        kinds = collections.Counter()
        for e in els:
            if ntype(e) != 'object': continue
            run = prop(e, 'run'); kind = prop(e, 'kind')
            fname = name(run) if run is not None else '?'
            ctx = prop(run, 'context') if run is not None else None
            vars_ = [label for t, label, to in out(ctx)][:8] if ctx is not None else []
            kinds[(name(kind) if kind is not None else '?', fname, ' '.join(vars_))] += 1
        for k, v in kinds.most_common(60): print(f'  {v:5d} {k}')
