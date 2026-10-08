"""summary.py <runs dir> [out.json]: per arm (file prefix before -N.json) and pose, WC / GL / WC+GL median [min-max].

WC = native.medianBytes (median of the pose's three settled kernel footprint samples); GL = glBytes (the light tracker
total) or, for receipts taken before the fix, the census GL. Failed attempts (failure set or not closed) are counted, not
used. Decimal MB.
"""
import glob, gzip, json, os, re, statistics, sys

runs = sys.argv[1]
arms = {}
for path in sorted(glob.glob(os.path.join(runs, '*.json')) + glob.glob(os.path.join(runs, '*.json.gz'))):
    name = os.path.basename(path).removesuffix('.gz')[:-5]
    m = re.fullmatch(r'(.+)-(\d+)(?:\.failed-\d+)?', name)
    if not m:
        continue
    arm = arms.setdefault(m.group(1), {'attempts': 0, 'valid': 0, 'failures': [], 'poses': {}, 'builds': set()})
    r = json.load(gzip.open(path) if path.endswith('.gz') else open(path))
    arm['attempts'] += 1
    if r.get('failure') or not r.get('closed'):
        arm['failures'].append({'file': os.path.basename(path), 'failure': r.get('failure'), 'stage': r.get('stage')})
        continue
    arm['valid'] += 1
    arm['builds'].add(r['version']['build'])
    for s in r['snapshots']:
        gl = s.get('glBytes')
        if gl is None and 'census' in s:
            gl = sum(c['totalBytes'] for c in s['census']['gl'])
        wc = s['native']['medianBytes']
        arm['poses'].setdefault(s['label'], []).append({
            'run': m.group(2), 'wcMB': wc / 1e6, 'glMB': gl / 1e6, 'combinedMB': (wc + gl) / 1e6,
            'highCombinedMB': (s['native']['maxBytes'] + gl) / 1e6,
            'censusAtThisPose': bool(s.get('censusAfterReading')) or 'census' in s})


def stat(xs):
    return {'median': round(statistics.median(xs), 1), 'min': round(min(xs), 1), 'max': round(max(xs), 1)}


out = {}
for name, arm in arms.items():
    print(f"{name}: attempts {arm['attempts']} valid {arm['valid']} failed {len(arm['failures'])} builds {sorted(arm['builds'])}")
    for f in arm['failures']:
        print(f"   failed {f['file']}: {f['stage']} {str(f['failure'])[:120]}")
    poses = {}
    for label, rows in arm['poses'].items():
        p = {k: stat([r[k] for r in rows]) for k in ('wcMB', 'glMB', 'combinedMB', 'highCombinedMB')} | {'runs': rows}
        poses[label] = p
        print(f"   {label:26} WC {p['wcMB']['median']:7.1f} [{p['wcMB']['min']:.1f}-{p['wcMB']['max']:.1f}]  GL {p['glMB']['median']:6.1f}  "
              f"WC+GL {p['combinedMB']['median']:7.1f} [{p['combinedMB']['min']:.1f}-{p['combinedMB']['max']:.1f}]  n={len(rows)}")
    out[name] = {'attempts': arm['attempts'], 'valid': arm['valid'], 'failures': arm['failures'], 'builds': sorted(arm['builds']), 'poses': poses}
if len(sys.argv) > 2:
    with open(sys.argv[2], 'w') as handle:
        json.dump(out, handle, indent=1)
        handle.write('\n')
