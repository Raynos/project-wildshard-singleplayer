"""report-input.py <runs dir> <out input.json>: the SF64 report manifest (memory-report-input/1) on the fixed ruler.

Each pose takes the valid cold run whose WC + GL is the median of its arm (so the report shows a real run, not a blend);
the input records every run's numbers in settings.provenance. Paths are written relative to the manifest.
Run the report: node scripts/memory-report.mjs --input=<out input.json> --out=<new dir>
"""
import glob, gzip, json, os, re, statistics, sys

runs, out = sys.argv[1], sys.argv[2]
POSES = [  # (report pose name, arm, native label)
    ('road', 'nalati', 'neutral-road'),
    ('pine-hollow-centre', 'pine-final', 'pine-hollow-centre'),
    ('nalati-grasslands-centre', 'nalati', 'nalati-grasslands-centre'),
    ('far-reach-centre', 'sky', 'sky-island'),
    ('_template-centre', 'public', 'public-template-centre'),
]


def load(path):
    return json.load(gzip.open(path) if path.endswith('.gz') else open(path))


def valid_runs(arm):
    rows = []
    for path in sorted(glob.glob(os.path.join(runs, arm + '-*.json*'))):
        if not re.fullmatch(re.escape(arm) + r'-\d+\.json(\.gz)?', os.path.basename(path)):
            continue
        report = load(path)
        if report.get('failure') or not report.get('closed'):
            continue
        rows.append((path, report))
    return rows


poses, provenance, builds = [], [], set()
for name, arm, label in POSES:
    candidates = []
    for path, report in valid_runs(arm):
        snap = next((s for s in report['snapshots'] if s['label'] == label), None)
        if snap is None:
            continue
        builds.add(report['version']['build'])
        candidates.append(((snap['native']['medianBytes'] + snap['glBytes']) / 1e6, path))
    if not candidates:
        poses.append({'name': name, 'unavailable': f'no valid fixed-ruler cold run of {arm} reached {label} yet'})
        continue
    candidates.sort()
    total, path = candidates[(len(candidates) - 1) // 2]
    provenance.append(f"{name}: runs {', '.join(f'{t:.1f}' for t, _ in candidates)} MB WC+GL, median run {os.path.basename(path)}")
    poses.append({'name': name, 'native': {'file': os.path.relpath(path, os.path.dirname(os.path.abspath(out))), 'label': label}})

manifest = {
    'schema': 'memory-report-input/1',
    'pin': ', '.join(sorted(builds)) or 'none',
    'device': 'iPhone 17 Pro Simulator (wildshard-iphone), Safari, captured as the phone tier',
    'settings': {'tier': 'phone', 'renderScale': 2, 'textures': 'Auto', 'developer': True, 'memorySaver': True, 'muted': True,
                 'coldRuns': 3, 'provenance': 'Fixed ruler (native.mjs --census=final): no in-page census before any reading. '
                 'The template centre is the public grid (Developer off, Memory saver off). ' + '; '.join(provenance)},
    'centres': ['driftwood-isle', 'pine-hollow', 'nalati-grasslands', '_template', 'sunscar-dunes', 'far-reach', 'nine-dragon-stack'],
    'poses': [{'name': 'nine-dragon-stack-centre', 'unavailable': 'Nine Dragon is not in the grid catalogue; no grid centre capture exists'}] + poses,
}
with open(out, 'w') as handle:
    json.dump(manifest, handle, indent=1)
    handle.write('\n')
print('\n'.join(provenance))
