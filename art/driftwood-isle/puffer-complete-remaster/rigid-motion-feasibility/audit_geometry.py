"""Bounded source geometry gate. No app, native physics, or source mutation.
Run from repository root with Python/numpy/scipy. Hulls retain every Qhull extreme;
source vertices are not rounded, merged approximately, padded or decimated.
"""
import hashlib, json, math
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull

BASE = Path('art/driftwood-isle/puffer-complete-remaster/rigid-motion-feasibility')
OUT = Path('docs/reviews/puffer-rigid-motion-feasibility')
SOURCE = Path('art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/closed-anatomy-rig1-native.json')
source = json.loads(SOURCE.read_text())
P = np.concatenate([np.asarray(p['positions']).reshape(-1, 3) for p in source['parts']])
I = np.concatenate([np.asarray(p['skinIndices']).reshape(-1, 4) for p in source['parts']])
W = np.concatenate([np.asarray(p['skinWeights']).reshape(-1, 4) for p in source['parts']])
B = np.asarray([b['pos'] for b in source['bones']])
part_ranges = []; offset = 0
for part in source['parts']:
    count = len(part['positions']) // 3
    part_ranges.append((offset, offset + count, part['name'])); offset += count

def origin(index):
    for lo, hi, name in part_ranges:
        if lo <= index < hi: return {'part': name, 'partVertex': int(index - lo), 'sourceVertex': int(index)}
    raise ValueError(index)

def distance_to_surface(points):
    """Exact finite triangle primitive distance, evaluated at specified hull centroids."""
    triangles = P.reshape(-1, 3, 3)
    a,b,c = triangles[:,0], triangles[:,1], triangles[:,2]
    ab,ac = b-a,c-a
    nn = np.cross(ab,ac); n2 = np.einsum('ij,ij->i',nn,nn)
    d00 = np.einsum('ij,ij->i',ab,ab); d01=np.einsum('ij,ij->i',ab,ac); d11=np.einsum('ij,ij->i',ac,ac)
    denom=d00*d11-d01*d01
    result=[]
    for point in points:
        ap=point-a; plane=np.einsum('ij,ij->i',ap,nn)
        projected=ap-nn*np.divide(plane,n2,out=np.zeros_like(plane),where=n2>0)[:,None]
        d20=np.einsum('ij,ij->i',projected,ab);d21=np.einsum('ij,ij->i',projected,ac)
        u=np.divide(d11*d20-d01*d21,denom,out=np.full_like(denom,np.inf),where=denom>1e-24)
        v=np.divide(d00*d21-d01*d20,denom,out=np.full_like(denom,np.inf),where=denom>1e-24)
        inside=(u>=0)&(v>=0)&(u+v<=1)&(n2>0)
        dist=np.where(inside,np.divide(plane*plane,n2,out=np.full_like(n2,np.inf),where=n2>0),np.inf)
        for x,y in ((a,b),(b,c),(c,a)):
            e=y-x;e2=np.einsum('ij,ij->i',e,e)
            t=np.clip(np.divide(np.einsum('ij,ij->i',point-x,e),e2,out=np.zeros_like(e2),where=e2>0),0,1)
            d=point-x-t[:,None]*e;dist=np.minimum(dist,np.einsum('ij,ij->i',d,d))
        result.append(float(np.sqrt(dist.min())))
    return result

hulls={}; recipe={'parts':[]}; provenance=[]
for j,bone in enumerate(source['bones']):
    ids=np.flatnonzero(((I==j)&(W>0)).any(axis=1))
    if len(ids)==0: continue
    points, first=np.unique(P[ids],axis=0,return_index=True)
    h=ConvexHull(points);hulls[j]=h
    extreme_ids=ids[first[h.vertices]]
    recipe['parts'].append({'bone':bone['name'],'points':(points[h.vertices]-B[j]).tolist()})
    centers=points[h.simplices].mean(axis=1)
    gap=distance_to_surface(centers); k=int(np.argmax(gap))
    residual=float((points@h.equations[:,:3].T+h.equations[:,3]).max())
    provenance.append({'bone':bone['name'],'memberVertices':len(ids),'uniqueMemberPoints':len(points),'extremeCount':len(h.vertices),
        'volumeM3':float(h.volume),'maxBindContainmentResidualM':residual,
        'maxFacetCentroidToActualSurfaceM':gap[k], 'bridgeDiagnosticCentroid':centers[k].tolist(),
        'bridgeDiagnosticFacetVertices':[origin(int(ids[first[i]])) for i in h.simplices[k]],
        'extremeSources':[origin(int(i)) for i in extreme_ids]})

# Existing numeric gait in steady locomotion: stage0, no flinch, full gait,
# phase0, sin(t*2.4)=1. Unit-scale alternative at this input is identical to
# existing animation: no living attack inflation and deathT=0.
t=math.pi/4.8; phase=0.; speed=.6*.24/.62; bob=.03
translations={j:np.zeros(3) for j in hulls}
for j in range(3,7):
    name=source['bones'][j]['name']; q=(phase+(0 if name in ('finL','rearR') else .5))%1
    swing=max(0,min(1,(q-.62)/.38))
    forward=-.12+.24*swing*swing*(3-2*swing) if q>.62 else .12-.24*q/.62
    translations[j]=np.array([0,.06*math.sin(math.pi*swing)-bob,forward])
weighted=P.copy()
for j,d in translations.items():
    influence=np.where(I==j,W,0).sum(axis=1)
    weighted += influence[:,None]*d
# Common body bob cancels in membership; each hull's own translation is retained.
residuals=np.stack([((weighted-translations[j])@h.equations[:,:3].T+h.equations[:,3]).max(axis=1) for j,h in hulls.items()],axis=1)
union=residuals.min(axis=1); offenders=np.flatnonzero(union>1e-9)
witness=int(np.argmax(union))
report={
    'status':'FAIL: seven membership-derived hulls do not contain mixed cap skin at an unchanged steady gait input',
    'scope':'Source double-precision geometry only. No universal impossibility proof and no native/world-contact result.',
    'source':str(SOURCE),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'sourceVertexCount':len(P),'occupiedBones':len(hulls),'totalExtremePoints':sum(len(h.vertices) for h in hulls.values()),
    'budgetPass':len(hulls)<=8 and all(len(h.vertices)<=128 for h in hulls.values()) and sum(len(h.vertices) for h in hulls.values())<=512,
    'hulls':provenance,
    'pose':{'t':t,'phase':phase,'speed':speed,'stage':0,'clock':0,'deathT':0,'flinch':0,'allBoneScale':[1,1,1],
        'commonBodyBob':bob,'relativeTranslations':{source['bones'][j]['name']:d.tolist() for j,d in translations.items()},
        'rotation':'all identity; fin gait amplitude suppresses yaw; irrelevant body-common transform canceled'},
    'outsideVertexCount':len(offenders),'outsideMixedVertexCount':int(np.sum((W[offenders]>0).sum(axis=1)>1)),
    'worstUnionHalfspaceViolationM':float(union[witness]),
    'witness':{**origin(witness),'bindPosition':P[witness].tolist(),'weightedBodyFramePosition':weighted[witness].tolist(),
        'indices':I[witness].tolist(),'weights':W[witness].tolist(),
        'perHullMaxHalfspaceViolationM':{source['bones'][j]['name']:float(residuals[witness,k]) for k,j in enumerate(hulls)}},
    'outsideSourceVertices':[origin(int(i)) for i in offenders],
    'notes':['Halfspace violation is a rigorous outside certificate up to floating numerical tolerance, not Euclidean surface distance or floor penetration.',
        'Bind membership hulls are convexifications, not exact surface colliders. Facet centroid distances are sampled convex-bridge diagnostics, not a volume-of-concavity proof.',
        'Every source vertex with positive bone influence is included for that bone; each retained extreme preserves its original source index. No padding or dropped extremes.',
        'Containment of vertices would not alone establish containment of triangles across a nonconvex union.',
        'An eighth or reassigned support hull was not designed; allowing convex bridges can change representability. This failed construction does not prove all legal recipes impossible.',
        'No integrated alternate animation authored after this strict prerequisite failed. Removing inflation would be a real visual tradeoff, not equivalent animation.']}
BASE.joinpath('failed-membership-recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
OUT.joinpath('geometry-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({key:report[key] for key in ['status','occupiedBones','totalExtremePoints','budgetPass','outsideVertexCount','worstUnionHalfspaceViolationM','witness']},indent=2))
