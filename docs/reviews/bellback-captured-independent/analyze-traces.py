"""Read-only capture cadence, complete phase ranges, and local/root motion audit."""
import json,pathlib,sys,numpy as np
cap=pathlib.Path(sys.argv[1]);dest=pathlib.Path(sys.argv[2]);r=json.loads((cap/'render-trace.json').read_text())
wall=np.diff([x['wallTime'] for x in r]);runs=[]
for x in r:
 key=(x['scenario'],x['alive'],x['stage'],x['strike']['phase'],(x.get('ragdoll') or {}).get('state'))
 if not runs or runs[-1]['key']!=key:runs.append({'key':key,'first':x['frame'],'last':x['frame'],'count':1,'game':[x['gameTime'],x['gameTime']],'hp':[x['hp'],x['hp']],'clock':[x['clock'],x['clock']]})
 else:
  y=runs[-1];y['last']=x['frame'];y['count']+=1;y['game'][1]=x['gameTime'];y['hp'][1]=x['hp'];y['clock'][1]=x['clock']
deaths=[]
for name in sorted(set(x['scenario'] for x in r if not x['alive'])):
 d=[x for x in r if x['scenario']==name and not x['alive']];base=d[0]
 bones=np.array([list(x['bones'].values()) for x in d]);world=np.array([x['world'] for x in d]);f=[x for x in d if (x.get('ragdoll') or {}).get('state')=='frozen']
 roots=world[:,12:15];travel=np.linalg.norm(np.diff(roots,axis=0),axis=1)
 deaths.append({'scenario':name,'range':[d[0]['frame'],d[-1]['frame']],'count':len(d),'localBoneMaximumDelta':float(np.max(np.abs(bones-bones[0]))),'rootMatrixMaximumDelta':float(np.max(np.abs(world-world[0]))),'rootPathLength':float(sum(travel)),'rootDisplacement':float(np.linalg.norm(roots[-1]-roots[0])),'rootAxisRange':np.ptp(roots,axis=0).tolist(),'frozenRange':[f[0]['frame'],f[-1]['frame']] if f else None,'frozenCount':len(f),'frozenMaximumWorldDelta':float(np.max(np.abs(np.array([x['world'] for x in f])-np.array(f[0]['world'])))) if f else None})
cadence={'observations':len(r),'frameRange':[r[0]['frame'],r[-1]['frame']],'wallSeconds':(r[-1]['wallTime']-r[0]['wallTime'])/1000,'gameSeconds':r[-1]['gameTime']-r[0]['gameTime'],'intervalMs':{'median':float(np.median(wall)),'p95':float(np.quantile(wall,.95)),'max':float(max(wall))}}
cadence['observedRendersPerWallSecond']=(len(r)-1)/cadence['wallSeconds']
result={'cadence':cadence,'deaths':deaths,'runs':runs};dest.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='runs'},indent=2))
