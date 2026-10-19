"""Candidate-only, fail-closed cervical-frame-repair adapter. No renderer/runtime writes.

Retains ordered GLB triangles, materials, float32 normals and exact rest points.
Uses the unmodified packed-body format's existing arbitrary attribute support.
"""
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import zlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE_DIR = HERE
GLB = SOURCE_DIR / 'mantis-study-cervical-frame-repair.glb'
SOURCE = SOURCE_DIR / 'build_mantis_complete.py'
SCHEMA = 'wildshard.mantis.cervical-frame-repair.native.v1'
ATTRS = [('position', 'f32', 3, 'positions'), ('normal', 'f32', 3, 'normals'),
         ('color', 'f32', 3, 'colorsLinear'), ('skinIndex', 'u16', 4, 'skinIndices'),
         ('skinWeight', 'f32', 4, 'skinWeights'), ('furLen', 'f32', 1, 'furLen')]

def require(ok, message):
    if not ok:
        raise ValueError(message)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def encoded(value):
    return (json.dumps(value, separators=(',', ':'), allow_nan=False)+'\n').encode()

def read_json(path):
    return json.loads(path.read_bytes())

def verify_inputs():
    for path, digest in read_json(HERE/'input-pins.json').items():
        require(sha((ROOT/path).read_bytes()) == digest, 'Pinned input mismatch: '+path)

# Reuse only audited GLB readers / dimension calculator, never V7 rig or semantics.
verify_inputs()
spec = importlib.util.spec_from_file_location('mantis_v7_readers', HERE.parent/'runtime-admission/export_native.py')
readers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(readers)
parse_glb, accessor, scene_nodes = readers.parse_glb, readers.accessor, readers.scene_nodes
AUTHORED = read_json(HERE/'authored-mapping.json')
NAMES = [b['name'] for b in AUTHORED['bones']]

def rig():
    return [{k: b[k] for k in ('name', 'parent', 'pos')} for b in AUTHORED['bones']]

def validate_native(data):
    require(data['schema'] == SCHEMA and data['bones'] == rig(), 'Exact candidate rig/schema required')
    require([p['name'] for p in data['parts']] == NAMES, 'Exact 22-part partition required')
    # Existing generic value validation only, with no shared schema modifications.
    report = readers.codec.validate_native({**data, 'schema': readers.codec.SCHEMA})
    for i, part in enumerate(data['parts']):
        n = len(part['positions'])//3
        require(len(part['normals']) == n*3 and all(math.isfinite(x) for x in part['normals']), 'Invalid normals')
        require(part['skinIndices'] == [i,0,0,0]*n and part['skinWeights'] == [1,0,0,0]*n, 'Exact authored rigid weights required')
    require(report == dict(vertices=9156, triangles=3052, bones=22, parts=22), 'Candidate topology mismatch')
    return report

def export_native():
    verify_inputs()
    doc, binary = parse_glb(GLB.read_bytes())
    original = read_json(SOURCE_DIR/'mantis-mesh-cervical-frame-repair.json')['parts']
    mapping = AUTHORED['parts']
    require(len(mapping) == len(original) == 89, 'Exact 89 parts required')
    require(len({p['name'] for p in mapping}) == 89, 'Duplicate authored mapping')
    require([p['name'] for p in mapping] == [p['name'] for p in original], 'Mapping/source order mismatch')
    originals = {p['name']:p for p in original}
    assigned = {p['name']:p for p in mapping}
    metrics = read_json(SOURCE_DIR/'metrics-cervical-frame-repair.json')
    require(set(metrics['pivots']) == {b['staticLabel'] for b in AUTHORED['bones'] if b['staticLabel'] is not None}, 'Static pivot set mismatch')
    for b in AUTHORED['bones']:
        if b['staticLabel'] is not None:
            require(b['blenderPivot'] == metrics['pivots'][b['staticLabel']], 'Static pivot changed')
        require(b['pos'] == readers.game_point(b['blenderPivot']), 'Pivot coordinate mismatch')
    require(sum(p['newlyMapped'] for p in mapping) == 7, 'Seven explicit changed mappings required')
    parts = {n:dict(name=n, **{key:[] for _,_,_,key in ATTRS}) for n in NAMES}
    receipt, seen = [], set()
    deviations, opposed, minimum = [], [], 1.0
    for node_index, node, parent, world in scene_nodes(doc):
        if 'mesh' not in node:
            continue
        name = node['name']
        require(name in assigned and name not in seen, 'Unknown/duplicate mesh node: '+name)
        seen.add(name)
        require(parent is None, 'Nested mesh refused')
        src, assignment = originals[name], assigned[name]
        require(src['joint'] == assignment['staticLabel'], 'Authored static label mismatch')
        joint = assignment['nativeJoint']
        require(joint in parts, 'Unknown assigned native joint')
        part = parts[joint]
        start = len(part['positions'])//3
        expected_points = {tuple(readers.game_point(p)) for p in src['vertices']}
        found_points = set()
        face_triangles = [[] for _ in src['faces']]
        source_points = [tuple(readers.game_point(p)) for p in src['vertices']]
        primitive_map = []
        for pi, primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
            require(primitive.get('mode',4) == 4 and not primitive.get('targets'), 'Only static triangles admitted')
            require(set(primitive['attributes']) == {'POSITION','NORMAL'}, 'Unexpected vertex channels')
            positions = accessor(doc,binary,primitive['attributes']['POSITION'])
            normals = accessor(doc,binary,primitive['attributes']['NORMAL'])
            require(len(positions) == len(normals), 'Normal count mismatch')
            require(all(tuple(p) in expected_points for p in positions), 'Source point mismatch')
            found_points.update(positions)
            indices = [r[0] for r in accessor(doc,binary,primitive['indices'])]
            require(len(indices)%3 == 0 and all(type(i) is int and 0<=i<len(positions) for i in indices), 'Invalid indices')
            mat = doc['materials'][primitive['material']]
            pbr = mat['pbrMetallicRoughness']
            require(set(pbr) == {'baseColorFactor','metallicFactor','roughnessFactor'} and pbr['metallicFactor']==0 and abs(pbr['roughnessFactor']-.88)<1e-6, 'Material response changed')
            require(mat.get('alphaMode','OPAQUE') == 'OPAQUE' and not mat.get('extensions') and not mat.get('emissiveFactor'), 'Unsupported material')
            color = pbr['baseColorFactor']
            require(len(color)==4 and color[3]==1 and color in src['colors'], 'Authored material mismatch')
            primitive_start = len(part['positions'])//3
            for vi in indices:
                part['positions'].extend(a+b for a,b in zip(positions[vi],world))
                part['normals'].extend(normals[vi])
                part['colorsLinear'].extend(color[:3])
                part['skinIndices'].extend([NAMES.index(joint),0,0,0])
                part['skinWeights'].extend([1,0,0,0]); part['furLen'].append(0)
            # Keep all original facet discrepancies; do not repair or recompute.
            for t in range(0,len(indices),3):
                a,b,c = [positions[i] for i in indices[t:t+3]]
                face_candidates = [fi for fi,face in enumerate(src['faces']) if {a,b,c}.issubset({source_points[i] for i in face}) and src['colors'][src['materialIndices'][fi]] == color]
                require(len(face_candidates) == 1, 'Ambiguous or changed polygon/material ownership')
                face_triangles[face_candidates[0]].append((a,b,c))
                u,v = [[q-p for p,q in zip(a,x)] for x in (b,c)]
                cross = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
                length = math.sqrt(sum(x*x for x in cross))
                require(length > 1e-10,'Degenerate triangle')
                dots=[sum(x*y for x,y in zip(cross,normals[i]))/length for i in indices[t:t+3]]
                minimum=min(minimum,*dots)
                row=dict(node=node_index,name=name,primitive=pi,triangle=t//3,normalCosines=dots)
                if min(dots)<.999: deviations.append(row)
                if min(dots)<-1e-7:
                    opposed.append({**row, 'positions': [a,b,c], 'normals': [normals[i] for i in indices[t:t+3]], 'authoredPolygon': face_candidates[0], 'material': primitive['material'], 'reason': 'Stored source polygon normal opposes this unchanged triangle winding; no correction authorized or emitted'})
            primitive_map.append(dict(primitive=pi,material=primitive['material'],vertexStart=primitive_start,vertexCount=len(indices),doubleSided=mat.get('doubleSided',False)))
        require(found_points == expected_points,'Incomplete authored point coverage')
        for face,triangles in zip(src['faces'],face_triangles):
            require(len(triangles) == len(face)-2, 'Polygon triangulation count changed')
            edges = Counter((a,b) for tri in triangles for a,b in zip(tri,tri[1:]+tri[:1]))
            boundary = Counter((source_points[a],source_points[b]) for a,b in zip(face,face[1:]+face[:1]))
            def signed(counter):
                return {edge:count-counter[edge[::-1]] for edge,count in counter.items() if count-counter[edge[::-1]]>0}
            require(signed(edges) == signed(boundary), 'Polygon boundary/winding topology changed')
        receipt.append(dict(name=name,node=node_index,authoredJoint=src['joint'],joint=joint,translation=world,vertexStart=start,vertexCount=len(part['positions'])//3-start,primitives=primitive_map))
    require(seen == set(assigned),'Missing authored mesh')
    data=dict(schema=SCHEMA,candidate='Mantis cervical-frame-repair native22',status='Unaccepted integration preparation',coordinates='x-right y-up z-forward; unchanged GLB axes',bones=rig(),parts=list(parts.values()))
    validate_native(data)
    audit=dict(triangleCount=3052,minimumNormalCosine=minimum,facetNormalDeviations=deviations,opposedTriangles=opposed,normalPolicy='Exact source NORMAL float32 channel preserved; no recomputation or repair',visualAcceptance=False)
    return data,receipt,audit

def pack_native(data,dims):
    validate_native(data)
    binary=bytearray(); parts=[]
    for part in data['parts']:
        offsets=[]
        for _,kind,_,key in ATTRS:
            offsets.append(len(binary)); values=part[key]
            binary.extend(struct.pack('<'+('H' if kind=='u16' else 'f')*len(values),*values)); binary.extend(bytes((-len(binary))%4))
        parts.append(dict(offsets=offsets,row=dict(attrs=[[n,k,w,False] for n,k,w,_ in ATTRS],count=len(part['positions'])//3,index=None,indexCount=0,box=True)))
    packed=zlib.compress(binary,9)
    metadata=dict(file='/assets/driftwood-isle/mantis-cervical-frame-repair-'+sha(packed)+'.bin',bytes=len(binary),bodies=[dict(kind='splinter-mantis',variant='splinter-mantis',bones=data['bones'],dims=dims,fur=None,hard=parts,eye=None)])
    return metadata,packed

def main():
    try:
        data,mapping,audit=export_native()
        dims=readers.diagnostic_dimensions(data,mapping)
        meta,payload=pack_native(data,dims)
        files={'mantis-native.json':encoded(data),'mesh-map.json':encoded(mapping),'normal-audit.json':encoded(audit),'diagnostic-dimensions.json':encoded(dims),'metadata.json':encoded(meta),'payload.bin':payload}
        for name,raw in files.items():
            require(len(raw)<(5_000_000 if name.endswith('.json') else 1_000_000),'Storage limit: '+name)
        receipt=dict(schema='wildshard.mantis.cervical-frame-repair.preparation.v1',stats=validate_native(data),sourceMeshes=len(mapping),sourcePrimitives=sum(len(r['primitives']) for r in mapping),inputs=read_json(HERE/'input-pins.json'),exporterSha256=sha(Path(__file__).read_bytes()),files={n:dict(bytes=len(r),sha256=sha(r)) for n,r in files.items()},structuralExport=True,consumerVerified=False,visualAcceptance=False,animationAcceptance=False,worldContactAcceptance=False,runtimeAcceptance=False,promotion=False,materialLimit='GLB source normals/colors preserved; engine toon response and sidedness require independent visual review.',dimensionsLimit='Conservative diagnostic hull only; source-order feet, no gameplay tuning inherited.')
        for name,raw in {**files,'closure.json':encoded(receipt)}.items(): (HERE/name).write_bytes(raw)
        print(json.dumps({k:v for k,v in receipt.items() if k not in ('inputs','files')},indent=2))
    except Exception as error:
        (HERE/'failed-admission.json').write_bytes(encoded(dict(status='FAILED',errorType=type(error).__name__,cause=str(error),runtimeAcceptance=False)))
        raise

if __name__=='__main__': main()
