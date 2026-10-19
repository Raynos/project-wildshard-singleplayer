"""Read retained complete pose traces; no invented frames or product changes."""
import hashlib,json,math
from pathlib import Path
out=Path(__file__).parent
paths=['tmp/mantis-early-knee-capture-run1/render-trace.json','docs/reviews/mantis-early-knee-supplement/run1/render-trace.json','docs/reviews/mantis-early-knee-moving/run1/render-trace.json']
def angle(a,b):return 2*math.acos(min(1,abs(sum(x*y for x,y in zip(a[3:],b[3:])))))
def state(r):
 p=r.get('poseInputs');m=p['mem'] if p else {}
 return (m.get('mantis-st',r['stage']),m.get('mantis-pose-phase',r['posePhase']),m.get('mantis-pose-clock',r['poseClock']))
reports=[]
for path in paths:
 raw=Path(path).read_bytes();rows=json.loads(raw);bounds=[];held=[];latency=[];recover=[]
 for i,(a,b) in enumerate(zip(rows,rows[1:]),1):
  sa,pa,ca=state(a);sb,pb,cb=state(b)
  if not(a['alive'] and b['alive']) or b['frame']<=a['frame']:continue
  if sb in [1,3] and b['strike']['phase']=='active' and pb==1:
   latency.append({'index':i,'frame':b['frame'],'stage':sb,'strikeElapsed':b['strike']['elapsed'],'observerClock':cb})
  if sa==sb and sb in [1,3]:
   side=-1 if sb==1 else 1;names=[f'raptor{side}',f'raptor{side}_elbow',f'raptor{side}_hook','body','neck']
   jumps={n:angle(a['bones'][n],b['bones'][n]) for n in names}
   row={'index':i,'frames':[a['frame'],b['frame']],'stage':sb,'observedPhases':[pa,pb],'observedClocks':[ca,cb], 'strikePhases':[a['strike']['phase'],b['strike']['phase']], 'strikeElapsed':b['strike']['elapsed'],'boutDelta':b['boutTime']-a['boutTime'],'rootDistance':math.dist(a['position'],b['position']),'jumpsRadians':jumps,'poseOwnedInputs':a.get('poseInputs') is not None and b.get('poseInputs') is not None}
   if pa==1 and pb==2:bounds.append(row)
   if pa==pb==2 and max(jumps[n] for n in names[:3])<1e-7 and row['rootDistance']>.001:held.append(row)
   if pa==pb==3 and ca!=cb:recover.append(row)
 reports.append({'path':path,'sha256':hashlib.sha256(raw).hexdigest(),'poses':len(rows),'poseOwnedAttackPresent':sum('attack' in (r.get('poseInputs') or {}) for r in rows), 'boundaries':bounds,'heldActiveMovingCount':len(held),'heldActiveRootDistanceSum':sum(r['rootDistance'] for r in held),'largestHeldActiveTranslation':max(held,key=lambda r:r['rootDistance'],default=None),'observedActiveLatencyRows':latency,'largestRecoveryShoulderStep':max(recover,key=lambda r:r['jumpsRadians'][f"raptor{-1 if r['stage']==1 else 1}"],default=None)})
out.joinpath('trace-audit.json').write_text(json.dumps(reports,indent=2)+'\n')
for r in reports:print(r['path'],r['poses'],'boundaries',len(r['boundaries']),'held',r['heldActiveMovingCount'],'distance',r['heldActiveRootDistanceSum'],'latency',len(r['observedActiveLatencyRows']))
