"""Read-only reconstruction of the pinned V6 loft helper and source topology."""
import hashlib
import json
import math
from pathlib import Path
HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[1] / 'build_bellback_v6.py'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == '952a8ddca0991a5aaaf1044d3a0498626567d6805881b77e43450c65f1e90a1d'
def sub(a,b): return [x-y for x,y in zip(a,b)]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(v): return [x/math.sqrt(dot(v,v)) for x in v]
def reconstruct(rows,n):
    vertices=[]; axes=[]
    for j,(c,w,h) in enumerate(rows):
        t=norm(sub(rows[min(len(rows)-1,j+1)][0],rows[max(0,j-1)][0]));u=cross(t,[0,1,0])
        if math.sqrt(dot(u,u))<.01:u=cross(t,[0,0,1])
        u=norm(u);v=norm(cross(t,u));axes.append(u)
        for i in range(n):
            q=[c[k]+u[k]*w*math.cos(math.tau*i/n)+v[k]*h*math.sin(math.tau*i/n) for k in range(3)]
            vertices.append([q[0],q[2],-q[1]])
    quads=[[j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i] for j in range(len(rows)-1) for i in range(n)]
    return vertices,quads,axes
specs={'Barrel timber hull':([((0,-.86,1.27),.77,.43),((0,0,1.34),.94,.59),((0,.92,1.23),.80,.49),((0,1.32,1.15),.46,.31)],8),
       'Lower timber jaw':([((0,-1.14,.68),.30,.14),((0,-1.63,.61),.26,.12),((0,-1.84,.75),.13,.075)],5),
       'Crown tie':([(p,.075,.075) for p in [(-.17,-.11,3.18),(0,-.17,3.30),(.18,-.11,3.19),(.15,.20,3.15),(-.17,.20,3.18),(-.17,-.11,3.18)]],6)}
report={'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceModified':False,'meshes':[]}
caveats=json.loads((HERE.parent/'source-normal-caveats.json').read_text())
for name,(rows,n) in specs.items():
    vs,quads,axes=reconstruct(rows,n); triangles=[]
    if name == "Lower timber jaw":
        for p in vs:p[2]=.65+(p[2]-.65)*.86
    for bad in caveats['opposedTriangles']:
        if bad['name']!=name:continue
        ids=[]
        for p in bad['positions']:
            distances=[math.dist(p,v) for v in vs]; nearest=min(range(len(vs)),key=distances.__getitem__)
            assert distances[nearest]<2e-6,(name,p,distances[nearest]);ids.append(nearest)
        candidates=[i for i,q in enumerate(quads) if set(ids)<=set(q)]
        # Crown's coincident start/end ring has distinct indices; proximity ambiguity is disclosed if present.
        triangles.append({'primitive':bad['primitive'],'triangle':bad['triangle'],'reconstructedVertexIds':ids,'sourceSidePolygonCandidates':candidates,'ringSpans':[[i//n,i//n+1] for i in candidates]})
    report['meshes'].append({'name':name,'ringU':axes,'adjacentUDot':[dot(a,b) for a,b in zip(axes,axes[1:])],'triangles':triangles})
assert sum(len(m['triangles']) for m in report['meshes'])==14
print(json.dumps(report,indent=2))
