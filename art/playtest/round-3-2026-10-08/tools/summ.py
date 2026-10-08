import json, sys
prev = None
for line in open(sys.argv[1]):
    w, _, rest = line.strip().partition(' ')
    try:
        v = json.loads(rest)
    except Exception:
        if prev != 'TO':
            print(w, rest[:40]); prev = 'TO'
        continue
    L = v.get('load') or {}
    key = (L.get('step'), L.get('shown'), v.get('world'))
    if key != prev:
        print(w, v.get('t'), v.get('q'), json.dumps({k: L.get(k) for k in ('shown', 'step', 'dl', 'setup', 'line')}), v.get('world'), v.get('err'))
        prev = key
