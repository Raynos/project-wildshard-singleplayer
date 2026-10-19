"""Exact V6 GLB -> existing packedCreatureBodies codec; no Blender/runtime writes.

This deliberately supports ONLY the pinned, opaque, translation-only V6 scene.
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
SOURCE = ROOT / 'art/driftwood-isle/lowpoly-bellback/build_bellback_v6.py'
GLB = ROOT / 'tmp/bellback-v6-review/bellback-study-v6.glb'
SOURCE_SHA = '952a8ddca0991a5aaaf1044d3a0498626567d6805881b77e43450c65f1e90a1d'
GLB_SHA = 'ec5850fda8a97e7eef064098fdb212d4e2be2f5dc4699548de0430f812b8e7b0'
SCHEMA = 'wildshard.bellback.mesh.v1'
CODEC_PATH = ROOT / 'art/driftwood-isle/approved-puffer/native_export.py'
spec = importlib.util.spec_from_file_location('existing_native_codec', CODEC_PATH)
codec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(codec)
PIVOTS = [('body', 'Body_PIVOT'), ('head', 'Head_PIVOT'), ('bell', 'Bell_PIVOT'),
          ('leg0', 'Left fore_PIVOT'), ('leg1', 'Right fore_PIVOT'),
          ('leg2', 'Left hind_PIVOT'), ('leg3', 'Right hind_PIVOT')]
NAMES = ['body', 'head', 'bell', 'clapper', 'leg0', 'leg1', 'leg2', 'leg3']


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
        require(not any(k in node for k in ('matrix', 'rotation', 'scale', 'skin', 'weights')), 'Only exact V6 translation transforms supported')
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
    require(data['schema'] == SCHEMA, 'Wrong Bellback schema')
    require([b['name'] for b in data['bones']] == NAMES, 'Exact V6 rig required')
    require([p['name'] for p in data['parts']] == NAMES, 'Eight separately batched rigid parts required')
    require(data['bones'][3]['parent'] == 'bell', 'Clapper must inherit bell')
    for index, bone in enumerate(data['bones']):
        require(bone['parent'] == (None if index == 0 else 'bell' if index == 3 else 'body'), 'Invalid V6 parent')
    report = codec.validate_native({**data, 'schema': codec.SCHEMA})
    for index, part in enumerate(data['parts']):
        n = len(part['positions']) // 3
        require(part['skinIndices'] == [index, 0, 0, 0]*n, 'Rigid part index mismatch')
        require(part['skinWeights'] == [1, 0, 0, 0]*n, 'Rigid weight mismatch')
    return report


def export_native(source_raw, glb_raw):
    require(sha(source_raw) == SOURCE_SHA, 'V6 source hash mismatch')
    require(sha(glb_raw) == GLB_SHA, 'V6 GLB hash mismatch')
    doc, binary = parse_glb(glb_raw)
    nodes = scene_nodes(doc)
    by_name = {node['name']: world for _, node, _, world in nodes}
    require(len(by_name) == len(nodes), 'Duplicate node names')
    pivots = {name: by_name[pivot] for name, pivot in PIVOTS}
    # Exact V6 bp((0,0,1.19)): clapper stem attachment, not its weight centre.
    # Blender bell origin (0,-.20,1.88), axis tilted -30 degrees around X.
    pivots['clapper'] = [0, 1.88 + math.cos(math.pi/6)*1.19, .20 - .5*1.19]
    bones = [{'name': name, 'parent': None if name == 'body' else 'bell' if name == 'clapper' else 'body',
              'pos': pivots[name]} for name in NAMES]
    parts = {name: {'name': name, **{key: [] for _, _, _, key in codec.ATTRS}} for name in NAMES}
    groups = {pivot: name for name, pivot in PIVOTS}
    receipt = []
    for node_index, node, parent, world in nodes:
        if 'mesh' not in node:
            continue
        require(parent in groups, 'Unexpected mesh parent')
        joint = 'clapper' if node['name'] in ('Clapper stem', 'Clapper weight') else groups[parent]
        part = parts[joint]
        start = len(part['positions']) // 3
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            require(primitive.get('mode', 4) == 4 and not primitive.get('targets'), 'Only static triangles supported')
            require(set(primitive['attributes']) == {'POSITION', 'NORMAL'}, 'Unexpected vertex channel')
            positions = accessor(doc, binary, primitive['attributes']['POSITION'])
            indices = [row[0] for row in accessor(doc, binary, primitive['indices'])]
            require(len(indices) % 3 == 0 and all(type(i) is int and 0 <= i < len(positions) for i in indices), 'Invalid triangle indices')
            material = doc['materials'][primitive['material']]
            pbr = material['pbrMetallicRoughness']
            require(set(pbr) == {'baseColorFactor', 'metallicFactor', 'roughnessFactor'}
                    and pbr['metallicFactor'] == 0 and abs(pbr['roughnessFactor']-.85) < 1e-6
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
        receipt.append({'node': node_index, 'name': node['name'], 'joint': joint,
                        'vertexStart': start, 'vertexCount': len(part['positions'])//3-start})
    data = {'schema': SCHEMA, 'candidate': 'Bellback V6 rigid native 1',
            'status': 'Geometry preparation only; runtime and animation untested',
            'coordinates': 'x-right y-up z-forward; unchanged glTF right-handed axes',
            'sourceSha256': SOURCE_SHA, 'glbSha256': GLB_SHA, 'bones': bones, 'parts': list(parts.values())}
    report = validate_native(data)
    require(report == {'vertices': 13374, 'triangles': 4458, 'bones': 8, 'parts': 8}, 'Pinned V6 topology changed')
    return data, receipt


def diagnostic_dimensions(data, mapping):
    """Conservative rest-only capsule; deliberately NOT admitted gameplay tuning."""
    by_name = {p['name']: p for p in data['parts']}
    points = lambda part: list(zip(*[iter(part['positions'])]*3))
    vertices = [v for part in data['parts'] for v in points(part)]
    body_y = data['bones'][0]['pos'][1]
    radius = max(math.hypot(v[0], v[1]-body_y) for v in vertices)
    head = data['bones'][1]['pos']
    feet = []
    for name in NAMES[4:]:
        soles = [p for p in points(by_name[name]) if abs(p[1]) < 1e-7]
        require(soles, 'Missing ground-plane sole')
        feet.append([(min(p[a] for p in soles)+max(p[a] for p in soles))/2 for a in (0, 2)])
    return {'bodyY': body_y, 'bodyHalfLen': max(abs(v[2]) for v in vertices), 'bodyRadius': radius,
            'headRadius': max(math.dist(v, head) for v in points(by_name['head'])),
            'legLen': body_y, 'feet': feet, 'halfWidth': max(abs(v[0]) for v in vertices), 'capsuleAxis': 'z'}


def pack_native(data, dimensions):
    validate_native(data)
    metadata, packed = codec.pack_native_puffer({**data, 'schema': codec.SCHEMA}, dimensions,
                                               '/assets/driftwood-isle/bellback-native')
    metadata['bodies'][0].update(kind='bellback', variant='bellback')
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
    files = {'bellback-v6-native.json': encoded(data), 'diagnostic-dimensions.json': encoded(dims),
             'mesh-map.json': encoded(mapping), 'metadata.json': encoded(metadata), 'payload.bin': packed}
    require(len(files['bellback-v6-native.json']) <= 5_000_000, 'Source JSON storage limit')
    receipt = {'schema': 'wildshard.bellback.native-preparation.v1', 'sourceSha256': SOURCE_SHA, 'glbSha256': GLB_SHA,
               'exporterSha256': sha(Path(__file__).read_bytes()), 'codecSha256': sha(CODEC_PATH.read_bytes()),
               'stats': validate_native(data), 'sourceMeshes': 73, 'sourcePrimitives': 166,
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
