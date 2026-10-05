import json,statistics,sys
from pathlib import Path
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent
phases=('loading','play','explorer')
def lines(p): return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
def spread(v): return dict(medianMB=statistics.median(v),minMB=min(v),maxMB=max(v),spreadMB=max(v)-min(v),runsMB=v)
rows=[]
for label in ('driftwood-g172','pine-g180','pine-g180-ktx2'):
    folder=root/label; study=json.loads((folder/'study.json').read_text()); sim=folder/'sim'
    plan=json.loads((sim/'plan.json').read_text()); expected=plan['opts']['expectedBuild']; picks=plan['opts']['deviceSaves']
    assert len(plan['runs'])==3
    settings={'tex':'ktx2'} if label.endswith('-ktx2') else {}
    assert plan['opts']['settings']==(['tex=ktx2'] if settings else [])
    assert picks==({} if label=='driftwood-g172' else {'debug.plugin.pine-hollow.pineMemoryTrim':'on'})
    assert (folder/'sim.exit').read_text().strip()==(folder/'gl.exit').read_text().strip()=='0'
    gl=json.loads((folder/'gl.json').read_text()); assert gl['version']['build']==expected and gl['deviceSaves']==picks
    assert gl.get('settings',{})==settings
    gpu=gl['results'][0]; assert gpu['label']==study['shard'] and not gpu.get('error')
    glMB=sum(c['textureMB']+c['renderbufferMB']+c['bufferMB'] for c in gpu['glLedger'])
    runs=[]
    for run in plan['runs']:
        ins=lines(sim/(run['tag']+'.inspector.jsonl')); native=lines(sim/(run['tag']+'.native.jsonl'))
        summary=next(r['result'] for r in ins if r.get('kind')=='summary'); ns=next(r for r in native if r.get('type')=='summary')
        assert not summary.get('error') and not ns['lost']
        assert summary['identity']==summary['explorerIdentity']=={'build':expected,'shard':study['shard']}
        assert all(summary['deviceSaves'][k]==v for k,v in picks.items())
        assert all(summary['settings'][k]==v for k,v in settings.items())
        ps={}
        for ph in phases:
            settled=next(r['result'] for r in ins if r.get('kind')=='settled' and r['phase']==ph)
            assert len(settled['samples'])==3
            ps[ph]=dict(nativeMB=settled['nativeGB']*1000,inspectorMB=settled['inspectorGB']*1000,nativePeakMB=ns['phases'][ph]['gameHighGB']*1000,settling=settled)
        runs.append(dict(tag=run['tag'],identity=summary['identity'],devicePicks=picks,settingsPicks=settings,loadSeconds=summary['loadSeconds'],geometry=summary['sceneStats'],phases=ps))
    rows.append(dict(label=label,sourceRevision=study['rev'],shard=study['shard'],build=expected,devicePicks=picks,settingsPicks=settings,glMB=glMB,runs=runs,
      phases={ph:{name:spread([r['phases'][ph][field] for r in runs]) for name,field in [('native','nativeMB'),('inspector','inspectorMB'),('nativePeak','nativePeakMB')]} for ph in phases},
      combinedPlay=spread([r['phases']['play']['nativeMB']+glMB for r in runs]),combinedExplorer=spread([r['phases']['explorer']['nativeMB']+glMB for r in runs]),
      combinedPeaks={ph:max(r['phases'][ph]['nativePeakMB'] for r in runs)+glMB for ph in phases}))
result=dict(row='SHARD-PLATFORM SF22a G172 default and G180 Pine',units='decimal MB',playingCapMB=1000,loadingCapMB=1800,
    protocol='Three cold Safari restarts/origin resets per product; 30s play and Explorer; three one-second settled samples/phase; all runs retained; Simulator shuts down before same-pin labelled GL census. Simulator plus desktop GL proxy, not physical-phone cap evidence.',rows=rows)
(root/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([{k:r[k] for k in ('label','glMB','combinedPlay','combinedExplorer','combinedPeaks')} for r in rows],indent=2))
