"""Read-only source validation and independent ordered-cycle/clock extraction."""
import json, hashlib, statistics
from pathlib import Path
root=Path('.')
p=root/'docs/reviews/colossus-native-motion2-build3'
out=root/'docs/reviews/colossus-motion2-independent-cycles'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
c=json.loads((p/'closure.json').read_text())
assert sha(p/'closure.json')=='0f92a822d8e111480732974b7831edcac9429f4b2282ec21d147c9750bf72cca'
verified=[]
for e in c['evidence']:
 f=p/e['path']; assert sha(f)==e['sha256'] and f.stat().st_size==e['bytes'];verified.append(e['path'])
for key in ['sourceClosure','observer','geometryScript']:
 e=c[key]; f=root/e['path'];assert sha(f)==e['sha256'] and f.stat().st_size==e['bytes']
v=root/'tmp/colossus-native-observer-motion2/video'/c['videoPreservedLocally'][0]['path'];assert sha(v)==c['videoPreservedLocally'][0]['sha256']
t=json.loads((p/'render-trace.json').read_text()); cycles=[];active=None;last_actor=None
for row in t:
 if row['actorInstance']!=last_actor:active=None;last_actor=row['actorInstance']
 phase=row['strike']['phase']
 if phase=='windup' and active is None:active={'actor':last_actor,'id':row['strike']['currentId'],'phases':[],'start':row}
 if active is not None:
  if not active['phases'] or active['phases'][-1]['phase']!=phase:
   active['phases'].append({'phase':phase,'frame':row['frame'],'game':row['gameTime'],'wallMs':row['wallTime'],'state':row['stage'],'stateClock':row['clock'],'strikeClock':row['strike']['clock']})
  if phase=='idle':
   start=active.pop('start');active['complete']=[x['phase'] for x in active['phases']]==['windup','active','recover','idle'];active['gameSeconds']=row['gameTime']-start['gameTime'];active['wallSeconds']=(row['wallTime']-start['wallTime'])/1000;cycles.append(active);active=None
intervals=[b['wallTime']-a['wallTime'] for a,b in zip(t,t[1:]) if a['actorInstance']==b['actorInstance']]
dead=[r for r in t if not r['alive']];recomputed=json.loads((root/'tmp/colossus-motion2-independent-cycles/recomputed-world.json').read_text());oracle=json.loads((p/'world-contact.json').read_text());difference=max(abs(a['minimum']-b['minHeight']) for a,b in zip(recomputed['frames'],oracle['frames']))
result={'inputClosure':sha(p/'closure.json'),'verifiedEvidenceFiles':verified,'productSourceHash':c['productSourceHash'],'sourceClosureSha256':c['sourceClosure']['sha256'],'video':{'sha256':sha(v),'encodedFrames':3570,'fps':25,'seconds':142.8,'reviewedZeroBasedFrames':[0,3569],'sheetCount':30,'sheetCrop':'x0 y230 width402 height570; actor and local ground visible after observer starts; full corpse still also inspected'},'trace':{'frames':len(t),'deadFrames':len(dead),'bonesPerFrame':sorted({len(r['bones']) for r in t}),'firstFrame':t[0]['frame'],'lastFrame':t[-1]['frame'],'wallSeconds':(t[-1]['wallTime']-t[0]['wallTime'])/1000,'gameSeconds':t[-1]['gameTime']-t[0]['gameTime'],'aggregateFPS':1000*len(intervals)/sum(intervals),'medianMs':statistics.median(intervals),'p95Ms':sorted(intervals)[int(.95*(len(intervals)-1))],'maxMs':max(intervals)},'cycles':cycles,'completeCycles':sum(c['complete'] for c in cycles),'contactReexecution':recomputed['summary'],'maxOracleDeltaM':difference,'deadRootYRange':[min(r['world'][13] for r in dead),max(r['world'][13] for r in dead)],'deadPoseClock':{'firstDeadFrame':dead[0]['frame'],'firstState6Frame':next(r['frame'] for r in dead if r['stage']==6),'firstDeathT1Frame':next(r['frame'] for r in dead if r['deathT']==1),'stateClockValues':sorted({r['clock'] for r in dead})}}
(out/'analysis.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['cycles','verifiedEvidenceFiles']},indent=2))
