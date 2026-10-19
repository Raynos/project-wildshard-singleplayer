"""Read-only pinned-source reconstruction. No Blender or repair output."""
import hashlib
import json
import math
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import export_native as bridge

def sub(a,b): return [x-y for x,y in zip(a,b)]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(v): return [x/math.sqrt(dot(v,v)) for x in v]

def analyze():
    assert bridge.sha(bridge.SOURCE.read_bytes()) == bridge.SOURCE_SHA
    assert bridge.sha(bridge.GLB.read_bytes()) == bridge.GLB_SHA
    name='Shin growth -1'; seed=sum((i+1)*ord(c) for i,c in enumerate(name))
    length=.84+(seed%5)*.075;spread=.78+((seed//7)%5)*.09;lean=((seed%7)-3)*.035
    c,s=math.cos(-1.3),math.sin(-1.3)
    def world(p):
        x,y,z=p;x*=spread;y*=length
        return [-1.01+.68*(x*c-y*s),-.23+.68*(x*s+y*c),1.02+.68*(z+x*lean)]
    points=[world(p) for p in [(-.31,.15,-.16),(-.12,.02,.02),(.20,-.15,-.09)]]
    sizes=[(.09*.68,.08*.68),(.13*.68,.10*.68),(.07*.68,.06*.68)]
    shape=[(1,.12),(.46,.95),(-.60,.83),(-1,-.12),(-.36,-1),(.55,-.72)]
    vertices=[];frames=[]
    for i,(point,(width,depth)) in enumerate(zip(points,sizes)):
        t=norm(sub(points[min(i+1,2)],points[max(i-1,0)])); switched=abs(t[1])>.94
        guide=[1,0,0] if switched else [0,1,0]
        u=norm(cross(guide,t));v=norm(cross(t,u))
        frames.append(dict(ring=i,tangent=t,guide=guide,u=u,guideSwitched=switched))
        for x,y in shape:
            p=[point[k]+u[k]*x*width+v[k]*y*depth for k in range(3)]
            vertices.append([p[0],p[2],-p[1]])
    doc,binary=bridge.parse_glb(bridge.GLB.read_bytes());node=doc['nodes'][81]
    assert node['name']==name+' living seam'
    observed=set()
    for prim in doc['meshes'][node['mesh']]['primitives']:
        observed.update(bridge.accessor(doc,binary,prim['attributes']['POSITION']))
    errors=[min(math.dist(p,q) for q in observed) for p in vertices]
    assert len(observed)==18 and max(errors)<2e-6
    caveats=json.loads((HERE.parent/'source-normal-caveats.json').read_text())
    quads=[[k*6+j,k*6+(j+1)%6,(k+1)*6+(j+1)%6,(k+1)*6+j] for k in range(2) for j in range(6)]
    bad=[]
    for row in caveats['opposedTriangles']:
        ids=[min(range(18),key=lambda i:math.dist(vertices[i],p)) for p in row['positions']]
        faces=[i for i,q in enumerate(quads) if set(ids)<=set(q)]
        assert len(faces)==1
        bad.append(dict(primitive=row['primitive'],triangle=row['triangle'],vertexIds=ids,sidePolygon=faces[0],ringSpan=[faces[0]//6,faces[0]//6+1],cosine=min(row['normalCosines'])))
    costs=[]
    for ring in range(2):
        shifts=[sum(math.dist(vertices[ring*6+j],vertices[(ring+1)*6+(j+shift)%6])**2 for j in range(6)) for shift in range(6)]
        costs.append(dict(ringSpan=[ring,ring+1],sumSquaredConnectorLengthsByShift=shifts,bestShift=min(range(6),key=shifts.__getitem__)))
    return dict(schema='wildshard.colossus.seam-analysis.v1',sourceSha256=bridge.SOURCE_SHA,glbSha256=bridge.GLB_SHA,
        node=81,name=node['name'],frames=frames,adjacentUDot=[dot(a['u'],b['u']) for a,b in zip(frames,frames[1:])],
        reconstructedVertices=18,maxVertexReconstructionError=max(errors),opposedTriangles=bad,correspondenceCosts=costs,
        interpretation='Read-only correspondence evidence. Shortest connectors do not prove an acceptable repair; preserve caps, points, material ownership and inspect real-host matched pairs first.',
        geometryChanged=False,repairSelected=False,runtimeAdmitted=False)

if __name__=='__main__': print(json.dumps(analyze(),indent=2))
