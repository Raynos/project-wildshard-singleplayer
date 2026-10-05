import json
import statistics
import sys
from pathlib import Path

STUDY = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/private/tmp/claude-501/sp-builders/sp-x2/grid-fit-2226f2815')
EVIDENCE = 'progress/memory/sf22a-both-cuts-2226f2815'
PHASES = ('loading', 'play', 'explorer')

def jsonl(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]

def spread(values):
    median = statistics.median(values)
    return dict(medianMB=median, minMB=min(values), maxMB=max(values), spreadMB=max(values)-min(values), runsMB=values)

rows = []
build = None
for hybrid in ('off', 'on'):
    folder = STUDY / f'hybrid-{hybrid}'
    plan = json.loads((folder / 'plan.json').read_text())
    assert len(plan['runs']) == 3
    picks = plan['opts']['deviceSaves']
    assert picks == {
        'debug.plugin.driftwood-isle.driftwoodHybrid': hybrid,
        'debug.plugin.driftwood-isle.driftwoodGpuOnlyCopies': 'on',
        'debug.plugin.driftwood-isle.driftwoodIslandInstancing': 'on',
    }
    expected = plan['opts']['expectedBuild']
    if build is None: build = expected
    assert expected == build
    assert (STUDY / f'hybrid-{hybrid}.exit').read_text().strip() == '0'
    assert (STUDY / f'hybrid-{hybrid}.gl.exit').read_text().strip() == '0'
    gl = json.loads((folder / 'gl.json').read_text())
    assert gl['version']['build'] == expected and gl['deviceSaves'] == picks
    result = gl['results'][0]
    assert result['label'] == 'driftwood-isle' and not result.get('error')
    gl_mb = sum(c['textureMB'] + c['renderbufferMB'] + c['bufferMB'] for c in result['glLedger'])
    runs = []
    for run in plan['runs']:
        inspector = jsonl(folder / f"{run['tag']}.inspector.jsonl")
        native = jsonl(folder / f"{run['tag']}.native.jsonl")
        summary = next(r['result'] for r in inspector if r.get('kind') == 'summary')
        native_summary = next(r for r in native if r.get('type') == 'summary')
        assert not summary.get('error') and not native_summary['lost']
        assert summary['identity'] == summary['explorerIdentity'] == dict(build=expected, shard='driftwood-isle')
        assert all(summary['deviceSaves'][key] == value for key, value in picks.items())
        phases = {}
        for phase in PHASES:
            settled = next(r['result'] for r in inspector if r.get('kind') == 'settled' and r['phase'] == phase)
            assert len(settled['samples']) == 3
            phases[phase] = dict(nativeMB=settled['nativeGB']*1000, inspectorMB=settled['inspectorGB']*1000,
                nativePeakMB=native_summary['phases'][phase]['gameHighGB']*1000, settling=settled)
        runs.append(dict(tag=run['tag'], identity=summary['identity'], devicePicks={key:summary['deviceSaves'][key] for key in picks},
            loadSeconds=summary['loadSeconds'], geometry=summary['sceneStats'], phases=phases,
            nativeFile=f"hybrid-{hybrid}/{run['tag']}.native.jsonl", inspectorFile=f"hybrid-{hybrid}/{run['tag']}.inspector.jsonl"))
    phases = {phase:{name:spread([r['phases'][phase][field] for r in runs]) for name,field in
        (('native','nativeMB'),('inspector','inspectorMB'),('nativePeak','nativePeakMB'))} for phase in PHASES}
    row = dict(hybrid=hybrid, copies='on', instancing='on', glMB=gl_mb, glEvidence=f'hybrid-{hybrid}/gl.json', phases=phases, runs=runs,
        combinedPlay=spread([r['phases']['play']['nativeMB']+gl_mb for r in runs]),
        combinedExplorer=spread([r['phases']['explorer']['nativeMB']+gl_mb for r in runs]))
    model_input = dict(hybrid=hybrid, webContentMB=phases['play']['native']['medianMB'], glMB=gl_mb,
        coldPlayMB=phases['play']['native']['runsMB'], rev='2226f2815',
        device='iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census', evidence=EVIDENCE+'/summary.json')
    (folder / 'model-input.json').write_text(json.dumps(model_input,indent=2)+'\n')
    rows.append(row)

summary = dict(row='SHARD-PLATFORM SF22a / G144 decision data', sourceRevision='2226f2815', build=build,
    samplerRevision='356032992', units='decimal MB', simulator=dict(device='iPhone 17 Pro', runtime='iOS 26.5',
    mode='standalone Select a shard; Simulator relative evidence, not a physical-phone cap pass', playSeconds=30, explorerSeconds=30),
    protocol='Two variants sequentially, three cold Safari restarts and origin resets each; each phase uses median of three one-second native/Inspector samples. Variant summary uses the three independent cold-run medians. Matching GL wave followed Simulator shutdown. No outlier removal.',
    calibration=dict(engineBaseMB=299, revision='91f97bdfc', evidence='progress/memory/sf22a-2026-10-04.json', remeasured=False),
    rows=rows, defaultsChanged=False)
(STUDY / 'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps([{k:r[k] for k in ('hybrid','glMB','combinedPlay','combinedExplorer')} for r in rows],indent=2))
