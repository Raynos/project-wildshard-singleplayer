"""Exact character-pass GLB -> existing packedCreatureBodies codec; no Blender/runtime writes.

This deliberately supports ONLY the pinned, opaque, translation-only character-pass scene.
No decimation, recoloring, winding reversal, fitting or palette approximation.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = HERE / 'build_selected_conch.py'
GLB = HERE / 'conch-study.glb'
SOURCE_SHA = 'ecfcfa03a123b5b81343a96409ed769a7b85be03530c4ef30e2bd56a3ba95a0e'
GLB_SHA = '21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a'
SCHEMA = 'wildshard.conch.mesh.v1'
CODEC_PATH = ROOT / 'art/driftwood-isle/approved-puffer/native_export.py'
spec = importlib.util.spec_from_file_location('existing_native_codec', CODEC_PATH)
codec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(codec)
# Attachment stations in the pinned source BEFORE its explicit X mirror.
# All pivots are newly derived, not an authored armature or borrowed animation.
STATIONS = [
    ('body', None, [0, -.05, 1.04], 'Compact thorax core second centerline station'),
    ('shell', 'body', [-.38, -.34, 1.35], 'CAGES[0] shell seat center'),
    ('head', 'body', [0, .365, 1.64], 'First face_rows section center'),
    ('eyestalkLeft', 'head', [-.16, .33, 1.51], 'Eyestalk -1 first centerline station'),
    ('eyestalkRight', 'head', [.16, .33, 1.51], 'Eyestalk 1 first centerline station'),
    ('shieldArm', 'body', [-.27, -.015, 1.36], 'Shoulder hinge -1 first centerline station'),
    ('shieldForearm', 'shieldArm', [-.76, .30, 1.04], 'Shield supporting forearm first station'),
    ('rapierArm', 'body', [.27, -.015, 1.36], 'Shoulder hinge 1 first centerline station'),
    ('rapierForearm', 'rapierArm', [.69, .22, 1.10], 'Elbow joint 1 first centerline station'),
    ('legLeft', 'body', [-.23, -.03, .86], 'Leg hinge -1 hip station'),
    ('legLeftKnee', 'legLeft', [-.69, -.17, .63], 'Leg hinge -1 knee station'),
    ('legLeftAnkle', 'legLeftKnee', [-.86, .01, .14], 'Leg hinge -1 ankle station'),
    ('legRight', 'body', [.23, -.03, .86], 'Leg hinge 1 hip station'),
    ('legRightKnee', 'legRight', [.69, .13, .63], 'Leg hinge 1 knee station'),
    ('legRightAnkle', 'legRightKnee', [.86, .31, .14], 'Leg hinge 1 ankle station'),
]
NAMES = [row[0] for row in STATIONS]


def game_point(p):
    """Authored pre-mirror Blender -> mirrored Blender -> glTF. Face is -Z."""
    return [-p[0], p[2], -p[1]]


def rig():
    return [{'name': name, 'parent': parent, 'pos': game_point(p)} for name, parent, p, _ in STATIONS]


def provenance():
    return {'sourceSha256': SOURCE_SHA, 'glbContainsPivots': False,
            'note': 'Left/Right suffix follows authored side sign, not final world X. Identity bind orientations; no animation clips admitted. Continuous hinge weights are derived by closest-segment interpolation along hip/knee/ankle stations; armor remains rigid. No knee flex or contact proof.',
            'bones': [{**bone, 'preMirrorBlenderPivot': station[2], 'pivotOrigin': 'derived attachment station',
                       'evidence': station[3]} for bone, station in zip(rig(), STATIONS)]}


def semantic_joint(name):
    if name == 'Unified angular whorls lip and recessed throat': return 'shell'
    if name.startswith(('Compact thorax', 'Raised breast', 'Overlapping abdomen', 'Pointed pelvic', 'Continuous tucked abdomen')): return 'body'
    if name.startswith(('Hooked coral', 'Sculpted cheek', 'Angular brow', 'Inset nostril')): return 'head'
    for side, label in [('-1', 'Left'), ('1', 'Right')]:
        if name in [prefix + ' ' + side for prefix in ('Eyestalk', 'Pointed sculpted eye socket', 'Closed socket back', 'Convex inset amber lens', 'Black pointed slit', 'Eye glint')]: return 'eyestalk' + label
        if name in [prefix + ' ' + side for prefix in ('Leg hinge', 'Bent armored thigh')]: return 'leg' + label
        if name == 'Armored shin ' + side: return 'leg' + label + 'Knee'
        if name == 'Planted foot ' + side or name.startswith('Toe blade (' + side + ','): return 'leg' + label + 'Ankle'
        arm = 'shield' if side == '-1' else 'rapier'
        if name in [prefix + ' ' + side for prefix in ('Shoulder hinge', 'Swept shoulder armor', 'Bent upper arm')]: return arm + 'Arm'
        if name == 'Elbow joint ' + side: return arm + 'Forearm'
    if name in ('Shield supporting forearm', 'Broad convex jagged shield claw', 'Shield opposed articulated thumb'): return 'shieldForearm'
    if name in ('Rapier forearm cuff', 'Coral rapier knuckle', 'Long ivory conch rapier', 'Rapier gripping thumb'): return 'rapierForearm'
    raise ValueError('Unmapped mesh: ' + name)


def vertex_weights(joint, mesh_name, point):
    if not mesh_name.startswith('Leg hinge '):
        return [NAMES.index(joint), 0, 0, 0], [1, 0, 0, 0]
    # Shared field on the continuous hinge only; duplicate positions get identical
    # weights. No vertex position is moved and no topology or normals are repaired.
    chain = [joint, joint + 'Knee', joint + 'Ankle']
    pivots = {bone['name']: bone['pos'] for bone in rig()}
    best = None
    for a, b in zip(chain, chain[1:]):
        start, end = pivots[a], pivots[b]
        delta = [y-x for x, y in zip(start, end)]
        t = max(0., min(1., sum((x-y)*d for x, y, d in zip(point, start, delta))/sum(d*d for d in delta)))
        distance = sum((x-(y+t*d))**2 for x, y, d in zip(point, start, delta))
        if best is None or distance < best[0]: best = (distance, a, b, t)
    require(best is not None, 'Missing leg centerline')
    _, a, b, t = best
    return [NAMES.index(a), NAMES.index(b), 0, 0], [1-t, t, 0, 0]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, separators=(',', ':'), allow_nan=False) + '\n').encode()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def parse_glb(raw):
    require(len(raw) >= 28, 'Truncated GLB')
    require(struct.unpack_from('<4sII', raw) == (b'glTF', 2, len(raw)), 'Invalid GLB header')
    size, kind = struct.unpack_from('<I4s', raw, 12)
    require(kind == b'JSON' and 20 + size + 8 <= len(raw), 'Invalid JSON chunk')
    doc = json.loads(raw[20:20+size])
    n, kind = struct.unpack_from('<I4s', raw, 20+size)
    binary = raw[28+size:]
    require(kind == b'BIN\0' and n == len(binary), 'Invalid BIN chunk')
    require(len(doc['buffers']) == 1 and 'uri' not in doc['buffers'][0], 'External buffer refused')
    require(not any(doc.get(k) for k in ('images', 'textures', 'skins', 'animations', 'extensionsUsed', 'extensionsRequired')), 'Unsupported GLB feature')
    require(doc['buffers'][0]['byteLength'] <= len(binary), 'Buffer overflow')
    return doc, binary


def accessor(doc, binary, index):
    ac = doc['accessors'][index]
    require(not ac.get('sparse') and not ac.get('normalized'), 'Sparse/normalized accessor refused')
    require(ac['type'] in ('SCALAR', 'VEC3') and ac['componentType'] in (5123, 5125, 5126), 'Unsupported accessor')
    bv = doc['bufferViews'][ac['bufferView']]
    require(bv['buffer'] == 0, 'Unexpected buffer')
    width = 1 if ac['type'] == 'SCALAR' else 3
    fmt = '<' + {5123: 'H', 5125: 'I', 5126: 'f'}[ac['componentType']] * width
    size = struct.calcsize(fmt)
    start = bv.get('byteOffset', 0) + ac.get('byteOffset', 0)
    stride = bv.get('byteStride', size)
    end = bv.get('byteOffset', 0) + bv['byteLength']
    require(ac['count'] > 0 and stride >= size and start >= bv.get('byteOffset', 0)
            and start + (ac['count']-1)*stride + size <= end <= len(binary), 'Accessor overflow')
    rows = [struct.unpack_from(fmt, binary, start+i*stride) for i in range(ac['count'])]
    require(all(math.isfinite(x) for row in rows for x in row), 'Nonfinite accessor')
    return rows


def scene_nodes(doc):
    """GLB already maps Blender (x,y,z) to (x,z,-y), the source face is -Z."""
    result, seen = [], set()
    def visit(index, parent, offset):
        require(index not in seen, 'Duplicate/cyclic scene node')
        seen.add(index)
        node = doc['nodes'][index]
        require(not any(k in node for k in ('matrix', 'rotation', 'scale', 'skin', 'weights')), 'Only exact character-pass translation transforms supported')
        translation = node.get('translation', [0, 0, 0])
        require(len(translation) == 3 and all(math.isfinite(x) for x in translation), 'Invalid translation')
        world = [a+b for a, b in zip(offset, translation)]
        result.append((index, node, parent, world))
        for child in node.get('children', []):
            visit(child, node['name'], world)
    for index in doc['scenes'][doc['scene']]['nodes']:
        visit(index, None, [0, 0, 0])
    require(len(seen) == len(doc['nodes']), 'Unreferenced node')
    return result


def validate_native(data):
    require(data['schema'] == SCHEMA, 'Wrong Conch schema')
    require(data['bones'] == rig(), 'Exact character-pass rig required')
    require([p['name'] for p in data['parts']] == NAMES, '15 separately batched parts required')
    report = codec.validate_native({**data, 'schema': codec.SCHEMA})
    for index, part in enumerate(data['parts']):
        n = len(part['positions']) // 3
        if part['name'] not in ('legLeft', 'legRight'):
            require(part['skinIndices'] == [index, 0, 0, 0]*n, 'Rigid part index mismatch')
            require(part['skinWeights'] == [1, 0, 0, 0]*n, 'Rigid weight mismatch')
        else:
            allowed = {index, index+1, index+2}
            require(all(weight == 0 or bone in allowed for bone, weight in zip(part['skinIndices'], part['skinWeights'])), 'Hinge weight outside leg chain')
    return report


def export_native(source_raw, glb_raw):
    require(sha(source_raw) == SOURCE_SHA, 'character-pass source hash mismatch')
    require(sha(glb_raw) == GLB_SHA, 'character-pass GLB hash mismatch')
    doc, binary = parse_glb(glb_raw)
    nodes = scene_nodes(doc)
    bones = rig()
    parts = {name: {'name': name, **{key: [] for _, _, _, key in codec.ATTRS}} for name in NAMES}
    receipt = []
    for node_index, node, parent, world in nodes:
        if 'mesh' not in node:
            continue
        require(parent is None, 'Unexpected GLB mesh parent')
        joint = semantic_joint(node['name'])
        part = parts[joint]
        start = len(part['positions']) // 3
        primitive_map = []
        for primitive_index, primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
            primitive_start = len(part['positions']) // 3
            require(primitive.get('mode', 4) == 4 and not primitive.get('targets'), 'Only static triangles supported')
            require(set(primitive['attributes']) == {'POSITION', 'NORMAL'}, 'Unexpected vertex channel')
            positions = accessor(doc, binary, primitive['attributes']['POSITION'])
            indices = [row[0] for row in accessor(doc, binary, primitive['indices'])]
            require(len(indices) % 3 == 0 and all(type(i) is int and 0 <= i < len(positions) for i in indices), 'Invalid triangle indices')
            material = doc['materials'][primitive['material']]
            pbr = material['pbrMetallicRoughness']
            require(set(pbr) == {'baseColorFactor', 'metallicFactor', 'roughnessFactor'}
                    and pbr['metallicFactor'] == 0 and abs(pbr['roughnessFactor']-.76) < 1e-6
                    and material.get('alphaMode', 'OPAQUE') == 'OPAQUE'
                    and not material.get('extensions') and not material.get('emissiveFactor'), 'Unsupported material response')
            color = pbr['baseColorFactor']
            require(len(color) == 4 and color[3] == 1, 'Transparency refused')
            for vertex in indices:
                point = [a+b for a, b in zip(positions[vertex], world)]
                part['positions'].extend(point)
                part['colorsLinear'].extend(color[:3])  # glTF factor is already linear.
                ids, weights = vertex_weights(joint, node['name'], point)
                part['skinIndices'].extend(ids)
                part['skinWeights'].extend(weights)
                part['furLen'].append(0)
            primitive_map.append({'primitive': primitive_index, 'material': primitive['material'], 'vertexStart': primitive_start, 'vertexCount': len(indices)})
        receipt.append({'primitives': primitive_map, 'node': node_index, 'name': node['name'], 'joint': joint,
                        'vertexStart': start, 'vertexCount': len(part['positions'])//3-start})
    data = {'schema': SCHEMA, 'candidate': 'Conch selected pass2 geometry correction; diagnostic only',
            'status': 'Geometry preparation only; runtime and animation untested',
            'coordinates': 'unchanged glTF right-handed axes; y-up, authored face points -z; source X mirror already baked',
            'sourceSha256': SOURCE_SHA, 'glbSha256': GLB_SHA, 'bones': bones, 'parts': list(parts.values())}
    report = validate_native(data)
    require(report == {'vertices': 6570, 'triangles': 2190, 'bones': 15, 'parts': 15}, 'Pinned character-pass topology changed')
    return data, receipt


def diagnostic_dimensions(data, mapping):
    """Conservative rest-only capsule; deliberately NOT admitted gameplay tuning."""
    by_name = {p['name']: p for p in data['parts']}
    points = lambda part: list(zip(*[iter(part['positions'])]*3))
    vertices = [v for part in data['parts'] for v in points(part)]
    body_y = data['bones'][0]['pos'][1]
    radius = max(math.hypot(v[0], v[1]-body_y) for v in vertices)
    head = next(b['pos'] for b in data['bones'] if b['name'] == 'head')
    feet = []
    for name, side in [('legLeft', '-1'), ('legRight', '1')]:
        row = next(r for r in mapping if r['name'] == 'Planted foot ' + side)
        part = by_name[row['joint']]
        tarsus = list(points(part))[row['vertexStart']:row['vertexStart']+row['vertexCount']]
        low = min(p[1] for p in tarsus)
        soles = [p for p in tarsus if p[1] <= low + .015]
        feet.append([(min(p[a] for p in soles)+max(p[a] for p in soles))/2 for a in (0, 2)])
    return {'bodyY': body_y, 'bodyHalfLen': max(abs(v[2]) for v in vertices), 'bodyRadius': radius,
            'headRadius': max(math.dist(v, head) for v in points(by_name['head'])),
            'legLen': body_y, 'feet': feet, 'halfWidth': max(abs(v[0]) for v in vertices), 'capsuleAxis': 'z'}


def pack_native(data, dimensions):
    validate_native(data)
    metadata, packed = codec.pack_native_puffer({**data, 'schema': codec.SCHEMA}, dimensions,
                                               '/assets/driftwood-isle/conch-native')
    metadata['bodies'][0].update(kind='conch-duelist', variant='conch-duelist')
    return metadata, packed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--glb', type=Path, default=GLB)
    parser.add_argument('--out', type=Path, required=True, help='New directory inside runtime-admission only')
    args = parser.parse_args()
    out = args.out.resolve()
    require(out.is_relative_to(HERE) and out != HERE, 'Output must be a new runtime-admission child')
    require(not out.exists(), 'Output exists; preserve previous closure')
    data, mapping = export_native(SOURCE.read_bytes(), args.glb.read_bytes())
    dims = diagnostic_dimensions(data, mapping)
    metadata, packed = pack_native(data, dims)
    files = {'conch-character-pass-native.json': encoded(data), 'diagnostic-dimensions.json': encoded(dims),
             'mesh-map.json': encoded(mapping), 'rig-provenance.json': encoded(provenance()), 'metadata.json': encoded(metadata), 'payload.bin': packed}
    require(len(files['conch-character-pass-native.json']) <= 5_000_000, 'Source JSON storage limit')
    receipt = {'schema': 'wildshard.conch.native-preparation.v1', 'sourceSha256': SOURCE_SHA, 'glbSha256': GLB_SHA,
               'exporterSha256': sha(Path(__file__).read_bytes()), 'codecSha256': sha(CODEC_PATH.read_bytes()),
               'stats': validate_native(data), 'sourceMeshes': 56, 'sourcePrimitives': 108,
               'files': {name: {'sha256': sha(raw), 'bytes': len(raw)} for name, raw in files.items()},
               'geometryAcceptance': False, 'animationAcceptance': False, 'colliderAcceptance': False,
               'runtimeAcceptance': False, 'phonePerformanceAcceptance': False,
               'materialNote': 'Linear factors retained; engine toon/flat shader differs from Blender Standard. GLB doubleSided is not a per-part packed-body field.',
               'dimensionsNote': 'Conservative full rest hull only; not gameplay tuning. Motion/contacts untested.'}
    out.mkdir()
    for name, raw in {**files, 'closure.json': encoded(receipt)}.items():
        with (out/name).open('xb') as output:
            output.write(raw)
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
