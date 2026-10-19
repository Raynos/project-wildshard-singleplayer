import json,numpy as np,pathlib
# Reuse only the audited matrix function, not the previous results.
text=pathlib.Path('scripts/analyze-bellback-full-combat.py').read_text();exec(text[text.index('def local'):text.index('parts=[]')])
b=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission');native=json.loads((b/'visual/frame2-native/bellback-v6-native.json').read_text());traces=[json.loads((b/'arena-candidate3/build1/render-trace.json').read_text()),json.loads(pathlib.Path('tmp/bellback-anatomy3-full-combat/render-trace.json').read_text())]
observations=[]
for ti,trace in enumerate(traces):
 for i,row in enumerate(trace):
  if row['alive'] and not (i+1<len(trace) and not trace[i+1]['alive']):continue
  poses={};verts=[]
  for bone in native['bones']:
   pose=local(row['bones'][bone['name']]);
   if bone['parent'] is not None:pose=poses[bone['parent']]@pose
   poses[bone['name']]=pose
  for p in native['parts']:
   inv=np.eye(4);inv[:3,3]=-np.array(next(x['pos'] for x in native['bones'] if x['name']==p['name']))
   v=np.array(p['positions']).reshape(-1,3);verts.append(np.column_stack([v,np.ones(len(v))])@(poses[p['name']]@inv).T)
  observations.append((ti,row,np.vstack(verts)))
lo=np.min([v[:,:3].min(0) for _,_,v in observations],axis=0);hi=np.max([v[:,:3].max(0) for _,_,v in observations],axis=0);corners=np.array([[x,y,z,1] for x in [lo[0],hi[0]] for y in [lo[1],hi[1]] for z in [lo[2],hi[2]]])
rows=[]
for ti,r,v in observations:
 w=np.array(r['world']).reshape(4,4).T;mesh=float((v@w.T)[:,1].min());box=float((corners@w.T)[:,1].min());rows.append({'capture':ti,'frame':r['frame'],'gameTime':r['gameTime'],'meshMinimum':mesh-900,'boxMinimum':box-900,'supportGap':mesh-box})
res={'scope':'Sampled union of exact two captured corpse sequences plus last living pose, NOT a complete dense animation admission envelope. Fixed-orientation support gaps assume vertical translation only, not a prediction of new physics orientation.','minimum':lo.tolist(),'maximum':hi.tolist(),'center':((lo+hi)/2).tolist(),'halfExtents':((hi-lo)/2).tolist(),'observations':len(rows),'maximumSupportGap':max(r['supportGap'] for r in rows),'worstGap':max(rows,key=lambda r:r['supportGap']),'newWorstPenetrationFrame':next(r for r in rows if r['capture']==1 and r['frame']==449),'rows':rows}
p=pathlib.Path('tmp/bellback-anatomy3-full-combat/sampled-box-support.json');p.write_text(json.dumps(res,indent=2)+'\n');print(json.dumps({k:v for k,v in res.items() if k!='rows'},indent=2))
