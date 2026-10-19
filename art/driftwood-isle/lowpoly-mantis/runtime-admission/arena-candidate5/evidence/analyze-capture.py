from pathlib import Path
import json,hashlib,statistics,collections,subprocess
base=Path(__file__).parent
trace=json.loads((base/'qa/render-trace.json').read_text()); report=json.loads((base/'qa/report.json').read_text())
changes=[]
for i,row in enumerate(trace):
 if i and (row['strike']['phase']!=trace[i-1]['strike']['phase'] or row['posePhase']!=trace[i-1]['posePhase'] or row['hp']!=trace[i-1]['hp'] or row['alive']!=trace[i-1]['alive']):
  changes.append({'index':i,'frame':row['frame'],'phase':row['phase'],'gameTime':row['gameTime'],'wallTime':row['wallTime'],'actual':row['strike'],'observed':row['posePhase'],'observedClock':row['poseClock'],'stage':row['stage'],'hp':row['hp'],'alive':row['alive']})
intervals=[trace[i]['wallTime']-trace[i-1]['wallTime'] for i in range(1,len(trace))]
summary={'traceFrames':len(trace),'gameSeconds':trace[-1]['gameTime']-trace[0]['gameTime'],'wallSeconds':(trace[-1]['wallTime']-trace[0]['wallTime'])/1000,'renderIntervalMilliseconds':{'minimum':min(intervals),'median':statistics.median(intervals),'maximum':max(intervals)},'stagePhaseCounts':dict(collections.Counter(f"{r['stage']}:{r['strike']['phase']}" for r in trace)),'sampledPlayerDamage':any(r['player']['health']['health']<100 for r in report['samples'] if r['phase']=='defense'),'terminalDefensePlayerDamageAssertion':report['checks'].get('actualPlayerDamage'),'changes':changes,'caveat':'Simulation combat snapshots,10Hz pose observation and cloud compositor/video timing are separate. Positive geometry clearance and passing harness assertions are not quality acceptance.'}
(base/'capture-analysis.json').write_text(json.dumps(summary,indent=2)+'\n')
for name,directory in [('host','dist'),('native','native')]:
 files={p.relative_to(base/directory).as_posix():{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted((base/directory).rglob('*')) if p.is_file()}
 (base/f'{name}-inventory-after.json').write_text(json.dumps(files,indent=2)+'\n')
 print(name,len(files),'unchanged',files==json.loads((base/f'{name}-inventory-before.json').read_text()))
print(json.dumps({k:v for k,v in summary.items() if k!='changes'},indent=2))
