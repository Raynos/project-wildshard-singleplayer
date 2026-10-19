"""Pure Python editable forefin study; preserves every original root corner and pivot."""
import json, math, hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=HERE.parent/'approved-puffer/unaccepted-native-v71.json'
# Clockwise-looking native x/z perimeter: four broad, asymmetric terminal lobes.
OUTLINE=[(.30,-.02),(.30,.07),(.28,.14),(.25,.19),(.20,.205),(.16,.17),
 (.12,.225),(.065,.24),(.025,.19),(-.015,.24),(-.07,.23),(-.105,.18),
 (-.15,.215),(-.205,.195),(-.23,.135),(-.27,.10),(-.29,.045),(-.285,-.025),
 (-.26,-.08),(-.21,-.13),(-.14,-.16),(-.025,-.175),(.12,-.16),(.23,-.105)]
# Sample actual V71 flat region colors, without introducing a new palette.
def build():
 base=json.loads(BASE.read_text()); meshes=[];parts=[]
 for side,bone in [(1,'finL'),(-1,'finR')]:
  old=next(p for p in base['parts'] if p['name']=='Volumetric connected '+bone)
  pv=list(zip(*[iter(old['positions'])]*3)); top=max(v[1] for v in pv)
  roots=sorted(set(v for v in pv if v[1]==top),key=lambda v:math.atan2(v[2]-.22,side*v[0]-.33)%(2*math.pi))
  # Rotate zero-angle anchor first despite float32 epsilon.
  first=min(range(12),key=lambda i:abs(roots[i][2]-.22)+abs(side*roots[i][0]-.48))
  roots=roots[first:]+roots[:first]
  ring=[]
  for i,r in enumerate(roots):
   nxt=roots[(i+1)%12];ring.extend([list(r),[(a+b)/2 for a,b in zip(r,nxt)]])
  vertices=ring.copy(); n=24
  # Broad shoulder descends directly into a shared fan; no separate ankle/toes.
  for kind in ('shoulder','ochre','cream','sole'):
   for i,(dx,dz) in enumerate(OUTLINE):
    f={'shoulder':.64,'ochre':.83,'cream':1.,'sole':1.}[kind]
    x=.57+dx*f;z=.435+dz*f
    y={'shoulder':.19,'ochre':.085,'cream':.039,'sole':.004000000189989805}[kind]
    if kind=='shoulder':y+=.055*max(0,-dz/.175)
    if kind=='ochre':y+=.025*max(0,-dz/.175)
    vertices.append([side*x,y,z])
  faces=[];regions=[]
  def add(f,r):faces.append(list(f));regions.append(r)
  for j in range(4):
   for i in range(n):
    k=(i+1)%n;a=j*n+i;b=j*n+k;c=(j+1)*n+i;d=(j+1)*n+k
    region='teal' if j==0 else ('light' if j==1 else 'ochre' if j==2 else 'cream')
    # Ivory is one continuous edge over the shallow, joined terminal lobes.
    if j==2 and 2<=i<=14:region='cream'
    add((a,b,d),region);add((a,d,c),region)
  vertices.append([sum(r[0] for r in ring)/n,top,sum(r[2] for r in ring)/n]);rootcenter=len(vertices)-1
  vertices.append([side*.57,.004000000189989805,.435]);solecenter=len(vertices)-1
  for i in range(n):
   k=(i+1)%n;add((rootcenter,k,i),'teal');add((solecenter,4*n+i,4*n+k),'ochre')
  def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
  vol=sum(sum(a*b for a,b in zip(vertices[f[0]],cross(vertices[f[1]],vertices[f[2]])))for f in faces)/6
  if vol<0:faces=[f[::-1] for f in faces]
  # Exact baseline colors nearest the intended anatomical regions.
  targets={'teal':(.014,.131,.124),'light':(.028,.19,.17),'ochre':(.8,.30,.04),'cream':(.91,.72,.40)}
  colors=list(zip(*[iter(old['colorsLinear'])]*3));palette={name:list(min(colors,key=lambda c:sum((a-b)**2 for a,b in zip(c,t))))for name,t in targets.items()}
  mesh={'name':old['name'],'vertices':vertices,'triangles':faces,'faceRegions':regions,'paletteLinear':palette,'rootVertexIndices':list(range(n)),'originalRootCorners':[list(r)for r in roots],'bone':bone}
  meshes.append(mesh);part={'name':old['name'],'positions':[],'colorsLinear':[],'skinIndices':[],'skinWeights':[],'furLen':[]};bi=next(i for i,b in enumerate(base['bones'])if b['name']==bone)
  for f,r in zip(faces,regions):
   for idx in f:
    part['positions'].extend(vertices[idx]);part['colorsLinear'].extend(palette[r]);part['skinIndices'].extend([bi,0,0,0]);part['skinWeights'].extend([1.,0.,0.,0.]);part['furLen'].append(0.)
  parts.append(part)
 indexed={'schema':'wildshard.editable-forefin.v1','status':'unaccepted static anatomical study','baseSha256':hashlib.sha256(BASE.read_bytes()).hexdigest(),'coordinates':base['coordinates'],'integrationTransform':'identity; exact pivot and root polygon preserved; midpoint insertion only','meshes':meshes}
 native={**{k:base[k]for k in ['schema','coordinates','bones']},'status':'unaccepted forefin-only payload; not complete creature','parts':parts}
 return indexed,native
if __name__=='__main__':
 m,n=build();(HERE/'failed-first-fin-fans-indexed.json').write_text(json.dumps(m,indent=2)+'\n');(HERE/'failed-first-fin-native-study.json').write_text(json.dumps(n,separators=(',',':'))+'\n')
