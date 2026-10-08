"""Reproduce same-pin settled pose comparison without counting heap estimates as extra process bytes."""
import gzip
import json
import pathlib

ROOT = pathlib.Path(__file__).parent

def load(name):
    path = ROOT / name
    if path.exists():
        return json.loads(path.read_text())
    return json.loads(gzip.open(str(path) + '.gz', 'rt').read())

def summarize(name, expected):
    report = load(name)
    assert report.get('closed') and not report.get('failure'), name
    assert json.loads(report['errors']) == [], name
    poses = {}
    for sample in report['snapshots']:
        assert sample['settings']['memorySaver'] == expected, (name, sample['label'])
        gpu = sum(context['totalBytes'] for context in sample['census']['gl'])
        arrays = sample['census']['cpuAllocations']
        poses[sample['label']] = {
            'webContentBytes': sample['native']['medianBytes'], 'glBytes': gpu,
            'combinedBytes': sample['native']['medianBytes'] + gpu,
            'playingBytes': sample['residency']['cost']['playing'],
            'directSceneArrayBytes': sum(row['bytes'] for row in arrays),
            'releasedAttributeCount': len(sample['census'].get('releasedAttributes', [])),
            'largestDirectArrays': sorted(arrays, key=lambda row: row['bytes'], reverse=True)[:20],
        }
    assert report['snapshots'][-1]['state']['live']['live']['residents'] == [], name
    return {'file': name, 'version': report['version'], 'setting': expected, 'poses': poses,
            'warnings': json.loads(report['warnings'])}

variants = {setting: summarize('native-nalati-saver-' + setting + '-verified-65106ea87.json', setting) for setting in ['off', 'on']}
assert variants['off']['version'] == variants['on']['version']
delta = {pose: {key: row[key] - variants['off']['poses'][pose][key]
               for key in ['webContentBytes', 'glBytes', 'combinedBytes', 'directSceneArrayBytes', 'releasedAttributeCount']}
         for pose, row in variants['on']['poses'].items()}
result = {'protocol': 'One cold run each, three settled native samples per pose, same pin and same-pose GL. Negative ON minus OFF is lower, not an isolated causality claim. Descriptor census never invokes CPU restore getters. No forced GC before poses. Decimal bytes.',
          'variants': variants, 'onMinusOff': delta}
(ROOT / 'memory-saver-centre-summary.json').write_text(json.dumps(result, indent=2) + '\n')
for pose in delta:
    print(pose, 'OFF', variants['off']['poses'][pose]['combinedBytes'] / 1e6,
          'ON', variants['on']['poses'][pose]['combinedBytes'] / 1e6, 'delta', delta[pose]['combinedBytes'] / 1e6)
