"""Compare the same native poses and Inspector class payloads; never add heap estimates to WC."""
import collections
import gzip
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
FILES = [
    'native-nalati-direct-cc2371ac6',
    'native-nalati-deck-9478d5b03',
    'native-nalati-score-29f650e1e',
]


def read(name):
    path = ROOT / name
    if path.exists():
        return json.loads(path.read_text())
    with gzip.open(str(path) + '.gz', 'rt') as stream:
        return json.load(stream)


reports = []
for name in FILES:
    report = read(name + '.json')
    assert report.get('closed') and not report.get('failure'), name
    heap = read(name + '.heap.json')
    assert heap['version'] == 3 and len(heap['nodes']) % 4 == 0
    totals = collections.Counter()
    counts = collections.Counter()
    for i in range(0, len(heap['nodes']), 4):
        category = heap['nodeClassNames'][heap['nodes'][i + 2]]
        totals[category] += heap['nodes'][i + 1]
        counts[category] += 1
    poses = []
    for pose in report['snapshots']:
        native = pose['native']
        gpu = sum(context['totalBytes'] for context in pose['census']['gl'])
        poses.append(dict(label=pose['label'], webContentBytes=native['medianBytes'],
                          webContentMinBytes=native['minBytes'], webContentMaxBytes=native['maxBytes'],
                          gpuBytes=gpu, combinedBytes=native['medianBytes'] + gpu,
                          modelBytes=pose['residency']['cost']['playing']))
    reports.append(dict(file=name, version=report['version'], poses=poses, errors=report['errors'],
                        heapPayloadBytes=sum(totals.values()), audioBufferBytes=totals['AudioBuffer'],
                        audioBufferCount=counts['AudioBuffer'],
                        heapClasses=[dict(name=key, bytes=value, count=counts[key]) for key, value in totals.most_common(12)]))

result = dict(protocol='Cold muted iPhone Simulator direct Nalati route and residents=[] road; WC kernel median plus separately labelled GL. Inspector heap class payload estimates are WC subsets, not additive physical bytes; unrooted pending-collection objects may remain. Single cold run per revision, no forced GC before original poses.',
              lifecycleAudioBufferReductionBytes=reports[0]['audioBufferBytes'] - reports[1]['audioBufferBytes'],
              reports=reports, audioParity=read('audio-parity.json'))
(ROOT / 'audio-memory-summary.json').write_text(json.dumps(result, indent=2) + '\n')
for report in reports:
    print(report['file'], 'AudioBuffer MB', report['audioBufferBytes'] / 1e6)
    for pose in report['poses']:
        print(pose['label'], *(round(pose[key] / 1e6, 3) for key in ['webContentBytes', 'gpuBytes', 'combinedBytes']))
