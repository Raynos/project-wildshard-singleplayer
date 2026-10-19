import json,math
from pathlib import Path
out=Path(__file__).parent
trace=json.loads(Path('tmp/mantis-precontact-capture-run2/render-trace.json').read_text())
def angle(a,b):
 a=a[3:];b=b[3:];dot=abs(sum(x*y for x,y in zip(a,b)))/math.sqrt(sum(x*x for x in a)*sum(x*x for x in b));return 2*math.acos(min(1,dot))
records=[]
for a,b in zip(trace,trace[1:]):
 if a['bout']!=b['bout']:continue
 i,j=a['poseInputs'],b['poseInputs']
 if not(i['alive']and j['alive']):continue
 qs={n:angle(a['bones'][n],b['bones'][n])for n in a['bones']}
 records.append({'from':a['frame'],'to':b['frame'],'dt':j['t']-i['t'],'stage':[i['stage'],j['stage']],'attack':[i['attack'],j['attack']],'observed':[i['posePhase'],j['posePhase']],'maxRadians':max(qs.values()),'bone':max(qs,key=qs.get),'raptorMaxRadians':max(v for k,v in qs.items()if k.startswith('raptor'))})
sweep=[x for x in records if x['stage'][0]==x['stage'][1]and x['stage'][0]in[1,3]and all(a>=0 for a in x['attack'])]
endpoint=[x for x in records if x['stage'][0]==x['stage'][1]and x['stage'][0]in[1,3]and x['attack'][0]>=.95 and x['attack'][1]<0]
report={'scope':'Adjacent captured local full quaternions; no interpolation or missing frames inferred. Bounds include all actual variable render intervals.','livingPairs':len(records),'sweepPairs':len(sweep),'maximumLiving':max(records,key=lambda x:x['maxRadians']),'maximumWithinWindup':max(sweep,key=lambda x:x['raptorMaxRadians']),'endpointTransitions':endpoint,'staleObservedRecoveryWithLiveAttack':[r['frame']for r in trace if r['poseInputs']['attack']>=0 and r['poseInputs']['posePhase']==3]}
(out/'adjacent-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
