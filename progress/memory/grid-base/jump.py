import sys, json, gzip
# jump.py <native.jsonl[.gz]> <pid?>: WebContent footprint per phase: the settled reading (6-9 s in, before the census)
# vs the phase's last sample (after the census + vmmap), for the game's WebContent pid (the largest).
for f in sys.argv[1:]:
    op = gzip.open if f.endswith('.gz') else open
    rows = [json.loads(l) for l in op(f, 'rt') if '"sample"' in l]
    pid = max(rows[-1]['pids'], key=lambda k: rows[-1]['pids'][k][0])
    phases = {}
    for r in rows:
        if pid in r['pids']: phases.setdefault(r['phase'], []).append((r['elapsed'], r['pids'][pid][0] / 1e6))
    out = []
    for ph, xs in phases.items():
        if ph in ('loading',) or ph.startswith('route'): continue
        t0 = xs[0][0]; pre = [v for t, v in xs if 6 <= t - t0 <= 9]
        out.append(f"{ph}: pre {min(pre) if pre else 0:.0f} -> end {xs[-1][1]:.0f}")
    print(f.split('/')[-1], ' | '.join(out))
