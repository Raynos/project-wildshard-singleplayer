import json, statistics, datetime, pathlib, sys
root=pathlib.Path(sys.argv[1])
rows=[json.loads(s) for s in (root/'plain-native.jsonl').read_text().splitlines()]
samples=[r for r in rows if r.get('type')=='sample']
settled=[r for r in samples if r['phase']=='settle']
pid=max(settled[-1]['pids'],key=lambda k:settled[-1]['pids'][k][0])
game=[r for r in samples if pid in r['pids']]
phases={}
for phase in ['baseline','drive','settle']:
    selected=[r for r in game if r['phase']==phase]
    phases[phase]={'count':len(selected),'medianWebContentBytes':statistics.median(r['pids'][pid][0] for r in selected),
                   'peakWebContentBytes':max(r['pids'][pid][1] for r in selected)}
routes=json.loads((root/'plain.json').read_text())['routes']
peaks=[]
for i,r in enumerate(game):
    if r['phase']!='drive':continue
    window=game[max(0,i-3):i+4]
    baseline=statistics.median(x['pids'][pid][0] for x in window)
    excess=r['pids'][pid][1]-baseline
    timestamp=datetime.datetime.fromisoformat(r['t']).timestamp()
    route=next((p for p in routes if p['start']<=timestamp<=p['end']),None)
    peaks.append({'excessBytes':excess,'footprintBytes':r['pids'][pid][0],'intervalHighBytes':r['pids'][pid][1],
                  't':r['t'],'route':route['name'] if route else None,'routeSeconds':timestamp-route['start'] if route else None})
summary={'pid':pid,'samples':len(game),'maximumGapSeconds':max(b['elapsed']-a['elapsed'] for a,b in zip(game,game[1:])),
         'phases':phases,'transients':sorted(peaks,key=lambda p:p['excessBytes'],reverse=True)[:12],
         'nativeSummary':next((r for r in rows if r.get('type')=='summary'),None),
         'errors':json.loads((root/'plain.json').read_text())['errors']}
(root.parent/(root.name+'-summary.json')).write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k not in ['nativeSummary','transients']},indent=2))
print(json.dumps(summary['transients'][:3],indent=2))
