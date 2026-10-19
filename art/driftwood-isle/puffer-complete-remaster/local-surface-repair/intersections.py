"""Independent full shared-vertex-aware predicate from source diagnosis, with no producer imports."""
import numpy as np
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
