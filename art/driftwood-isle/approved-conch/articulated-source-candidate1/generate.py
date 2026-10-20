"""One bounded editable Conch SOURCE variant. No Blender, runtime, or motion.
Split original continuous hinges by their authored ring topology and close the
new boundaries. Plane-cut existing closed feet into actual planar sole surfaces.
All source triangles are accounted for; the predecessor is never modified.
"""
from pathlib import Path
import hashlib
import json
import struct
import zlib
from collections import Counter
import numpy as np
from scipy.spatial import ConvexHull

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
SOURCE = BASE / 'selected-native-normals/native/conch-character-pass-native.json'
MAP = BASE / 'selected-native-normals/native/mesh-map.json'
SOURCE_SHA = '3dddaf6a2845ffea0c372fe46d8d422baaa2864bfaf5cc5f4c4cd98a9faa0929'
ATTRS = [('position','f32',3,'positions'),('normal','f32',3,'normals'),('color','f32',3,'colorsLinear'),('skinIndex','u16',4,'skinIndices'),('skinWeight','f32',4,'skinWeights'),('furLen','f32',1,'furLen')]
OWNERS = ['body','rapierArm','legLeft','legLeftKnee','legLeftAnkle','legRight','legRightKnee','legRightAnkle']
B = np.diag([-1.,1.,-1.])

def sha(raw): return hashlib.sha256(raw).hexdigest()
def encoded(data): return (json.dumps(data,separators=(',',':'),allow_nan=False)+'\n').encode()
def key(v): return tuple(v[:3])
def normal(tri):
    n=np.cross(tri[1][:3]-tri[0][:3],tri[2][:3]-tri[0][:3])
    if np.linalg.norm(n)<1e-12: raise ValueError('Degenerate generated triangle')
    return n/np.linalg.norm(n)
def mesh_report(tris, packed=False):
    if packed: tris = [np.array(t, dtype=np.float32).astype(float) for t in tris]
    edges=Counter(); directed=Counter()
    for tri in tris:
        normal(tri)
        for a,b in zip(tri,np.roll(tri,-1,axis=0)):
            ka,kb=key(a),key(b); edges[tuple(sorted((ka,kb)))]+=1; directed[(ka,kb)]+=1
    return {'triangles':len(tris),'uniquePositions':len({key(v) for tri in tris for v in tri}),
            'nonTwoEdges':sum(v!=2 for v in edges.values()),
            'orientationErrors':sum(directed[(a,b)]!=directed[(b,a)] for a,b in directed)}
def cap(tris):
    """Close only actual topological boundary loops, using reversed directed edges."""
    edge={}; count=Counter()
    for tri in tris:
        for a,b in zip(tri,np.roll(tri,-1,axis=0)):
            k=tuple(sorted((key(a),key(b)))); count[k]+=1; edge[k]=(a,b)
    boundary=[edge[k] for k,n in count.items() if n==1]
    pending={key(a):(a,b) for a,b in boundary}
    if len(pending)!=len(boundary): raise ValueError('Branched cap boundary')
    caps=[]
    while pending:
        start=next(iter(pending)); cursor=start; ring=[]
        while True:
            a,b=pending.pop(cursor); ring.append(a); cursor=key(b)
            if cursor==start: break
            if cursor not in pending: raise ValueError('Open cap loop')
        center=np.mean(ring,axis=0)
        for a,b in zip(ring,ring[1:]+ring[:1]):
            tri=np.array([b,a,center]); tri[:,3:6]=normal(tri); caps.append(tri)
    result=tris+caps
    report=mesh_report(result)
    if report['nonTwoEdges'] or report['orientationErrors']: raise ValueError(str(report))
    packed_report=mesh_report(result, packed=True)
    if packed_report['nonTwoEdges'] or packed_report['orientationErrors']: raise ValueError('Exact packed closure failed: '+str(packed_report))
    return result,len(caps)
def clip(tris,minimum,maximum):
    """Clip scalar in column9; linearly retain every surviving source surface."""
    result=[]
    for tri in tris:
        poly=list(tri)
        for bound,sign in [(minimum,1),(maximum,-1)]:
            if bound is None: continue
            out=[]
            for a,b in zip(poly,poly[1:]+poly[:1]):
                da=sign*(a[9]-bound);db=sign*(b[9]-bound)
                if da>=0:out.append(a)
                if (da<0<db) or (db<0<da):
                    # Both incident triangles and both split owners use identical
                    # endpoint arithmetic; no rounded welding or coordinate tolerance.
                    first,last=(a,b) if key(a)<key(b) else (b,a)
                    t=(bound-first[9])/(last[9]-first[9])
                    v=first+(last-first)*t;v[9]=bound;out.append(v)
            poly=out
            if not poly:break
        for j in range(1,len(poly)-1):
            t=np.array([poly[0],poly[j],poly[j+1]])
            if np.linalg.norm(np.cross(t[1,:3]-t[0,:3],t[2,:3]-t[0,:3]))>1e-12:result.append(t)
    return result

def source_mesh(part,start,count):
    p=np.array(part['positions']).reshape(-1,3)[start:start+count]
    n=np.array(part['normals']).reshape(-1,3)[start:start+count]
    c=np.array(part['colorsLinear']).reshape(-1,3)[start:start+count]
    return list(np.column_stack([p,n,c,np.zeros(count)]).reshape(-1,3,10))

def build():
    assert sha(SOURCE.read_bytes())==SOURCE_SHA,'Pinned source changed'
    source=json.loads(SOURCE.read_bytes()); mapping=json.loads(MAP.read_bytes())
    src={p['name']:p for p in source['parts']}; pivots={b['name']:np.array(b['pos']) for b in source['bones']}
    bones=[{**b,'pos':(B@pivots[b['name']]).tolist()} for b in source['bones']]
    groups={o:[] for o in OWNERS}; provenance=[]; topology=[]
    for row in mapping:
        name=row['name']; old=row['joint']; tris=source_mesh(src[old],row['vertexStart'],row['vertexCount'])
        owner=old if old in OWNERS else 'rapierArm' if old=='rapierForearm' else 'body'
        if name.startswith('Leg hinge '):
            stations=np.array([pivots[old],pivots[old+'Knee'],pivots[old+'Ankle']])
            # This identifies the three authored geometric rings, NOT skin weights.
            labels=Counter()
            for t in tris:
                for v in t:
                    v[9]=int(np.argmin(np.linalg.norm(stations-v[:3],axis=1)));labels[(key(v),int(v[9]))]+=1
            assert Counter(label for _,label in labels)=={0:8,1:8,2:8}
            for suffix,lo,hi in [('',0,1),('Knee',1,1.9),('Ankle',1.9,2)]:
                surfaces=clip(tris,lo,hi);closed,ncaps=cap(surfaces);own=old+suffix
                begin=sum(len(t)*3 for t in groups[own]);groups[own].append(np.array(closed))
                topology.append({'name':name+':'+own,'owner':own,**mesh_report(closed),'newCapTriangles':ncaps})
                provenance.append({'sourceMesh':name,'owner':own,'operation':'topological hinge segmentation and closed cap','ringInterval':[lo,hi],'retainedSurfaceTriangles':len(surfaces),'newCapTriangles':ncaps,'cornerStart':begin,'cornerCount':len(closed)*3})
        elif old.endswith('Ankle'):
            # Actual source sole reauthoring, not a root translation or collision skin.
            for t in tris:t[:,9]=t[:,1]
            surfaces=clip(tris,0,None)
            for triangle in surfaces:
                for vertex in triangle:
                    if vertex[9] == 0: vertex[1] = 0  # Exact authored cut-plane equation, not a lift.
            closed,ncaps=cap(surfaces)
            groups[owner].append(np.array(closed));topology.append({'name':name, 'owner':owner,**mesh_report(closed),'newCapTriangles':ncaps})
            provenance.append({'sourceMesh':name,'owner':owner,'operation':'plane cut at y=0; replace sub-plane tips with closed sole faces','sourceTriangles':len(tris),'retainedSurfaceTriangles':len(surfaces),'newCapTriangles':ncaps,'sourceMinimumY':min(v[1] for t in tris for v in t)})
        else:
            groups[owner].append(np.array(tris));provenance.append({'sourceMesh':name,'owner':owner,'operation':'exact retained geometry, material, normals before B; explicit fixed-assembly ownership','sourceTriangles':len(tris)})
    parts=[];recipe={'parts':[]}; hull_reports=[];feet=[]
    for owner in OWNERS:
        vertices=np.concatenate(groups[owner]).reshape(-1,10);positions=vertices[:,:3]@B.T;normals=vertices[:,3:6]@B.T
        i=next(i for i,b in enumerate(bones) if b['name']==owner);n=len(vertices)
        part={'name':owner,'positions':positions.flatten().tolist(),'normals':normals.flatten().tolist(),'colorsLinear':vertices[:,6:9].flatten().tolist(),'skinIndices':[i,0,0,0]*n,'skinWeights':[1,0,0,0]*n,'furLen':[0]*n};parts.append(part)
        # Hull built from exact f32-rendered positions, no padding or synthetic points.
        packed=positions.astype(np.float32).astype(float);points=np.unique(packed,axis=0);hull=ConvexHull(points)
        local=points[hull.vertices]-B@pivots[owner]
        assert 4<=len(local)<=128
        recipe['parts'].append({'bone':owner,'points':local.tolist()})
        hull_reports.append({'owner':owner,'points':len(local),'volume':float(hull.volume),'maxPlaneResidual':float(np.max(points@hull.equations[:,:3].T+hull.equations[:,3]))})
        if owner.endswith('Ankle'):
            sole=points[points[:,1]==0];assert len(sole)>=3
            polygon=sole[ConvexHull(sole[:,[0,2]]).vertices]
            feet.append({'owner':owner,'ankle':(B@pivots[owner]).tolist(),'solePlane':[0,1,0,0],'supportPolygon':polygon.tolist(),'soleToAnkleConvention':'ankle-to-sole = solePoint - absoluteBindAnkle','bindMinimumY':float(points[:,1].min())})
    assert sum(len(p['points']) for p in recipe['parts'])<=512
    model={'schema':'wildshard.conch.mesh.v1','candidate':'articulated-source-candidate1','status':'source candidate only; no motion, runtime, or visual admission','coordinates':'B=Ry(pi) from selected source: (-x,y,-z); +Z forward; no root offset', 'sourceSha256':SOURCE_SHA,'bones':bones,'parts':parts}
    lengths={}
    for side in ['Left','Right']:
        hip,knee,ankle=[B@pivots['leg'+side+s] for s in ['', 'Knee','Ankle']]
        pole=np.cross(knee-hip,ankle-knee);pole/=np.linalg.norm(pole)
        lengths[side]={'hip':hip.tolist(),'knee':knee.tolist(),'ankle':ankle.tolist(),'thighLength':float(np.linalg.norm(knee-hip)),'shinLength':float(np.linalg.norm(ankle-knee)),'bindBendNormal':pole.tolist(),'jointLimits':None,'motionEnvelopeAdmitted':False}
    contract={'basis':B.tolist(),'properRotationDeterminant':1,'actorForward':[0,0,1],'sourceForward':[0,0,-1],'localRotationConversion':'R_actor = B R_source B^-1; do not reuse old Euler channel values','normalConversion':'n_actor = B n_source','rigidPointConversion':'p_owner = B p_source - B bindPivot_owner','rootRenderOffset':[0,0,0],'fixedJoints':['shell','head','eyestalkLeft','eyestalkRight','shieldArm','shieldForearm','rapierForearm'],'sourceLeftMapsToActorX':'negative; source anatomical Left label retained, not relabeled as actor +X','sourceRightMapsToActorX':'positive','weaponOwner':'rapierArm','weaponActorSide':'positive X','chains':lengths,'feet':feet,'motionPrograms':[],'jointEulerOrder':'not authored; no rotation programs emitted','upperBodyTradeoff':'Torso/head/eyes/shell/shield form a fixed braced guard assembly; independent articulation lost. Rapier elbow fixed; shoulder retains articulation. Broad union obstacle envelope is not admitted.'}
    # Contact-region diagnostics deliberately exclude shield, shell and rapier from torso dimensions.
    body=np.array(src['body']['positions']).reshape(-1,3)@B.T;head=np.array(src['head']['positions']).reshape(-1,3)@B.T;bp=B@pivots['body'];hp=B@pivots['head']
    dims={'bodyY':float(bp[1]),'bodyHalfLen':float(np.max(np.abs(body[:,2]-bp[2]))),'bodyRadius':float(np.max(np.linalg.norm(body[:,[0,1]]-bp[[0,1]],axis=1))),'headRadius':float(np.max(np.linalg.norm(head-hp,axis=1))),'legLen':float(bp[1]),'feet':[[float(np.mean(f['supportPolygon'],axis=0)[a]) for a in (0,2)] for f in feet],'halfWidth':float(max(abs(v) for p in parts for v in p['positions'][::3])),'capsuleAxis':'z','rigidCorpse':recipe}
    raw=bytearray();packed_parts=[]
    for p in parts:
        offsets=[]
        for _,kind,_,attr in ATTRS:
            offsets.append(len(raw));values=p[attr];raw.extend(struct.pack('<'+('H' if kind=='u16' else 'f')*len(values),*values));raw.extend(bytes((-len(raw))%4))
        packed_parts.append({'offsets':offsets,'row':{'attrs':[[n,k,w,False] for n,k,w,_ in ATTRS],'count':len(p['positions'])//3,'index':None,'indexCount':0,'box':True}})
    payload=zlib.compress(raw,9)
    metadata={'file':'/assets/driftwood-isle/conch-articulated-source-candidate1-'+sha(payload)+'.bin','bytes':len(raw),'bodies':[{'kind':'conch-duelist','variant':'conch-duelist','bones':bones,'dims':dims,'fur':None,'hard':packed_parts,'eye':None}]}
    report={'sourceCorners':6570,'candidateCorners':sum(len(p['positions'])//3 for p in parts),'owners':8,'hullPoints':sum(r['points'] for r in hull_reports),'hulls':hull_reports,'newClosedMeshes':topology,'changes':provenance,'diagnosticDimensionsOnly':True,'sourceGeometryAdmission':False,'runtimeAdmission':False,'visualAcceptance':False,'footMotionAuthored':False,'binaryBytes':len(payload)}
    return {'model.json':encoded(model),'recipe.json':encoded(recipe),'contract.json':encoded(contract),'metadata.json':encoded(metadata),'payload.bin':payload,'construction.json':encoded(report)}

def main():
    files=build()
    for name,raw in files.items():
        assert len(raw)<(5_000_000 if name.endswith('.json') else 1_000_000)
        p=HERE/name
        if p.exists():assert p.read_bytes()==raw,'Refuse overwrite of nonidentical frozen output: '+name
        else:p.write_bytes(raw)
    pins={str(p.relative_to(BASE)):sha(p.read_bytes()) for p in [SOURCE,MAP,*sorted((BASE/'selected-complete-motion').glob('*'))] if p.is_file()}
    freeze={'inputs':pins,'outputs':{n:{'sha256':sha(v),'bytes':len(v)} for n,v in files.items()},'generatorSha256':sha(Path(__file__).read_bytes()),'completeEditableSourceMilestone':True,'allQualityAndRuntimeGatesPassed':False}
    (HERE/'freeze.json').write_bytes(encoded(freeze));print(json.dumps({'outputs':freeze['outputs'],'report':json.loads(files['construction.json'])['hulls']},indent=2))
if __name__=='__main__':main()
