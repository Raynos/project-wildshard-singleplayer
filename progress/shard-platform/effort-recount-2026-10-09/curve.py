import json, datetime
SP = '/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/81cffee4-70d4-4229-8860-2e3743d9c0b8/scratchpad'
samples = {}
for name in ['history.json', 'history-late.json', 'history-tmpl.json']:
    for r in json.load(open(f'{SP}/{name}')):
        t = datetime.datetime.fromisoformat(r['t'].replace('Z', '+00:00')).timestamp()
        samples[t] = r
series = json.load(open(f'{SP}/series.json'))
out = {}
for slug in ['_template', 'sunscar-dunes', 'far-reach', 'pine-hollow', 'driftwood-isle', 'nalati-grasslands', 'nine-dragon-stack']:
    pts = []
    for t in sorted(samples):
        r = samples[t]['shards'].get(slug)
        if r is None: continue
        port = sum(h for (ct, h, k) in series.get(slug, []) if ct <= t and k == 'port')
        allh = sum(h for (ct, h, k) in series.get(slug, []) if ct <= t)
        m = r['m'] or {}
        proofs = sum(bool(m.get(k)) for k in ['boot', 'headless', 'replay', 'ledger', 'gridReady', 'compatible'])
        pts.append((t, round(port, 1), round(allh, 1), round(r['share'] * 100, 1), proofs, r['pub'], r['cus']))
    out[slug] = pts
    print('==', slug)
    last = None
    for p in pts:
        key = (p[1], p[3], p[4])
        if key != last: print('  ', datetime.datetime.utcfromtimestamp(p[0]).strftime('%m-%d %HZ'), 'port h', p[1], 'all h', p[2], 'share', p[3], 'proofs', p[4], 'pub/cus', p[5], p[6])
        last = key
json.dump(out, open(f'{SP}/curve.json', 'w'))
