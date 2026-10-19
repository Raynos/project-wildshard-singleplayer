"""Independent rigid-vertex reconstruction of the exact full combat capture."""
import json, pathlib, hashlib
import numpy as np
BASE=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission')
OUT=pathlib.Path('tmp/bellback-anatomy3-full-combat')
native=json.loads((BASE/'visual/frame2-native/bellback-v6-native.json').read_text())
trace=json.loads((OUT/'render-trace.json').read_text())
reference=json.loads((OUT/'world-contact.json').read_text())
meshes=json.loads((BASE/'visual/frame2-native/mesh-map.json').read_text())
def local(v):
 x,y,z,w=v[3:];m=np.eye(4)
 m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
 m[:3,3]=v[:3];return m
parts=[]
for p in native['parts']:
 vertices=np.array(p['positions']).reshape(-1,3)
 weights=np.array(p['skinWeights']).reshape(-1,4);indices=np.array(p['skinIndices']).reshape(-1,4)
 joint=next(i for i,b in enumerate(native['bones']) if b['name']==p['name'])
 assert np.all(weights[:,0]==1) and np.all(weights[:,1:]==0) and np.all(indices[:,0]==joint)
 parts.append((p['name'],np.column_stack([vertices,np.ones(len(vertices))])))
rows=[];worst=None;max_error=0
for row,ref in zip(trace,reference['frames'],strict=True):
 world=np.array(row['world']).reshape(4,4).T;poses={};transforms={};lows={};below={}
 for b in native['bones']:
  pose=local(row['bones'][b['name']]);assert abs(np.linalg.norm(row['bones'][b['name']][3:])-1)<1e-6
  if b['parent'] is not None:pose=poses[b['parent']]@pose
  poses[b['name']]=pose;inv=np.eye(4);inv[:3,3]=-np.array(b['pos']);transforms[b['name']]=world@pose@inv
 for name,verts in parts:
  points=verts@transforms[name].T;heights=points[:,1]-900;lows[name]=float(heights.min());below[name]=int((heights<-.005).sum())
  if worst is None or lows[name]<worst['height']:
   indices=np.argsort(heights)[:12]
   worst={'frame':row['frame'],'gameTime':row['gameTime'],'height':lows[name],'part':name,'world':row['world'],'bones':row['bones'],'ragdoll':row['ragdoll'],'vertices':[{'index':int(i),'height':float(heights[i]),'worldPosition':points[i,:3].tolist(),'meshes':[m['name'] for m in meshes if m['joint']==name and m['vertexStart']<=i<m['vertexStart']+m['vertexCount']]} for i in indices]}
 max_error=max(max_error,max(abs(lows[p['name']]-p['minHeight']) for p in ref['parts']))
 rows.append({'frame':row['frame'],'gameTime':row['gameTime'],'alive':row['alive'],'deathT':row['deathT'],'minimum':min(lows.values()),'parts':lows,'below':below})
result={'schema':'wildshard.bellback.independent-full-combat-contact.v1','traceSha256':hashlib.sha256((OUT/'render-trace.json').read_bytes()).hexdigest(),'method':'Independent NumPy rigid-skin reconstruction; validates unit weights, quaternion normalization, hierarchy and bind translations. Ground Y900. Below means less than -5mm. No collider/contact acceptance.','frames':len(rows),'minimum':min(r['minimum'] for r in rows),'penetratingObservations':sum(r['minimum']<-.005 for r in rows),'maxDifferenceFromThreeMeasurement':max_error,'worst':worst,'rows':rows}
(OUT/'independent-contact.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print({k:v for k,v in result.items() if k not in ['rows','worst']});print(worst['vertices'][0])
