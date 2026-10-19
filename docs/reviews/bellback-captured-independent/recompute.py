"""Read-only independent weighted-original-vertex reconstruction of captured poses."""
import json,pathlib,hashlib,sys
import numpy as np
base=pathlib.Path('art/driftwood-isle/lowpoly-bellback/runtime-admission')
cap=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2])
native=json.loads((base/'visual/frame2-native/bellback-v6-native.json').read_text())
meshes=json.loads((base/'visual/frame2-native/mesh-map.json').read_text())
def matrix(v):
 x,y,z,w=v[3:];assert abs(np.linalg.norm(v[3:])-1)<1e-5
 m=np.eye(4);m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,3]=v[:3];return m
parts=[]
for p in native['parts']:
 v=np.array(p['positions']).reshape(-1,3);w=np.array(p['skinWeights']).reshape(-1,4);ids=np.array(p['skinIndices']).reshape(-1,4).astype(int)
 assert np.allclose(w.sum(1),1) and np.all(w>=0)
 # Independently verify the rigid-weight specialization, but calculate weighted skinning below.
 assert np.all(w[:,0]==1) and np.all(w[:,1:]==0)
 parts.append((p['name'],np.column_stack([v,np.ones(len(v))]),w,ids))
results={}
for kind in ['render']:
 path=cap/f'{kind}-trace.json';trace=json.loads(path.read_text());rows=[];worst=None
 for r in trace:
  root=np.array(r['world'] if kind=='render' else r['root']).reshape(4,4).T;poses={};ts=[]
  for b in native['bones']:
   m=matrix(r['bones'][b['name']]);poses[b['name']]=m if b['parent'] is None else poses[b['parent']]@m
   inv=np.eye(4);inv[:3,3]=-np.array(b['pos']);ts.append(root@poses[b['name']]@inv)
  lows={};below={}
  for name,v,w,ids in parts:
   points=np.zeros_like(v)
   for slot in range(4):
    for joint in np.unique(ids[:,slot][w[:,slot]!=0]):
     mask=(ids[:,slot]==joint)&(w[:,slot]!=0);points[mask]+=(v[mask]@ts[joint].T)*w[mask,slot,None]
   h=points[:,1]-900;lows[name]=float(h.min());below[name]=int((h<-.005).sum())
   if worst is None or lows[name]<worst['minimum']:
    i=int(h.argmin());worst={'minimum':lows[name],'frame':r['frame'],'gameTime':r['gameTime'],'phase':r.get('phase'),'scenario':r['scenario'],'part':name,'vertex':i,'position':points[i,:3].tolist(),'meshes':[m['name'] for m in meshes if m['joint']==name and m['vertexStart']<=i<m['vertexStart']+m['vertexCount']]}
  rows.append({'frame':r['frame'],'time':r['gameTime'],'scenario':r['scenario'],'phase':r.get('phase'),'alive':r.get('alive',False),'deathT':r['deathT'],'state':r.get('state') if kind=='fixed' else (r.get('ragdoll') or {}).get('state'),'minimum':min(lows.values()),'parts':lows,'below':below})
 summaries={}
 for scenario in sorted(set(r['scenario'] for r in rows)):
  rr=[r for r in rows if r['scenario']==scenario];dead=[r for r in rr if not r['alive']];frozen=[r for r in dead if r['state']=='frozen']
  summaries[scenario]={'count':len(rr),'frameRange':[rr[0]['frame'],rr[-1]['frame']],'gameRange':[rr[0]['time'],rr[-1]['time']],'minimum':min(r['minimum'] for r in rr),'penetrating':sum(r['minimum']<-.005 for r in rr),'deadCount':len(dead),'frozenCount':len(frozen),'frozenMinRange':[min(r['minimum'] for r in frozen),max(r['minimum'] for r in frozen)] if frozen else None,'partMinimum':{n:min(r['parts'][n] for r in rr) for n,_,_,_ in parts}}
 results[kind]={'traceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rows':rows,'worst':worst,'summary':summaries}
result={'method':'Independent NumPy weighted original vertices: validate weights, quaternion normalization, hierarchy, inverse bind translations and captured world matrix. Floor900. Negative tolerance5mm. Render-only geometry, including living, transient and frozen states. Fixed physics geometry is evaluated separately through captured actual shape world transforms.','originalSha256':hashlib.sha256((base/'visual/frame2-native/bellback-v6-native.json').read_bytes()).hexdigest(),'vertices':sum(len(p[1]) for p in parts),'results':results}
out.write_text(json.dumps(result,separators=(',',':'))+'\n')
print(json.dumps({k:{x:y for x,y in v.items() if x!='rows'} for k,v in results.items()},indent=2))
