"""Reproduce the incomplete diagnostic using exact archived bytes, never synthetic samples."""
import bisect
import collections
import datetime
import json
import lzma
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
RAW = ROOT / 'raw'


def text(name):
    plain = RAW / name
    return plain.read_text() if plain.exists() else lzma.decompress((RAW / (name + '.xz')).read_bytes()).decode()


def document(name):
    return json.loads(text(name))


def upper_median(values):
    ordered = sorted(values)
    if not ordered:
        raise ValueError('Missing actual samples')
    return ordered[len(ordered) // 2]


result = document('dev-cells.json')
native = [json.loads(line) for line in text('dev-cells-native.jsonl').splitlines()]
gl = [json.loads(line) for line in text('dev-cells-gl.jsonl').splitlines()]
times = [row['at'] for row in gl]
pid = str(result['gamePid'])
joined = []
for row in native:
    if row.get('type') != 'sample' or pid not in row['pids']:
        continue
    at = datetime.datetime.fromisoformat(row['t']).timestamp()
    index = bisect.bisect_left(times, at)
    candidates = gl[max(0, index - 1):index + 1]
    if not candidates:
        continue
    census = min(candidates, key=lambda value: abs(value['at'] - at))
    if abs(census['at'] - at) > 1.5:
        continue
    joined.append({'at': at, 'wc': row['pids'][pid][0], 'gl': census['totalBytes'],
                   'combined': row['pids'][pid][0] + census['totalBytes'], 'gpu': row['gpu'],
                   'accounted': census['accountedBytes'], 'phase': row['phase']})


def samples(rows):
    return {'samples': len(rows), **{key: upper_median([row[key] for row in rows])
                                    for key in ['wc', 'gl', 'combined', 'gpu', 'accounted']}}


windows = [{'cycle': window['cycle'], 'start': window['start'], 'end': window['end'],
            **samples([row for row in joined if window['start'] <= row['at'] <= window['end']])}
           for window in result['windows']]
# The final result flush failed, so window2 is NOT invented from phase timing or the boundary timestamp.
phase_tails = []
for phase in ['baseline-0', 'settle-1', 'settle-2']:
    rows = [row for row in joined if row['phase'] == phase]
    phase_tails.append({'phase': phase, 'method': 'Last10 actual joined observations; distinct from the recorded grader windows',
                        **samples(rows[-10:])})


def grouped(memory, domain):
    groups = collections.defaultdict(lambda: {'bytes': 0, 'allocations': 0})
    for allocation in memory['allocations']:
        if allocation['domain'] == domain:
            key = (allocation['owner'], allocation['kind'], allocation['asset'])
            groups[key]['bytes'] += allocation['bytes']
            groups[key]['allocations'] += 1
    return groups


boundaries = []
for cycle in [0, 1, 2]:
    boundary = document(f'boundary-{cycle}.json')
    footprint = text(f'boundary-{cycle}-footprint.txt')
    categories = []
    for match in re.finditer(r'^\s*(\d+) B\s+(\d+) B\s+(\d+) B\s+(\d+)\s+(.+?)\s*$', footprint, re.M):
        dirty, clean, reclaimable, regions, category = match.groups()
        categories.append({'category': category, 'dirty': int(dirty), 'clean': int(clean),
                           'reclaimable': int(reclaimable), 'regions': int(regions)})
    assert categories and categories[-1]['category'] == 'TOTAL'
    passive = boundary['categories']['samples']
    assert passive and boundary['pid'] == result['gamePid']
    before = boundary['before']
    boundaries.append({'cycle': cycle, 'startedAt': boundary['startedAt'], 'endedAt': boundary.get('endedAt'),
                       'nativeFootprintBytes': int(re.search(r'Footprint:\s+(\d+) B', footprint).group(1)),
                       'nativeCategories': categories, 'passiveSampleCount': len(passive),
                       'passiveLast': passive[-1], 'sf64Totals': before['memory']['totals'],
                       'sf64AllocationCount': len(before['memory']['allocations']),
                       'programCount': len(before['programs']), 'rendererMemory': before['rendererMemory'],
                       'accountedBytes': before['memory']['accountedBytes'], 'glBytes': before['gl']['totalBytes'],
                       'errors': boundary['errors'], 'heap': boundary['heap'],
                       'afterCaptured': 'after' in boundary})

one = document('boundary-1.json')['before']['memory']
two = document('boundary-2.json')['before']['memory']
asset_deltas = []
for domain in ['ram', 'gpu']:
    before, after = grouped(one, domain), grouped(two, domain)
    for key in before.keys() | after.keys():
        a, b = before.get(key, {'bytes': 0, 'allocations': 0}), after.get(key, {'bytes': 0, 'allocations': 0})
        if a != b:
            asset_deltas.append({'domain': domain, 'owner': key[0], 'kind': key[1], 'asset': key[2],
                                 'beforeBytes': a['bytes'], 'afterBytes': b['bytes'], 'deltaBytes': b['bytes'] - a['bytes'],
                                 'beforeAllocations': a['allocations'], 'afterAllocations': b['allocations']})
    assert sum(row['deltaBytes'] for row in asset_deltas if row['domain'] == domain) == two['totals'][domain] - one['totals'][domain]
asset_deltas.sort(key=lambda row: (-abs(row['deltaBytes']), row['asset'], row['domain'], row['owner'], row['kind']))
owner_deltas = collections.Counter()
for row in asset_deltas:
    owner_deltas[(row['domain'], row['owner'], row['kind'])] += row['deltaBytes']

route_cycles = collections.defaultdict(list)
for route in result['routes']:
    assert not route['failures']
    route_cycles[route['cycle']].append(route['plan']['name'])
assert route_cycles[0] == route_cycles[1] and len(route_cycles[0]) == len(result['route']['plans']) == 4
native_summary = next(row for row in native if row['type'] == 'summary')
assert all(row['phase'] == 'loading' for row in native_summary['lost'])
outcome = {'status': 'FAILED / incomplete four-circuit diagnostic; no heap was captured',
           'pin': result['sha'], 'device': result['device'], 'gamePid': result['gamePid'],
           'driverRevision': document('protocol.json')['driverRevision'], 'completedCircuitsFromRouteWitnesses': 2,
           'routeWitnesses': len(result['routes']), 'routeErrors': result['errors'],
           'staleMainResultCircuits': result['circuits'], 'recordedWindows': windows, 'observedPhaseTails': phase_tails,
           'boundaries': boundaries, 'sf64Delta1to2': {domain: two['totals'][domain] - one['totals'][domain] for domain in ['ram', 'gpu']},
           'sf64OwnerKindDeltas1to2': [{'domain': key[0], 'owner': key[1], 'kind': key[2], 'bytes': value}
                                      for key, value in sorted(owner_deltas.items(), key=lambda pair: (-abs(pair[1]), pair[0]))],
           'sf64AssetDeltas1to2': asset_deltas, 'nativeSummary': native_summary,
           'limitations': ['Only2of4circuits completed; raw main JSON predates the second circuit counter/window flush.',
                           'Snapshot failed with Inspector closed, then cleanup Runtime.evaluate timed out; no transport close reason was retained.',
                           'Fixed game WebContent PID remained sampled through inspection; no post-boot process disappearance in native evidence. This does not prove GPU-loss absence.',
                           'Native/heap inspection phases visibly increase WebContent; these observations do not isolate SF69 from the original uninspected e632 soak.',
                           'SF64 weak-owner and passive WebKit category readings precede any successful heap collection, so they cannot alone prove strong references.',
                           'Passive javascript includes WebKit/external payload estimates; it is not a successful live JS heap snapshot.',
                           'Categories, SF64 RAM, native footprint and GPU storage overlap; do not add them. GPU-process footprint is independent.',
                           'No duration/cap/performance clearance, plateau or per-circuit leak rate follows from this incomplete intrusive run.']}
(ROOT / 'summary.json').write_text(json.dumps(outcome, indent=2) + '\n')
print('COMPLETED', outcome['completedCircuitsFromRouteWitnesses'], 'ROUTES', outcome['routeWitnesses'])
print('SF64 RAM/GPU delta1to2', outcome['sf64Delta1to2'])
print('PRE-INSPECTION PHASE TAILS', phase_tails)
print('PASSIVE BOUNDARIES', [(row['cycle'], row['nativeFootprintBytes'], row['sf64Totals'], row['programCount']) for row in boundaries])
