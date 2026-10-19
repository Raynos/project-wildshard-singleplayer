"""Nonadjacent body-triangle transverse intersection diagnostic.
Coplanar overlap and intersections between intentionally overlapping parts are
outside this test. Neither exact-edge closure nor this diagnostic is a full
solid-geometry certification.
"""
import json
from pathlib import Path
import numpy as np
H=Path(__file__).resolve().parent
def audit(path):
 t=np.array(json.loads(path.read_text())['parts'][0]['positions'][:9198]).reshape(-1,3,3);lo=t.min(1);hi=t.max(1);hits=[]
 def segment(a,b,q):
  direction=b-a;e1=q[1]-q[0];e2=q[2]-q[0];h=np.cross(direction,e2);det=np.dot(e1,h)
  if abs(det)<1e-12:return False
  f=1/det;s=a-q[0];u=f*np.dot(s,h)
  if not 1e-7<u<1-1e-7:return False
  r=np.cross(s,e1);v=f*np.dot(direction,r);w=f*np.dot(e2,r)
  return v>1e-7 and u+v<1-1e-7 and 1e-7<w<1-1e-7
 for i,a in enumerate(t):
  js=np.where((np.arange(len(t))>i)&np.all(hi>=lo[i],axis=1)&np.all(lo<=hi[i],axis=1))[0]
  keys={tuple(v) for v in a}
  for j in js:
   b=t[j]
   if keys & {tuple(v) for v in b}:continue
   if any(segment(x,y,b) for x,y in zip(a,np.roll(a,-1,axis=0))) or any(segment(x,y,a) for x,y in zip(b,np.roll(b,-1,axis=0))):hits.append([i,int(j)])
 return hits
r={'method':'Strict transverse edge-through-triangle intersections; nonadjacent hull faces only; coplanar overlap excluded','pass2':audit(H.parent/'pass2/pass2-native.json'),'closedAnatomy':audit(H/'closed-anatomy-native.json')}
r['newCrossings']=[x for x in r['closedAnatomy'] if x not in r['pass2']]
(H/'crossing-audit.json').write_text(json.dumps(r,indent=2)+'\n');print(r)
