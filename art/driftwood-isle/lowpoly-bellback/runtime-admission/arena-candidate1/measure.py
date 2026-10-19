"""Reproduce core-only dimensions and rigid-leg contact support from preserved Frame2."""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[5]
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'visual/frame2-native'
a=json.loads((SOURCE/'bellback-v6-native.json').read_text()); meshes=json.loads((SOURCE/'mesh-map.json').read_text()); meta=json.loads((SOURCE/'metadata.json').read_text())
def points(name):
 m=next(x for x in meshes if x['name']==name);p=next(x for x in a['parts'] if x['name']==m['joint'])['positions'];p=p[m['vertexStart']*3:(m['vertexStart']+m['vertexCount'])*3];return [p[i:i+3] for i in range(0,len(p),3)]
def bounds(p):return [[min(x[i] for x in p),max(x[i] for x in p)] for i in range(3)]
def hull(points):
 p=sorted(set(points));cross=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]); out=[]
 for seq in [p,p[::-1]]:
  h=[]
  for x in seq:
   while len(h)>=2 and cross(h[-2],h[-1],x)<=0:h.pop()
   h.append(x)
  out+=h[:-1]
 return out
core=points('Barrel timber hull'); head=points('Solid timber cranium'); by=a['bones'][0]['pos'][1]
r=max(math.hypot(x,y-by) for x,y,z in core);hl=max(max(0,abs(z)-math.sqrt(max(0,r*r-x*x-(y-by)**2))) for x,y,z in core)
# Native capsule endpoints are +/- half length, with separate radius. Contain core conservatively, exclude frame/horns/feet.
dims=dict(meta['bodies'][0]['dims']);dims.update(bodyRadius=r,bodyHalfLen=hl,headRadius=max(math.dist(p,a['bones'][1]['pos']) for p in head),halfWidth=.94)
assert all(math.sqrt(x*x+(y-by)**2+max(0,abs(z)-hl)**2)<=r+1e-9 for x,y,z in core)
contacts=[]
for bone in a['bones'][4:]:
 part=next(p for p in a['parts'] if p['name']==bone['name']);p=part['positions'];contacts.append({'name':bone['name'],'rest':bone['pos'],'yzHull':hull([(p[i+1]-bone['pos'][1],p[i+2]-bone['pos'][2]) for i in range(0,len(p),3)])})
report={'schema':'wildshard.bellback.core-measurement.v1','colliderAcceptance':False,'dimensions':dims,'coreMesh':'Barrel timber hull','coreBounds':bounds(core),'headMesh':'Solid timber cranium','headBounds':bounds(head),'excluded':['carrier','rope','bell','horns','feet'],'method':'maximum core radial XY distance at body rest Y; minimal symmetric capsule half-length at measured radial radius; head core sphere about actual joint. Conservative core containment, not physical gameplay acceptance.','legContacts':contacts,'worldCorpseContactAccepted':False}
(HERE/'dimension-measurement.json').write_text(json.dumps(report,indent=2)+'\n');meta['bodies'][0]['dims']=dims;(HERE/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps({'dimensions':dims,'legHullCounts':[len(x['yzHull']) for x in contacts]}))
