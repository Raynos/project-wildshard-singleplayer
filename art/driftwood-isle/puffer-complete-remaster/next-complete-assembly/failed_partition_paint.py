"""Semantic partition last: conditional planar regions, exact source correspondence.
Each output vertex lies on its explicit source carrier triangle. No deformation
of painted triangle soup and no inverse-weld reconstruction.
"""
import copy,hashlib,json,sys
from pathlib import Path
from collections import Counter
import numpy as np
from geometry_tools import component_ids,ordered_indexed,topology
H=Path(__file__).resolve().parent;A=H.parents[1]
sys.path.insert(0,str(A/'puffer-remaster-guided'))
from paint_semantic_face_diagonal_robust import COLORS,area,clip

def build():
 n=json.loads((H/'prepaint-native.json').read_text());result=copy.deepcopy(n);body=n['parts'][0];tri=np.array(body['positions']).reshape(-1,3,3);v,f=ordered_indexed(tri);core=set(component_ids(f)[0]);ownership=json.loads((H/'surface-ownership.json').read_text())['carrierFaces'];out={k:[] for k in ('positions','colorsLinear','skinIndices','skinWeights','furLen')};out['name']=body['name'];counts=Counter();area_drift=0.;maps=[]
 # Same physically authored hood boundary as the retained guided semantics.
 original=json.loads((A/'puffer-remaster-guided/seated-mouth-diagnostic-native.json').read_text());ov=np.array(original['parts'][0]['positions']).reshape(-1,3);candidates=ov[ov[:,0]>0];hood=[]
 for x,y in [(.19,.8944),(.46,.958),(.435,1.020),(.205,.954)]:
  p=min(candidates,key=lambda p:(p[0]-x)**2+(p[1]-y)**2);hood.append((p[0],p[1]))
 canonical={tuple(round(float(x),11)for x in p):tuple(p) for p in tri.reshape(-1,3)}
 def canon(p):
  # Exact shared arithmetic can differ by ulps on opposite directed edges.
  # Canonical keys retain the first surface intersection, measured in audit.
  key=tuple(round(float(x),11)for x in p)
  if key not in canonical:canonical[key]=tuple(float(x)for x in p)
  return canonical[key]
 def split(poly,plane):
  d=[plane(p) for p in poly]
  if min(d)>=-1e-12:return poly,[]
  if max(d)<=1e-12:return [],poly
  # Dedicated exact plane interpolation, no 1e-7 classification displacement.
  def half(sign):
   out=[]
   for p,q,dp,dq in zip(poly,poly[1:]+poly[:1],d,d[1:]+d[:1]):
    ip=sign*dp>=0;iq=sign*dq>=0
    if ip:out.append(p)
    if ip!=iq:
     t=dp/(dp-dq);out.append(tuple(a+(b-a)*t for a,b in zip(p,q)))
   clean=[]
   for p in out:
    if not clean or np.linalg.norm(np.array(p)-clean[-1])>1e-12:clean.append(p)
   if len(clean)>1 and np.linalg.norm(np.array(clean[0])-clean[-1])<1e-12:clean.pop()
   return clean if len(clean)>=3 else []
  return half(1),half(-1)
 def take(polys,planes):
  inside=polys;outside=[]
  for plane in planes:
   nxt=[]
   for poly in inside:
    a,b=split(poly,plane)
    if a:nxt.append(a)
    if b:outside.append(b)
   inside=nxt
  return inside,outside
 for fi,t in enumerate(tri):
  if fi not in core:
   for key,stride in [('positions',9),('colorsLinear',9),('skinIndices',12),('skinWeights',12),('furLen',3)]:out[key].extend(body[key][fi*stride:(fi+1)*stride])
   maps.append({'carrierFace':fi,'region':'retained-component'});continue
  src=ownership[fi]['sourceFace'];patch=ownership[fi]['patch'];polys=[list(map(tuple,t))];regions=[]
  if 1003<=src<1051 or 1094<=src<1142 or (patch and patch.startswith('orbital-back-wall')):
   regions=[('socket',polys)];polys=[]
  else:
   # Hood polygons separated across the nose, never a whole orange ribbon.
   for side in [-1,1]:
    xy=np.array(hood);sgn=1 if sum(a[0]*b[1]-a[1]*b[0]for a,b in zip(xy,np.roll(xy,-1,axis=0)))>0 else -1
    planes=[lambda p:p[2]-.10000000149011612]
    for a,b in zip(xy,np.roll(xy,-1,axis=0)):
     planes.append(lambda p,a=a,b=b,s=side,k=sgn:k*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(s*p[0]-a[0])))
    yes,polys=take(polys,planes);regions.append(('ochre',yes))
   # Split along symmetry only where needed for the absolute-x fields.
   positive,negative=take(polys,[lambda p:p[0]]);polys=[]
   for side,half in [(1,positive),(-1,negative)]:
    cream=[lambda p:p[2]-.10000000149011612,lambda p,s=side:.82-.20*s*p[0]+.05*p[2]-p[1],lambda p,s=side:.73-.40*s*p[0]+.35*p[2]-p[1]]
    yes,rest=take(half,cream);regions.append(('ivory',yes))
    ochre=[lambda p:p[2]-.10000000149011612,lambda p,s=side:p[2]-.16-.45*s*p[0]-.25*p[1],lambda p,s=side:.96+.12*s*p[0]-.02*p[2]-p[1],lambda p:p[1]-.60]
    yes,rest=take(rest,ochre);regions.append(('ochre',yes));regions.append(('teal',rest))
  total=0
  for region,polygons in regions:
   for poly in polygons:
    ps=[canon(p) for p in poly]
    for j in range(1,len(ps)-1):
     tr=[ps[0],ps[j],ps[j+1]];ar=area(tr)
     if ar<1e-14:continue
     total+=ar;counts[region]+=1;maps.append({'carrierFace':fi,'sourceFace':src,'region':region})
     for p in tr:
      out['positions'].extend(p);out['colorsLinear'].extend(COLORS[region]);out['skinIndices'].extend([1,0,0,0]);out['skinWeights'].extend([1,0,0,0]);out['furLen'].append(0)
  drift=abs(total-area(t));area_drift=max(area_drift,drift)
  assert drift<max(1e-10,area(t)*1e-7),(fi,drift)
 # Conform semantic edge vertices across source-triangle interfaces, including
 # cavity boundaries where one side deliberately carries a single flat color.
 ts=np.array(out['positions']).reshape(-1,3,3);uv=np.unique(ts.reshape(-1,3),axis=0);rebuilt={k:[] for k in ('positions','colorsLinear','skinIndices','skinWeights','furLen')};rebuilt['name']=out['name'];newmaps=[];conformed=0
 for fi,t in enumerate(ts):
  polygon=[]
  for a,b in zip(t,np.roll(t,-1,axis=0)):
   delta=b-a;den=delta@delta;pars=(uv-a)@delta/den;distance=np.linalg.norm(uv-(a+pars[:,None]*delta),axis=1)
   indices=np.where((pars>1e-8)&(pars<1-1e-8)&(distance<1e-10))[0]
   polygon.append(a)
   polygon.extend(uv[j]for j in sorted(indices,key=lambda j:pars[j]))
  if len(polygon)==3:pieces=[t]
  else:
   center=t.mean(0);pieces=[[center,a,b]for a,b in zip(polygon,polygon[1:]+polygon[:1])];conformed+=1
  for tr in pieces:
   newmaps.append(maps[fi])
   for p in tr:
    rebuilt['positions'].extend(list(p));rebuilt['colorsLinear'].extend(out['colorsLinear'][fi*9:fi*9+3]);rebuilt['skinIndices'].extend(out['skinIndices'][fi*12:fi*12+4]);rebuilt['skinWeights'].extend(out['skinWeights'][fi*12:fi*12+4]);rebuilt['furLen'].append(0)
 out=rebuilt;maps=newmaps
 result['parts'][0]=out
 # Authored seated bill/ring semantic fields; inherited eye/palate remain exact.
 head=result['parts'][1]
 for fi in range(1005,1069):
  key='mouth'if 16<=fi-1005<32 else 'ivory';head['colorsLinear'][fi*9:(fi+1)*9]=list(COLORS[key])*3
 result['status']='UNACCEPTED next complete assembly; mandatory geometry gates govern review'
 (H/'candidate-native.json').write_text(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n')
 (H/'paint-receipt.json').write_text(json.dumps({'method':'Conditional halfspace semantic partition after explicit carrier construction','regionTriangles':dict(counts),'maximumPerCarrierTriangleAreaDrift':area_drift,'carrierTriangleCorrespondence':maps,'hoodPolygonXY':hood,'colorsLinear':COLORS,'bonesExact':result['bones']==n['bones'],'appendagesExact':result['parts'][2:]==n['parts'][2:]},separators=(',',':'))+'\n')
 print('painted',len(out['positions'])//9,'triangles',dict(counts),area_drift)
if __name__=='__main__':build()
