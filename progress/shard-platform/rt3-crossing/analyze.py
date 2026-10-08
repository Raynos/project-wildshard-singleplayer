import json, sys
r = json.load(open(sys.argv[1]))
print('version', r.get('version'), 'cpu', r.get('cpu'), 'errors', len(r['errors']), 'failure', (r.get('failure') or '')[:200])
cl = r.get('coldLoad')
if cl:
    print('cold grid load %.1fs' % cl['seconds'])
    last=None; since=0
    for l in cl['lines']:
        if l['text'] != last:
            if last is not None: print('   %5.1fs  %s' % (l['s']-since, last[:110]))
            last=l['text']; since=l['s']
for leg in r['legs']:
    rows = [x for x in leg['rows'] if 'err' not in x]
    o = leg['origin']; to = leg['to']
    def first(pred):
        for x in rows:
            if pred(x): return x['t']
        return None
    dist = lambda x: max(abs(x['feet']['x']-o['x']), abs(x['feet']['z']-o['z'])) - 250 if x.get('feet') else 1e9
    tn = first(lambda x: dist(x) <= 8)
    tres = first(lambda x: to in x['res'])
    tcom = first(lambda x: x['cur'] == to)
    tin = first(lambda x: x['inside'] == to)
    tgr = first(lambda x: x['cur'] == to and x['inside'] == to and x['gr'])
    scr = sum(1 for x in rows if x['inside'] == to and x['screens'] and to in x['screens'])
    f = lambda a, b: ('%.1f' % ((b - a)/1000)) if a is not None and b is not None else '-'
    lo = (tn or leg['start']) - 2000; hi = (tgr or rows[-1]['t']) + 1000
    gaps = [g for g in leg['gaps'] if lo <= g['t'] <= hi]; tasks = [g for g in leg['tasks'] if lo <= g['t'] <= hi]
    mg = max(gaps, key=lambda g: g['ms'], default=None); mt = max(tasks, key=lambda g: g['ms'], default=None)
    print(f"\n{leg['name']}  fail={leg['failure']}")
    print(f"  wait(near->gameplay) {f(tn,tgr)}s | near->world resident {f(tn,tres)} | resident->commit {f(tres,tcom)} | commit->inside {f(tcom,tin)} | inside->gameplay {f(tin,tgr)} | screen-rows-inside {scr}")
    print(f"  longest frame gap {mg['ms']:.0f}ms @{mg['hook']}" if mg else '  no gaps', f"| longest task {mt['ms']:.0f}ms @{mt['hook']}" if mt else '', f"| gaps>100ms {len(gaps)} sum {sum(g['ms'] for g in gaps)/1000:.1f}s")
    big = sorted(gaps, key=lambda g: -g['ms'])[:6]
    print('  top gaps:', ', '.join(f"{g['ms']:.0f}@{(g['t']-(tn or 0))/1000:+.1f}s:{g['hook']}" for g in big))
    hooks = {}
    for h in leg['completed']:
        if h['instance'] == to: hooks[h['hook']] = hooks.get(h['hook'], 0) + h['end'] - h['start']
    print('  hooks ms:', ' '.join(f"{k}={v:.0f}" for k, v in hooks.items()))
