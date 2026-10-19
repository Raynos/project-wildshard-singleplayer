"""Exact pose-following compound comparison, analytical only; no physics edits."""
import json,pathlib,itertools,hashlib
import numpy as np
from scipy.spatial import ConvexHull
H=pathlib.Path('docs/reviews/bellback-corpse-shape-study');B=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission')
n=json.loads((B/'visual/frame2-native/bellback-v6-native.json').read_text());dense=json.loads((H/'dense-poses.json').read_text());traces=[json.loads((B/f'arena-candidate3/{x}/render-trace.json').read_text()) for x in ['build1','full-combat1']]
def matrix(v):
 x,y,z,w=v[3:];return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),v[0]],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),v[1]],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),v[2]],[0,0,0,1]])
parts=[]
for p in n['parts']:
 origin=np.array(next(b['pos'] for b in n['bones'] if b['name']==p['name']));v=np.array(p['positions']).reshape(-1,3)-origin;h=ConvexHull(v);assert np.max(v@h.equations[:,:3].T+h.equations[:,3])<1e-6
 parts.append((p['name'],v,v[h.vertices],np.array(list(itertools.product(*zip(v.min(0),v.max(0)))))))
def clouds(r):
 mats={};out=[[],[],[]]
 for b in n['bones']:
  m=matrix(r['bones'][b['name']]);mats[b['name']]=m if b['parent'] is None else mats[b['parent']]@m
 for name,*shapes in parts:
  m=mats[name]
  for dst,p in zip(out,shapes):dst.append(p@m[:3,:3].T+m[:3,3])
 return [np.concatenate(a) for a in out]
rows=[]
for cap,trace in enumerate(traces):
 for i,r in enumerate(trace):
  if r['alive'] and not(i+1<len(trace) and not trace[i+1]['alive']):continue
  verts,hull,box=clouds(r);normal=np.array(r['world']).reshape(4,4).T[1,:3];m=float((verts@normal).min());rows.append({'capture':cap,'frame':r['frame'],'hullGap':m-float((hull@normal).min()),'boxGap':m-float((box@normal).min())})
assert max(abs(r['hullGap']) for r in rows)<1e-9
# A joint's rigid transform maps its bind convex hull exactly, for all orientations and times, not merely sampled ones.
recipe={'proposalOnly':True,'rigidCorpse':{'parts':[{'bone':name,'points':p.tolist()} for name,_,p,_ in parts]}}
(H/'posed-parts-proposal.json').write_text(json.dumps(recipe,separators=(',',':'))+'\n')
result={'acceptance':False,'parts':len(parts),'pointsPerPart':[len(p[2]) for p in parts],'totalPoints':sum(len(p[2]) for p in parts),'maximumObservedHullGap':max(abs(r['hullGap']) for r in rows),'maximumObservedBoneBoxGap':max(r['boxGap'] for r in rows),'oldFrozenBoxGap':next(r['boxGap'] for r in reversed(rows) if r['capture']==0),'frame449BoxGap':next(r['boxGap'] for r in rows if r['capture']==1 and r['frame']==449),'scope':'Exact rigid part hulls retain identical support in every direction at the SAME posed transforms, by convex-hull support identity; does not establish runtime publication clocks, contact, solver stability, render interpolation, slope behavior or pose-change impulses.','rows':rows}
(H/'posed-parts-results.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='rows'},indent=2))
