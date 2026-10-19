"""Core-only candidate dimensions; never admits appearance, collider tuning or contact."""
import json, math
from pathlib import Path
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'v4-skin1'
a=json.loads((SOURCE/'colossus-v4-native.json').read_text()); meshes=json.loads((SOURCE/'mesh-map.json').read_text()); meta=json.loads((SOURCE/'metadata.json').read_text())
def points(name):
 m=next(x for x in meshes if x['name']==name);p=next(x for x in a['parts'] if x['name']==m['joint'])['positions'];p=p[m['vertexStart']*3:(m['vertexStart']+m['vertexCount'])*3];return [p[i:i+3] for i in range(0,len(p),3)]
def bounds(p):return [[min(x[i] for x in p),max(x[i] for x in p)] for i in range(3)]
names=['Crooked pelvic trunk','Left chest load root','Right chest load root','Rear diagonal trunk','Crossback lower root']
core=[p for name in names for p in points(name)];head=points('Long tapered bark mask');by=a['bones'][0]['pos'][1]
# Engine body capsule is centered on actor X/Z, not on the off-center root bind.
r=max(math.hypot(x,y-by) for x,y,z in core);hl=max(max(0,abs(z)-math.sqrt(max(0,r*r-x*x-(y-by)**2))) for x,y,z in core)
dims=dict(meta['bodies'][0]['dims']);dims.update(bodyRadius=r,bodyHalfLen=hl,headRadius=max(math.dist(p,a['bones'][1]['pos']) for p in head),halfWidth=max(abs(p[0]) for p in core))
assert all(math.sqrt(x*x+(y-by)**2+max(0,abs(z)-hl)**2)<=r+1e-8 for x,y,z in core)
report={'schema':'wildshard.colossus.core-measurement.v1','colliderAcceptance':False,'worldCorpseContactAccepted':False,'dimensions':dims,'coreMeshes':names,'coreBounds':bounds(core),'headMesh':'Long tapered bark mask','headBounds':bounds(head),'excluded':['crown','foliage','arms','digits','legs','feet','decorative root mantle'],'method':'Conservative capsule of named load-bearing trunk roots around actor X/Z and bodyY; head mask sphere about actual bind joint. Rest measurement only; weighted motion and actual world floor must be checked separately.'}
(HERE/'dimension-measurement.json').write_text(json.dumps(report,indent=2)+'\n');meta['bodies'][0]['dims']=dims;(HERE/'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(dims))
