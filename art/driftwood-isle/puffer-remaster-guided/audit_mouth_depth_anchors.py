"""Read-only comparison of authored mouth controls with actual native surfaces."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
D=Path(__file__).resolve().parent
source=ROOT/'art/driftwood-isle/approved-puffer/unaccepted-native-v71.json'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='e3f5f018bd11c6e58cdbafb5af69440336d257192360d7e46339162a61701338'
native=json.loads(source.read_text());inventory=json.loads((D/'v71-facial-component-inventory.json').read_text())
part=next(p for p in native['parts'] if p['name']=='Dark recessed palate')
components=next(p for p in inventory['parts'] if p['name']==part['name'])['components']
raw=part['positions']
def triangle(fi):return [(raw[fi*9+k],raw[fi*9+k+2],raw[fi*9+k+1]) for k in (0,6,3)]
def front_depth(x,z,triangles):
 hits=[]
 for tri in triangles:
  a,b,c=tri;det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
  if abs(det)<1e-12:continue
  u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det
  v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det;w=1-u-v
  if min(u,v,w)>=-1e-6:hits.append(u*a[1]+v*b[1]+w*c[1])
 return max(hits) if hits else None
result={'nativeSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'coordinates':'Blender x,y,z after stance','components':{}}
for count,name in [(36,'arch'),(56,'lowerLip'),(4,'beakTip'),(7,'palate')]:
 c=next(c for c in components if c['triangleCount']==count);tris=[triangle(i) for i in c['faceIds']]
 result['components'][name]={'faceIds':c['faceIds'],'vertices':sorted(set(p for tri in tris for p in tri)),'boundsMin':c['boundsMin'],'boundsMax':c['boundsMax']}
 if name=='arch':arch=tris
 if name=='lowerLip':lip=tris
controls=[('archCenter',(0,.910,.975)),('archShoulder',(.16,.860,.868)),('archInnerTurn',(.095,.895,.897)),('archOuter',(.215,.805,.758)),('lowerCenter',(0,.908,.636))]
result['failedFittedControls']=[]
for name,p in controls:
 depth=front_depth(p[0],p[2],lip if name.startswith('lower') else arch)
 result['failedFittedControls'].append({'name':name,'point':p,'oldFrontSurfaceY':depth,'forwardDelta':None if depth is None else p[1]-depth})
result['conclusion']='The fitted ridge exceeded the actual old arch/lip depth envelope. Use old triangular surface depths and a connected collar inside its projected silhouette; do not flatten all controls to a forward plane.'
(D/'mouth-actual-depth-anchors.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result['failedFittedControls'],indent=2))
