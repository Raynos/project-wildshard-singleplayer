# rt3-crossing2: which shader programs each crossing compiles during its entered warm-up (afterPlay) and which on the
# frames right after gameplay ready (a synchronous link each), split by the region-look key (`|look:<id>`).
#   python3 programs.py <result.json from crossings2.mjs>
import json, sys
r = json.load(open(sys.argv[1]))
for leg in r['legs']:
    rows = [x for x in leg['rows'] if 'err' not in x]; to = leg['to']
    tgr = next((x['t'] for x in rows if x['cur'] == to and x['inside'] == to and x['gr']), None)
    if tgr is None: print(leg['name'], 'never ready'); continue
    warm = [p for p in leg['progs'] if p.get('hook') and 'afterPlay' in p['hook']]
    post = [p for p in leg['progs'] if p['t'] >= tgr - 200 and p.get('gr')]
    look = lambda ps: sum(1 for p in ps if '|look:' in p['key'])
    print(f"{leg['name']}: warm-up {len(warm)} programs ({look(warm)} region-look) | after ready {len(post)} ({look(post)} region-look)")
