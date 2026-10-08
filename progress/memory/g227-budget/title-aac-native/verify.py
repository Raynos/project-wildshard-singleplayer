"""Verify the committed failure-inclusive AAC evidence; stdlib only, no game run."""
import gzip
import hashlib
import json
import statistics
from pathlib import Path

root = Path(__file__).parent
summary = json.loads((root / 'summary.json').read_text())
manifest = json.loads((root / 'raw-manifest.json').read_text())
raw = {}
for row in manifest:
    packed = (root / row['file']).read_bytes()
    data = gzip.decompress(packed)
    assert len(packed) == row['gzipBytes']
    assert hashlib.sha256(packed).hexdigest() == row['gzipSha256']
    assert len(data) == row['rawBytes']
    assert hashlib.sha256(data).hexdigest() == row['rawSha256']
    raw[Path(row['file']).name.removesuffix('.gz')] = data
for row in json.loads((root / 'raw-manifest-before-continuation.json').read_text()):
    data = raw[row['file']]
    assert len(data) == row['bytes']
    assert hashlib.sha256(data).hexdigest() == row['sha256']
for row in json.loads((root / 'frozen-harness-manifest.json').read_text()):
    data = gzip.decompress((root / row['file']).read_bytes())
    assert len(data) == row['rawBytes']
    assert hashlib.sha256(data).hexdigest() == row['rawSha256']

labels = ['home-settled', 'pine-hollow-entry', 'pine-hollow-centre']
observed = {'before': [], 'after': []}
failures = {'before': 0, 'after': 0}
for run in summary['runs']:
    data = raw[run['file']]
    assert hashlib.sha256(data).hexdigest() == run['sha256']
    report = json.loads(data)
    assert report['closed'] is True and report['sampler']['exitCode'] == 0
    assert report['version'] == run['version']
    errors = json.loads(report['errors']) if isinstance(report['errors'], str) else report['errors']
    valid = not report.get('failure') and errors == []
    assert valid == run['valid']
    if not valid:
        failures[run['side']] += 1
        assert report.get('failure') == run['failure']
        assert report.get('diagnostic') == run['diagnostic']
        continue
    assert [pose['label'] for pose in report['snapshots']] == labels
    values = {}
    for pose in report['snapshots']:
        assert pose['settings'] == {'tier': 'phone', 'fps': 'auto', 'tex': 'auto', 'memorySaver': 'on', 'volume': 0}
        samples = pose['native']['samples']
        assert len(samples) == len({sample['at'] for sample in samples}) == 3
        assert {sample['pid'] for sample in samples} == {report['gamePID']}
        assert all(c['reconciled'] and c['unlabelled'] == 0 for c in pose['census']['gl'])
        live_contexts = [context for context in pose['audioContexts'] if context['kind'] == 'AudioContext']
        assert live_contexts == [{'kind': 'AudioContext', 'state': 'interrupted', 'currentTime': 0, 'sampleRate': 48000}]
        title = [item for item in pose['audioDecodes'] if '/piano/title-' in item['source']]
        if run['side'] == 'after':
            assert title == []
        else:
            assert len(title) == 1
            if pose['label'] == 'home-settled':
                assert title[0]['frames'] == 2989920 and title[0]['pcmBytes'] == 23919360
            else:
                assert title[0]['live'] is False
        wc = statistics.median(sample['footprintBytes'] for sample in samples)
        gl = sum(census['totalBytes'] for census in pose['census']['gl'])
        values[pose['label']] = {'webContentBytes': wc, 'glBytes': gl, 'combinedBytes': wc + gl}
        saved = next(item for item in run['poses'] if item['label'] == pose['label'])
        assert all(saved[key] == value for key, value in values[pose['label']].items())
    observed[run['side']].append(values)
for side, runs in observed.items():
    counts = summary['counts'][side]
    assert counts == {'attempts': len(runs) + failures[side], 'valid': len(runs), 'failed': failures[side]}
    assert len(runs) >= 3
    for label in labels:
        for key in ['webContentBytes', 'glBytes', 'combinedBytes']:
            values = [run[label][key] for run in runs]
            assert summary['summary'][label][side][key] == {
                'median': statistics.median(values), 'min': min(values), 'max': max(values),
                'spread': max(values) - min(values), 'runs': values}
for label in labels:
    row = summary['summary'][label]
    for key, value in row['afterMinusBefore'].items():
        assert value == row['after'][key]['median'] - row['before'][key]['median']
assert summary['nativeSavingCreditBytes'] == 0
assert len(summary['infrastructureFailures']) == 2
print(f'PASS: {len(manifest)} raw artifacts, all original hashes, frozen helpers, seven boots, counts and medians verified')
