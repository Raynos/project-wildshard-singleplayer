"""Summarize settled kernel footprints, GL and vmmap regions without assigning native residual to JS owners."""
import gzip
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent


def read(path):
    return json.loads((gzip.open(path, 'rt') if path.suffix == '.gz' else path.open()).read())


def vm_bytes(value):
    match = re.fullmatch(r'([0-9.]+)([KMGT]?)', value)
    if not match:
        raise ValueError(value)
    return round(float(match[1]) * 1024 ** (' KMGT'.index(match[2]) if match[2] else 0))


def regions(path):
    rows = []
    text = path.read_text()
    for line in text.splitlines():
        match = re.match(r'^(.+?)\s{2,}([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+([0-9.]+[KMGT]?)\s+', line)
        if not match:
            continue
        name = match[1].strip()
        if name in ['TOTAL', 'TOTAL, minus reserved VM space'] or name.startswith(('WebKit Malloc_', 'DefaultMallocZone_', 'caulk::', 'QuartzCore_', 'WebKit Using System Malloc_')):
            continue
        rows.append(dict(name=name, virtualBytes=vm_bytes(match[2]), residentBytes=vm_bytes(match[3]), dirtyBytes=vm_bytes(match[4]), swappedBytes=vm_bytes(match[5])))
    return rows


reports = []
for filename in ['native-f47f33199.json', 'native-nalati-direct-f47f33199.json', 'native-nalati-direct-cc2371ac6.json']:
    path = ROOT / filename
    if not path.exists():
        path = ROOT / (filename + '.gz')
    if not path.exists():
        continue
    report = read(path)
    if not report.get('closed'):
        continue
    poses = []
    for pose in report['snapshots']:
        native = pose['native']
        gl = sum(context['totalBytes'] for context in pose['census']['gl'])
        direct = sum(array['bytes'] for array in pose['census']['cpuAllocations'])
        poses.append(dict(label=pose['label'], webContentBytes=native['medianBytes'], webContentMinBytes=native['minBytes'], webContentMaxBytes=native['maxBytes'],
                          gpuBytes=gl, combinedBytes=native['medianBytes']+gl, modelBytes=pose['residency']['cost']['playing'],
                          directlyHeldSceneArrayBufferBytes=direct, wasm=pose.get('wasm'),
                          regions=regions(pathlib.Path(native['vmmapPath']))))
    reports.append(dict(file=path.name, version=report['version'], failure=report.get('failure'), poses=poses, heap=report.get('heap')))
summary=dict(protocol='WC kernel physical footprint plus separately labelled GL. Direct scene arrays are a subset of WC, never added again. vmmap resident regions can alias and are not summed into footprint. Decimal MB; vmmap source K/M/G is binary.', reports=reports)
(ROOT / 'native-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for report in reports:
    print(report['file'])
    for pose in report['poses']:
        print(pose['label'], *(round(pose[key]/1e6,3) for key in ['webContentBytes','gpuBytes','combinedBytes','modelBytes']))
