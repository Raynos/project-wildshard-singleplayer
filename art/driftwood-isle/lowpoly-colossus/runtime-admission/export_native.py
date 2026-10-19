"""Pinned Colossus V4 rest export. No Blender, source repair or runtime writes.

All rig semantics are derived, not claimed authored. See ADMISSION.md.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import struct

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
SOURCE = HERE.parent / 'build_colossus_v4.py'
GLB = HERE.parent / 'tide-root-colossus-v4.glb'
SOURCE_SHA = 'f10cdec46537f8d579fa7af687890aebe6c2f0e9d82c962e64a478567e3a0218'
GLB_SHA = '8c94ed4a452f10ca5c9e1e663c7437c2905e42b90bf5abe9faaf970391a8189b'
SCHEMA = 'wildshard.colossus.mesh.v1'
CODEC_PATH = ROOT / 'art/driftwood-isle/approved-puffer/native_export.py'
spec = importlib.util.spec_from_file_location('existing_native_codec', CODEC_PATH)
codec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(codec)

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
        require(not any(k in node for k in ('matrix', 'rotation', 'scale', 'skin', 'weights')), 'Only exact V4 translation transforms supported')
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



def game_point(p):
    return [p[0], p[2], -p[1]]


def rig_provenance():
    rows = []
    def add(name, parent, p, reason):
        rows.append(dict(name=name, parent=parent, pos=game_point(p), blenderPivot=p,
                         pivotOrigin='derived from named V4 anatomy; not authored rig metadata', sourceStation=reason))
    add('body', None, [.11, .15, 2.28], 'Crooked pelvic trunk section 2')
    add('head', 'body', [-.05, .10, 3.73], 'Neck rear root section 0')
    for s in (-1, 1):
        add(f'arm{s}', 'body', [s*.79, .09, 3.90], 'Outer shoulder root section 0')
        add(f'forearm{s}', f'arm{s}', [s*1.81, -.17, 2.78], 'Forearm main to outer claw section 0')
        add(f'hand{s}', f'forearm{s}', [s*2.23, -.39, 1.53], 'Forearm main to outer claw section 3; derived wrist')
        for name, p, station in [('outer', [s*2.39, -.37, 1.16], 'Forearm main to outer claw section 4'),
                                  ('middle', [s*2.10, -.38, 1.54], 'Middle root digit section 0'),
                                  ('inner', [s*1.90, -.28, 1.52], 'Inner root digit section 0'),
                                  ('thumb', [s*1.98, -.28, 1.74], 'Opposed root thumb section 0')]:
            add(f'{name}{s}', f'hand{s}', p, station)
        add(f'leg{s}', 'body', [s*.31, .11, 2.19], 'Thigh load root section 0')
        add(f'shin{s}', f'leg{s}', [s*.94, -.10, 1.30], 'Thigh load root section 3')
        add(f'foot{s}', f'shin{s}', [s*1.02, .12, .58], 'Calf rear load section 2; derived ankle')
    return {'glbContainsPivots': False, 'glbContainsSkin': False, 'authoredRigMetadata': False,
            'coordinateTransform': 'Blender (x,y,z) -> glTF/native (x,z,-y), proper rotation; no reversal', 'bones': rows}


def rig():
    return [{key: row[key] for key in ('name', 'parent', 'pos')} for row in rig_provenance()['bones']]


NAMES = [b['name'] for b in rig()]
PARTS = ['body', 'head', 'arm-1', 'arm1', 'leg-1', 'leg1',
         'foliage-body', 'foliage-head', 'foliage-arm-1', 'foliage-arm1', 'foliage-leg-1', 'foliage-leg1']
ARM_PREFIXES = ('Outer shoulder root', 'Arm descending trunk', 'Upper arm crossing bark', 'Elbow outer hook',
                'Forearm main to outer claw', 'Forearm inner braid', 'Front forearm blade', 'Middle root digit',
                'Inner root digit', 'Opposed root thumb', 'Arm winding bark ridge', 'Forearm diagonal living root')
LEG_PREFIXES = ('Thigh load root', 'Thigh oblique bark', 'Embedded knee rock', 'Calf rear load', 'Calf crossing root',
                'Front ankle anchoring root', 'Outer embedded foot stone', 'Inner grounded stone', 'Rear heel stone',
                'Hip fork', 'Lower leg lateral root', 'Inner toe clasp')
HEAD_PREFIXES = ('Neck rear root', 'Long tapered bark mask', 'Recessed eye socket', 'Narrow cyan eye',
                 'Crown cheek flow', 'Brow descending ridge', 'Crown left', 'Crown right')
BODY_NAMES = {'Crooked pelvic trunk', 'Left chest load root', 'Right chest load root', 'Left clavicle cascade',
              'Right clavicle cascade', 'Left lower cradle', 'Right diagonal cradle', 'Left upper inward rib',
              'Right upper inward rib', 'Waist front spur', 'Rear diagonal trunk', 'Left scapular arch',
              'Right scapular arch', 'Crossback lower root', 'Exposed turquoise heart'}
BODY_FOLIAGE = ('Collar growth', 'Left upper back mantle', 'Right lower back mantle', 'Spinal growth',
                'Low rear hip growth', 'Left forward rib growth')


def ownership(name):
    """Explicit region map; unknown names fail rather than silently become torso."""
    side = re.search(r' (-1|1)(?: |$)', name)
    s = side.group(1) if side else ''
    foliage = ' living seam' in name or ' layered blade ' in name
    if foliage:
        if name.startswith(('Outer shoulder growth', 'Elbow growth', 'Forearm side growth')):
            region = 'arm'+s
        elif name.startswith(('Hip growth', 'Shin growth')): region = 'leg'+s
        elif name.startswith('Rear nape leaves'): region = 'head'
        else:
            require(name.startswith(BODY_FOLIAGE), 'Unmapped foliage: '+name)
            region = 'body'
    elif name.startswith(ARM_PREFIXES): region = 'arm'+s
    elif name.startswith(LEG_PREFIXES): region = 'leg'+s
    elif name.startswith(HEAD_PREFIXES): region = 'head'
    else:
        require(name in BODY_NAMES or name.startswith(('Upper heart clasp', 'Lower heart claw')), 'Unmapped anatomy: '+name)
        region = 'body'
    part = ('foliage-' if foliage else '')+region
    require(part in PARTS, 'Missing side or region: '+name)
    return part, region


def blend(a, b, value, lo, hi):
    t = min(1., max(0., (value-lo)/(hi-lo)))
    return [(a, 1-t), (b, t)]


def weights(name, region, point):
    """Shared spatial fields keep coincident vertices in a region coincident.

    Joint bands are explicit derived trial parameters, not animation admission.
    Leaves and seams use the same field as their named supporting limb. No
    independent leaf motion is introduced; interwoven anatomy is not segmented.
    """
    y = point[1]
    if region == 'body': groups = [('body', 1)]
    elif region == 'head':
        # Neck roots bridge the torso; face/crown/foliage stay rigid on head.
        groups = blend('body', 'head', y, 3.73, 4.15) if name == 'Neck rear root' else [('head', 1)]
    elif region.startswith('arm'):
        s = region[3:]
        digit = next((key for prefix, key in [('Forearm main to outer claw', 'outer'), ('Middle root digit', 'middle'),
                      ('Inner root digit', 'inner'), ('Opposed root thumb', 'thumb')] if name.startswith(prefix)), None)
        # Finger motion fades in below its overlap with the shared palm field.
        threshold = {'outer': (0.95, 1.16), 'middle': (1.22, 1.54), 'inner': (1.21, 1.52), 'thumb': (1.25, 1.74)}
        if y < 1.95: groups = blend('hand'+s, 'forearm'+s, y, 1.50, 1.95)
        elif y < 3.10: groups = blend('forearm'+s, 'arm'+s, y, 2.70, 3.10)
        else: groups = blend('arm'+s, 'body', y, 3.70, 4.20)
        if digit is not None:
            lo, hi = threshold[digit]
            t = min(1., max(0., (hi-y)/(hi-lo)))
            groups = [(joint, weight*(1-t)) for joint, weight in groups] + [(digit+s, t)]
    else:
        s = region[3:]
        if y < .80: groups = blend('foot'+s, 'shin'+s, y, .35, .80)
        elif y < 1.65: groups = blend('shin'+s, 'leg'+s, y, 1.10, 1.65)
        else: groups = blend('leg'+s, 'body', y, 1.95, 2.45)
    return codec.influences(groups, {n: i for i, n in enumerate(NAMES)})


def validate_native(data):
    require(data['schema'] == SCHEMA, 'Wrong Colossus schema')
    require(data['bones'] == rig(), 'Exact derived V4 rig required')
    require([p['name'] for p in data['parts']] == PARTS, 'Exact semantic batches required')
    return codec.validate_native({**data, 'schema': codec.SCHEMA})


def export_native(source_raw, glb_raw):
    require(sha(source_raw) == SOURCE_SHA, 'V4 source hash mismatch')
    require(sha(glb_raw) == GLB_SHA, 'V4 GLB hash mismatch')
    doc, binary = parse_glb(glb_raw)
    nodes = scene_nodes(doc)
    parts = {name: {'name': name, **{key: [] for _, _, _, key in codec.ATTRS}} for name in PARTS}
    receipt = []
    for node_index, node, parent, world in nodes:
        require('mesh' in node and parent is None, 'Unexpected V4 scene topology')
        part_name, region = ownership(node['name'])
        part = parts[part_name]
        start = len(part['positions'])//3
        primitive_map = []
        for primitive_index, primitive in enumerate(doc['meshes'][node['mesh']]['primitives']):
            primitive_start = len(part['positions'])//3
            require(primitive.get('mode', 4) == 4 and not primitive.get('targets'), 'Only static triangles supported')
            require(set(primitive['attributes']) == {'POSITION', 'NORMAL'}, 'Unexpected vertex channel')
            positions = accessor(doc, binary, primitive['attributes']['POSITION'])
            indices = [row[0] for row in accessor(doc, binary, primitive['indices'])]
            require(len(indices)%3 == 0 and all(type(i) is int and 0 <= i < len(positions) for i in indices), 'Invalid triangle indices')
            material = doc['materials'][primitive['material']]
            pbr = material['pbrMetallicRoughness']
            require(set(pbr) == {'baseColorFactor', 'metallicFactor', 'roughnessFactor'}
                    and pbr['metallicFactor'] == 0 and abs(pbr['roughnessFactor']-.88) < 1e-6
                    and material.get('alphaMode', 'OPAQUE') == 'OPAQUE' and not material.get('extensions'), 'Unsupported material response')
            color = pbr['baseColorFactor']
            require(len(color) == 4 and color[3] == 1, 'Transparency refused')
            for vertex in indices:
                point = [a+b for a, b in zip(positions[vertex], world)]
                ids, values = weights(node['name'], region, point)
                part['positions'].extend(point)
                part['colorsLinear'].extend(color[:3])
                part['skinIndices'].extend(ids)
                part['skinWeights'].extend(values)
                part['furLen'].append(0)
            primitive_map.append(dict(primitive=primitive_index, material=primitive['material'], vertexStart=primitive_start, vertexCount=len(indices)))
        receipt.append(dict(node=node_index, name=node['name'], joint=part_name, weightRegion=region,
                            sourceWorldTranslation=world, authoredJoint=None, primitives=primitive_map,
                            vertexStart=start, vertexCount=len(part['positions'])//3-start))
    data = dict(schema=SCHEMA, candidate='Colossus V4 derived skin 1',
                status='Exact rest geometry preparation; derived deformation and native appearance not admitted',
                coordinates='x-right y-up z-forward; unchanged glTF right-handed axes', sourceSha256=SOURCE_SHA,
                glbSha256=GLB_SHA, bones=rig(), parts=list(parts.values()))
    require(validate_native(data) == dict(vertices=15600, triangles=5200, bones=22, parts=12), 'Pinned V4 topology changed')
    require(len(receipt) == 227 and sum(len(r['primitives']) for r in receipt) == 730, 'Pinned V4 mesh/primitive map changed')
    return data, receipt


def diagnostic_dimensions(data, mapping):
    vertices = [p['positions'][i:i+3] for p in data['parts'] for i in range(0, len(p['positions']), 3)]
    body_y = data['bones'][0]['pos'][1]
    head = data['bones'][1]['pos']
    head_points = [p['positions'][i:i+3] for p in data['parts'] if p['name'] in ('head', 'foliage-head') for i in range(0, len(p['positions']), 3)]
    feet = []
    for side in (-1, 1):
        part = next(p for p in data['parts'] if p['name'] == f'leg{side}')
        points = [part['positions'][i:i+3] for i in range(0, len(part['positions']), 3)]
        low = min(p[1] for p in points)
        sole = [p for p in points if p[1] <= low+.015]
        feet.append([(min(p[a] for p in sole)+max(p[a] for p in sole))/2 for a in (0, 2)])
    return dict(bodyY=body_y, bodyHalfLen=max(abs(v[2]) for v in vertices),
                bodyRadius=max(math.hypot(v[0], v[1]-body_y) for v in vertices),
                headRadius=max(math.dist(v, head) for v in head_points), legLen=body_y,
                feet=feet, halfWidth=max(abs(v[0]) for v in vertices), capsuleAxis='z')


def pack_native(data, dimensions):
    validate_native(data)
    metadata, packed = codec.pack_native_puffer({**data, 'schema': codec.SCHEMA}, dimensions,
                                               '/assets/driftwood-isle/colossus-native')
    metadata['bodies'][0].update(kind='tideRootColossus', variant='tide-root-colossus')
    return metadata, packed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True, help='New runtime-admission child directory')
    args = parser.parse_args()
    out = args.out.resolve()
    require(out.is_relative_to(HERE) and out != HERE, 'Output must be a new runtime-admission child')
    require(not out.exists(), 'Output exists; preserve previous closure')
    data, mapping = export_native(SOURCE.read_bytes(), GLB.read_bytes())
    dims = diagnostic_dimensions(data, mapping)
    metadata, packed = pack_native(data, dims)
    doc, _ = parse_glb(GLB.read_bytes())
    files = {'colossus-v4-native.json': encoded(data), 'diagnostic-dimensions.json': encoded(dims),
             'mesh-map.json': encoded(mapping), 'metadata.json': encoded(metadata), 'payload.bin': packed,
             'rig-provenance.json': encoded(rig_provenance()), 'source-materials.json': encoded(doc['materials'])}
    require(len(files['colossus-v4-native.json']) <= 5_000_000, 'Source JSON storage limit')
    receipt = dict(schema='wildshard.colossus.native-preparation.v1', sourceSha256=SOURCE_SHA, glbSha256=GLB_SHA,
                   exporterSha256=sha(Path(__file__).read_bytes()), codecSha256=sha(CODEC_PATH.read_bytes()),
                   stats=validate_native(data), sourceMeshes=227, sourcePrimitives=730,
                   files={name: dict(sha256=sha(raw), bytes=len(raw)) for name, raw in files.items()},
                   geometryAcceptance=False, animationAcceptance=False, colliderAcceptance=False,
                   runtimeAcceptance=False, phonePerformanceAcceptance=False,
                   materialNote='Linear base color retained. Emissive factors and doubleSided retained in sidecar only; packed schema cannot carry either. Toon appearance is unaccepted.',
                   dimensionsNote='Conservative full rest hull only, not gameplay tuning. Derived skin and contacts untested visually.')
    out.mkdir()
    for name, raw in {**files, 'closure.json': encoded(receipt)}.items():
        with (out/name).open('xb') as output: output.write(raw)
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
