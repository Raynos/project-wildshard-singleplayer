"""Actual captured pose/world timing only. No missing pose inputs reconstructed."""
import json,math,hashlib
from pathlib import Path
import numpy as np
out=Path(__file__).parent
path=Path('tmp/mantis-precontact-capture-run2/render-trace.json')
trace=json.loads(path.read_text()); damage=json.loads(path.with_name('damage-events.json').read_text())
native=json.loads(Path('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json').read_text())
def matrix(v):
 x,y,z,w=v[3:];m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,3]=v[:3];return m
parts=[]
for p in native['parts']:
 if not p['name'].startswith('raptor'):continue
 parts.append((p['name'],np.array(p['positions']).reshape(-1,3),np.array(p['skinIndices']).reshape(-1,4),np.array(p['skinWeights']).reshape(-1,4)))
rows=[]
for r in trace:
 posed={};world=np.array(r['world']).reshape(4,4).T
 for b in native['bones']:
  local=matrix(r['bones'][b['name']]);posed[b['name']]=posed[b['parent']]@local if b['parent'] else local
 player=np.array(r['playerPosition']);minimum={}
 for name,vertices,indices,weights in parts:
  deformed=np.zeros_like(vertices)
  for j in np.unique(indices):
   b=native['bones'][int(j)];v=np.column_stack((vertices-np.array(b['pos']),np.ones(len(vertices))));deformed+=((world@posed[b['name']]@v.T).T[:,:3])*(weights*(indices==j)).sum(axis=1)[:,None]
  axis=deformed.copy();axis[:,0]=player[0];axis[:,2]=player[2];axis[:,1]=np.clip(deformed[:,1],player[1]+.38,player[1]+1.42)
  minimum[name]=float(np.linalg.norm(deformed-axis,axis=1).min()-.38)
 i=r['poseInputs']; rows.append({'frame':r['frame'],'bout':r['bout'],'t':i['t'],'wallTime':r['wallTime'],'poseIndex':i['poseIndex'],'attack':i['attack'],'stage':i['stage'],'alive':i['alive'],'phase':r['phase'],'strike':r['strike']['phase'],'strikeId':r['strike']['currentId'],'elapsed':r['strike']['elapsed'],'cut':i['attack']>=.95 or i['attack']<0 and i['stage']in[1,3]and i['posePhase']in[1,2],'minVertexCapsuleGap':min(minimum.values()),'parts':minimum,'position':r['position']})
# Segment each authoritative strike instance, preserving all discontinuities/Retry resets.
bouts=[];current=[]
for row in rows:
 if current and (row['bout']!=current[-1]['bout'] or row['strikeId']!=current[-1]['strikeId'] or row['strike']=='windup' and current[-1]['strike']!='windup'):
  bouts.append(current);current=[]
 current.append(row)
if current:bouts.append(current)
instances=[]
for group in bouts:
 if group[0]['strikeId'] is None:continue
 hit=[d for d in damage if d['target']=='player' and d['bout']==group[0]['bout'] and group[0]['wallTime']-150 <=d['wallTime']<=group[-1]['wallTime']+150 and d.get('runner',{}).get('strike',{}).get('currentId')==group[0]['strikeId']]
 firstHit=hit[0] if hit else None
 cut=next((r for r in group if r['cut']),None);overlap=next((r for r in group if r['minVertexCapsuleGap']<0),None)
 wind=[r for r in group if r['attack']>=0]
 instances.append({'bout':group[0]['bout'],'strikeId':group[0]['strikeId'],'firstFrame':group[0]['frame'],'lastFrame':group[-1]['frame'],'windupSamples':len(wind),'sweepSamples':sum(.45<r['attack']<.95 for r in wind),'firstCutFrame':cut['frame']if cut else None,'firstCutTime':cut['t']if cut else None,'firstHitFrame':firstHit['frame']if firstHit else None,'firstHitTime':firstHit['boutTime']if firstHit else None,'cutBeforeHitSeconds':firstHit['boutTime']-cut['t']if firstHit and cut else None,'firstVertexOverlapFrame':overlap['frame']if overlap else None,'firstVertexOverlapTime':overlap['t']if overlap else None,'windupVertexOverlapFrames':[r['frame']for r in wind if r['minVertexCapsuleGap']<0],'minimumVertexGap':min(r['minVertexCapsuleGap']for r in group)})
report={'scope':'Actual native weighted blade vertices against actual-size Player capsule, using recorded full world and player feet position. Negative gap proves a sampled vertex overlap; positive gap does not exclude triangle intersection. Events use last evaluated pose explicitly.','traceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'instances':instances,'rows':rows}
(out/'attack-timing.json').write_text(json.dumps(report,indent=2)+'\n')
print('instances',len(instances),'windup-overlap-frames',sum(len(x['windupVertexOverlapFrames'])for x in instances));print([x for x in instances if x['firstHitTime']is not None])
