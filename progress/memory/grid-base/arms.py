import json, sys, statistics, glob
# arms.py <dir>...: native WC median per pose per cold run, GL at the census pose, combined at Pine centre
for d in sys.argv[1:]:
    rows = {}
    for f in sorted(glob.glob(d + '/cold-0*.json')):
        r = json.load(open(f))
        for s in r['snapshots']:
            gl = sum(c['totalBytes'] for c in s['census']['gl']) / 1e6 if 'census' in s else None
            rows.setdefault(s['label'], []).append((s['native']['medianBytes'] / 1e6, gl))
    print(d.split('/')[-1], r['version']['build'])
    for label, xs in rows.items():
        wc = [x[0] for x in xs]
        print(f"  {label:20} WC median {statistics.median(wc):7.1f} [{min(wc):.1f}-{max(wc):.1f}] runs {', '.join(f'{v:.1f}' for v in wc)}" + (f"  GL {xs[0][1]:.1f}" if xs[0][1] else ''))
