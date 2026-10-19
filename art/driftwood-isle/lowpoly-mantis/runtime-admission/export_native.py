"""Exact V7 GLB -> existing packedCreatureBodies codec; no Blender/runtime writes.

This deliberately supports ONLY the pinned, opaque, translation-only V7 scene.
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
SOURCE = ROOT / 'art/driftwood-isle/lowpoly-mantis/build_mantis_v7.py'
GLB = SOURCE.parent / 'mantis-study-v7.glb'
SOURCE_SHA = '442540438fc5c1f9fb38c396854338b3ea049931ad28c0b0c15003911d940330'
GLB_SHA = '6f63fff9d162a02a4b650aeefa4ccb370fb8fe818c23e51c2d45575ac3c3ea6f'
SCHEMA = 'wildshard.mantis.mesh.v1'
CODEC_PATH = ROOT / 'art/driftwood-isle/approved-puffer/native_export.py'
spec = importlib.util.spec_from_file_location('existing_native_codec', CODEC_PATH)
codec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(codec)
METRICS = SOURCE.parent / 'metrics-v7.json'
MESH = SOURCE.parent / 'mantis-mesh-v7.json'
METRICS_SHA = '2a26550bd6a0b46c3337b1efac896a9986a78a64f075a08847bdd46617bb049d'
MESH_SHA = 'b5960e2cb48fb004343fef62b0aa75a91f96b0563ed7420fb3558a3124ee1282'
NAMES = ['body', 'neck', 'head', 'abdomen']
for side in [-1, 1]:
    NAMES += [f'wing{side}_{i}' for i in range(2)]
    for i in range(2):
        NAMES += [f'leg{side}_{i}', f'leg{side}_{i}_knee']
    NAMES += [f'raptor{side}', f'raptor{side}_elbow', f'raptor{side}_hook']


def parent_of(name):
    if name == 'body': return None
    if name == 'head' or name in ('raptor-1', 'raptor1'): return 'neck'
    if name.endswith('_knee'): return name[:-5]
    if name.endswith('_elbow'): return name[:-6]
    if name.endswith('_hook'): return name[:-5] + '_elbow'
    return 'body'


def game_point(p):
    return [p[0], p[2], -p[1]]


def rig():
    require(sha(METRICS.read_bytes()) == METRICS_SHA, 'V7 metrics hash mismatch')
    pivots = json.loads(METRICS.read_bytes())['pivots']
    # Derived attachment centers from the exact first profile stations in V7.
    pivots['neck'] = [0, .38, 1.40]
    pivots['abdomen'] = [0, .14, 1.47]
    require(set(pivots) == set(NAMES), 'Unexpected V7 pivot set')
    return [{'name': name, 'parent': parent_of(name), 'pos': game_point(pivots[name])} for name in NAMES]


def semantic_joint(name, authored):
    if authored != 'body': return authored
    if name.startswith(('Abdomen', 'Abdominal', 'Lateral tail')): return 'abdomen'
    if name.startswith(('Rising prothorax', 'Pale ventral thorax', 'Imbricated thorax', 'Rear neck collar', 'Overlapping dorsal neck')): return 'neck'
    require(name.startswith('Coxal bark shield'), 'Unmapped body geometry')
    return 'body'


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
    """GLB already maps Blender (x,y,z) to (x,z,-y), i.e. game +Z front."""
    result, seen = [], set()
    def visit(index, parent, offset):
        require(index not in seen, 'Duplicate/cyclic scene node')
        seen.add(index)
        node = doc['nodes'][index]
        require(not any(k in node for k in ('matrix', 'rotation', 'scale', 'skin', 'weights')), 'Only exact V7 translation transforms supported')
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
    require(data['schema'] == SCHEMA, 'Wrong Mantis schema')
    require(data['bones'] == rig(), 'Exact V7 rig required')
    require([p['name'] for p in data['parts']] == NAMES, '22 separately batched rigid parts required')
    report = codec.validate_native({**data, 'schema': codec.SCHEMA})
    for index, part in enumerate(data['parts']):
        n = len(part['positions']) // 3
        require(part['skinIndices'] == [index, 0, 0, 0]*n, 'Rigid part index mismatch')
        require(part['skinWeights'] == [1, 0, 0, 0]*n, 'Rigid weight mismatch')
    return report


def export_native(source_raw, glb_raw):
    require(sha(source_raw) == SOURCE_SHA, 'V7 source hash mismatch')
    require(sha(glb_raw) == GLB_SHA, 'V7 GLB hash mismatch')
    doc, binary = parse_glb(glb_raw)
    nodes = scene_nodes(doc)
    require(sha(MESH.read_bytes()) == MESH_SHA, 'V7 mesh metadata hash mismatch')
    authored = {p['name']: p for p in json.loads(MESH.read_bytes())['parts']}
    require(len(authored) == 75, 'Expected exact authored mesh map')
    bones = rig()
    parts = {name: {'name': name, **{key: [] for _, _, _, key in codec.ATTRS}} for name in NAMES}
    receipt = []
    for node_index, node, parent, world in nodes:
        if 'mesh' not in node:
            continue
        require(parent is None, 'Unexpected GLB mesh parent')
        original = authored[node['name']]
        joint = semantic_joint(node['name'], original['joint'])
        part = parts[joint]
        start = len(part['positions']) // 3
        primitive_map = []
        for primitive_index, primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
            primitive_start = len(part['positions']) // 3
            require(primitive.get('mode', 4) == 4 and not primitive.get('targets'), 'Only static triangles supported')
            require(set(primitive['attributes']) == {'POSITION', 'NORMAL'}, 'Unexpected vertex channel')
            positions = accessor(doc, binary, primitive['attributes']['POSITION'])
            expected_points = {tuple(game_point(p)) for p in original['vertices']}
            require(all(tuple(p) in expected_points for p in positions), 'Authored mesh / GLB vertex mismatch')
            indices = [row[0] for row in accessor(doc, binary, primitive['indices'])]
            require(len(indices) % 3 == 0 and all(type(i) is int and 0 <= i < len(positions) for i in indices), 'Invalid triangle indices')
            material = doc['materials'][primitive['material']]
            pbr = material['pbrMetallicRoughness']
            require(set(pbr) == {'baseColorFactor', 'metallicFactor', 'roughnessFactor'}
                    and pbr['metallicFactor'] == 0 and abs(pbr['roughnessFactor']-.88) < 1e-6
                    and material.get('alphaMode', 'OPAQUE') == 'OPAQUE'
                    and not material.get('extensions') and not material.get('emissiveFactor'), 'Unsupported material response')
            color = pbr['baseColorFactor']
            require(len(color) == 4 and color[3] == 1, 'Transparency refused')
            for vertex in indices:
                part['positions'].extend(a+b for a, b in zip(positions[vertex], world))
                part['colorsLinear'].extend(color[:3])  # glTF factor is already linear.
                part['skinIndices'].extend([NAMES.index(joint), 0, 0, 0])
                part['skinWeights'].extend([1, 0, 0, 0])
                part['furLen'].append(0)
            primitive_map.append({'primitive': primitive_index, 'material': primitive['material'], 'vertexStart': primitive_start, 'vertexCount': len(indices)})
        receipt.append({'authoredJoint': original['joint'], 'primitives': primitive_map, 'node': node_index, 'name': node['name'], 'joint': joint,
                        'vertexStart': start, 'vertexCount': len(part['positions'])//3-start})
    data = {'schema': SCHEMA, 'candidate': 'Mantis V7 rigid native 1',
            'status': 'Geometry preparation only; runtime and animation untested',
            'coordinates': 'x-right y-up z-forward; unchanged glTF right-handed axes',
            'sourceSha256': SOURCE_SHA, 'glbSha256': GLB_SHA, 'bones': bones, 'parts': list(parts.values())}
    report = validate_native(data)
    require(report == {'vertices': 7986, 'triangles': 2662, 'bones': 22, 'parts': 22}, 'Pinned V7 topology changed')
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
    for name in [f'leg{s}_{i}' for s in [-1, 1] for i in range(2)]:
        row = next(r for r in mapping if r['name'] == 'Ground tarsus ' + name)
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
                                               '/assets/driftwood-isle/mantis-native')
    metadata['bodies'][0].update(kind='splinter-mantis', variant='splinter-mantis')
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
    files = {'mantis-v7-native.json': encoded(data), 'diagnostic-dimensions.json': encoded(dims),
             'mesh-map.json': encoded(mapping), 'metadata.json': encoded(metadata), 'payload.bin': packed}
    require(len(files['mantis-v7-native.json']) <= 5_000_000, 'Source JSON storage limit')
    receipt = {'schema': 'wildshard.mantis.native-preparation.v1', 'sourceSha256': SOURCE_SHA, 'glbSha256': GLB_SHA,
               'exporterSha256': sha(Path(__file__).read_bytes()), 'codecSha256': sha(CODEC_PATH.read_bytes()),
               'stats': validate_native(data), 'sourceMeshes': 75, 'sourcePrimitives': 213,
               'metricsSha256': METRICS_SHA, 'meshMetadataSha256': MESH_SHA,
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
