"""Read-only hull diagnosis; writes only its report beside this script.
Independent plane-slice/interval test, not the original edge-ray predicate.
Run: python docs/reviews/puffer-hull-crossing-diagnosis/diagnose.py
"""
import hashlib,json
from collections import defaultdict
from pathlib import Path
import numpy as np
HOME=Path(__file__).resolve().parent
ROOT=HOME.parents[2]
ART=ROOT/'art/driftwood-isle'
PATHS={'v71':ART/'approved-puffer/unaccepted-native-v71.json','pass2':ART/'puffer-complete-remaster/pass2/pass2-native.json','selected':ART/'puffer-complete-remaster/closed-anatomy-study/closed-anatomy-native.json'}
def bary(p,t):
 a,b=t[1]-t[0],t[2]-t[0];v=p-t[0]
 q=np.linalg.lstsq(np.stack([a,b],axis=1),v,rcond=None)[0]
 return np.array([1-q.sum(),*q])
def crossing(a,b):
 na=np.cross(a[1]-a[0],a[2]-a[0]);na/=np.linalg.norm(na)
 nb=np.cross(b[1]-b[0],b[2]-b[0]);nb/=np.linalg.norm(nb)
 direction=np.cross(na,nb);ln=np.linalg.norm(direction)
 if ln<1e-10:return None
 direction/=ln
 def section(t,n,p):
  d=(t-p)@n
  if min(d)>1e-10 or max(d)<-1e-10:return None
  pts=[]
  for k in range(3):
   j=(k+1)%3
   if abs(d[k])<1e-11:pts.append(t[k])
   if d[k]*d[j]<0:pts.append(t[k]+(t[j]-t[k])*d[k]/(d[k]-d[j]))
  if len(pts)<2:return None
  ss=np.array(pts)@direction
  return float(min(ss)),float(max(ss)),pts[0]
 sa=section(a,nb,b[0]);sb=section(b,na,a[0])
 if sa is None or sb is None:return None
 lo=max(sa[0],sb[0]);hi=min(sa[1],sb[1])
 if hi-lo<1e-9:return None
 mid=sa[2]+direction*((lo+hi)/2-sa[2]@direction)
 ba,bb=bary(mid,a),bary(mid,b)
 if min(ba)<1e-8 or min(bb)<1e-8:return None
 endpoints=[sa[2]+direction*(s-sa[2]@direction) for s in (lo,hi)]
 return {'length':hi-lo,'midpoint':mid.tolist(),'endpoints':[p.tolist() for p in endpoints],'barycentricMidpoint':[ba.tolist(),bb.tolist()],'normalCrossLength':ln}
def audit(t):
 lo=t.min(1);hi=t.max(1);hits=[]
 for i,a in enumerate(t):
  js=np.where((np.arange(len(t))>i)&np.all(hi>=lo[i]-1e-10,axis=1)&np.all(lo<=hi[i]+1e-10,axis=1))[0]
  for j in js:
   result=crossing(a,t[j])
   if result:
    result.update(faces=[i,int(j)],sharedVertices=len(set(map(tuple,a))&set(map(tuple,t[j]))));hits.append(result)
 return hits
report={'method':'Independent normalized plane slices and line interval overlap; midpoint strictly interior to both triangles. Shared-vertex pairs tested too. Coplanar pairs excluded. Native +Y up/+Z face; zero-based IDs.'}
arrays={}
for name,path in PATHS.items():
 raw=path.read_bytes();data=json.loads(raw);t=np.array(data['parts'][0]['positions'][:9198]).reshape(-1,3,3);arrays[name]=t
 hits=audit(t);report[name]={'source':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest(),'crossings':hits}
 print(name,len(hits),[h['faces'] for h in hits],flush=True)
t=arrays['selected'];ids=sorted({i for h in report['selected']['crossings'] for i in h['faces']});verts=[];lookup={};fids=[];uses=defaultdict(list)
for fi,face in enumerate(t):
 row=[]
 for corner,p in enumerate(face):
  key=tuple(p)
  if key not in lookup:lookup[key]=len(verts);verts.append(p)
  vi=lookup[key];row.append(vi);uses[vi].append([fi,corner])
 fids.append(row)
report['affectedFaces']=[{'face':i,'weldedVertexIds':fids[i],'positionsArrayOffsets':[9*i+3*k for k in range(3)],'coordinates':t[i].tolist(),'v71Coordinates':arrays['v71'][i].tolist(),'pass2Coordinates':arrays['pass2'][i].tolist()}for i in ids]
report['affectedVertices']=[{'vertexId':i,'coordinate':verts[i].tolist(),'allFaceCorners':uses[i]}for i in sorted({v for fi in ids for v in fids[fi]})]
report['selectedFloat32Crossings']=audit(t.astype(np.float32).astype(float))
(HOME/'diagnosis.json').write_text(json.dumps(report,indent=2)+'\n')
