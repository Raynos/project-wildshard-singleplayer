#!/usr/bin/env python3
"""Reproduce the cold-three-run native + same-pin labelled GL proxy (decimal MB)."""
import json
import statistics
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent

def lines(file):
    return [json.loads(line) for line in file.read_text().splitlines() if line.strip()]

def spread(values):
    return dict(medianMB=statistics.median(values), minMB=min(values), maxMB=max(values), runsMB=values)

plan = json.loads((root / 'sim/plan.json').read_text())
build = plan['opts']['expectedBuild']
assert len(plan['runs']) == 3 and plan['opts']['locations']
assert plan['opts']['settings'] == ['tex=auto']
assert plan['opts']['deviceSaves'] == {'debug.plugin.pine-hollow.pineMemoryTrim': 'on'}
gl = json.loads((root / 'gl/summary.json').read_text())
assert len(gl) == 3
gl_phases = {}
for row in gl:
    assert row['version']['build'] == build and not row['errors']
    for phase in row['phases']:
        gl_phases.setdefault(phase['phase'], []).append(phase['maxBytes'] / 1e6)
runs = []
for run in plan['runs']:
    inspector = lines(root / 'sim' / (run['tag'] + '.inspector.jsonl'))
    native = lines(root / 'sim' / (run['tag'] + '.native.jsonl'))
    summary = next(row['result'] for row in inspector if row.get('kind') == 'summary')
    native_summary = next(row for row in native if row.get('type') == 'summary')
    assert not summary.get('error') and not native_summary['lost']
    assert summary['identity'] == summary['explorerIdentity'] == {'build': build, 'shard': 'pine-hollow'}
    assert summary['settings']['tex'] == 'auto'
    assert summary['deviceSaves']['debug.plugin.pine-hollow.pineMemoryTrim'] == 'on'
    phases = {}
    for phase in ('loading', 'play', 'explorer', *gl_phases.keys()):
        if phase in phases:
            continue
        settled = next(row['result'] for row in inspector if row.get('kind') == 'settled' and row['phase'] == phase)
        assert len(settled['samples']) == 3
        # Phase closure samples are only retained in the summary, rounded to 1 MB.
        # Add its half-MB rounding bound, so a transient at the boundary cannot vanish.
        observations = [row for row in native if row.get('type') == 'sample' and row['phase'] == phase]
        sample_peak_mb = max(max(max(value) for value in row['pids'].values()) for row in observations) / 1e6
        native_peak_mb = max(sample_peak_mb, native_summary['phases'][phase]['gameHighGB'] * 1000 + 0.5)
        phases[phase] = dict(nativeMB=settled['nativeGB'] * 1000, inspectorMB=settled['inspectorGB'] * 1000,
                             nativePeakMB=native_peak_mb, settling=settled)
    runs.append(dict(tag=run['tag'], loadSeconds=summary['loadSeconds'], phases=phases,
                     geometry=summary['sceneStats'], locations=summary['locations']))
rows = {}
for phase in runs[0]['phases']:
    phase_gl = spread(gl_phases[phase]) if phase != 'loading' else None
    # Loading conservatively uses the maximum GL seen in any later phase.
    gl_mb = phase_gl['maxMB'] if phase_gl else max(max(values) for values in gl_phases.values())
    native = spread([run['phases'][phase]['nativeMB'] for run in runs])
    peak = spread([run['phases'][phase]['nativePeakMB'] for run in runs])
    rows[phase] = dict(native=native, inspector=spread([run['phases'][phase]['inspectorMB'] for run in runs]),
                       nativePeak=peak, gl=phase_gl, proxyMedianMB=native['medianMB'] + gl_mb,
                       proxyColdRangeMB=[native['minMB'] + gl_mb, native['maxMB'] + gl_mb],
                       proxyTransientMB=peak['maxMB'] + gl_mb)
locations = {key: row for key, row in rows.items() if key.startswith('location:') and key != 'location:return'}
worst = max(locations, key=lambda phase: locations[phase]['proxyTransientMB'])
full_gl = max(max(values) for values in gl_phases.values())
playing_phases = [phase for phase in rows if phase != 'loading']
conservative_transient = max(rows[phase]['nativePeak']['maxMB'] for phase in playing_phases) + full_gl
result = dict(sourceRevision='8e82ae91f701f8990199fe92407e4f1c61f14b20', build=build, units='decimal MB',
              playingCapMB=1000, loadingCapMB=1800, rows=rows, worstLocation=worst,
              worstLocationTransientMB=rows[worst]['proxyTransientMB'], runs=runs,
              fullCoverageGLMB=full_gl, conservativePlayingTransientMB=conservative_transient,
              conservativePlayingMarginMB=1000-conservative_transient,
              protocol='Three cold Safari/origin resets; seed1 harness; 30s play/Explorer, all real capture poses120frames and three settled1s samples; separate three fresh Chromium/Metal phone GL contexts. Max GL by phase plus median or max interval-high native. Simulator+desktop GL proxy, not physical-phone evidence.')
(root / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key not in ('runs', 'protocol')}, indent=2))
