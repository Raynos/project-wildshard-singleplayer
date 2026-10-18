"""Build-only Puffer bridge. No bpy import: validation/packing run in plain Python.

Native bones are identity-oriented absolute bind pivots. Blender edit-bone axes
are deliberately NOT animation axes: do not reuse Blender local animation curves.
Call after applying geometry modifiers and authoring weights, before joining.
"""
import hashlib
import json
import math
import re
from pathlib import Path
import struct
import zlib

SCHEMA = 'wildshard.puffer.mesh.v2'
ATTRS = [('position', 'f32', 3, 'positions'),
         ('color', 'f32', 3, 'colorsLinear'),
         ('skinIndex', 'u16', 4, 'skinIndices'),
         ('skinWeight', 'f32', 4, 'skinWeights'),
         ('furLen', 'f32', 1, 'furLen')]


def game_point(point):
    return [float(point[0]), float(point[2]), float(point[1])]


def influences(groups, bone_indices):
    """Retain all authored influences; refuse >4 rather than silently prune."""
    weights = {}
    for name, weight in groups:
        if not math.isfinite(weight) or weight < 0:
            raise ValueError('Invalid skin weight')
        if weight == 0:
            continue
        if name not in bone_indices:
            raise ValueError('Unknown weighted joint: ' + name)
        index = bone_indices[name]
        weights[index] = weights.get(index, 0) + weight
    if not weights or len(weights) > 4:
        raise ValueError('Each vertex needs one to four bone influences')
    total = sum(weights.values())
    ordered = sorted(weights.items(), key=lambda row: (-row[1], row[0]))
    return ([i for i, _ in ordered] + [0] * (4-len(ordered)),
            [w/total for _, w in ordered] + [0.] * (4-len(ordered)))


def validate_native(data):
    if data['schema'] != SCHEMA:
        raise ValueError('Unsupported Puffer schema')
    bones = data['bones']
    if not bones or bones[0]['name'] != 'body' or bones[0]['parent'] is not None:
        raise ValueError('body must be the first root')
    names = set()
    for bone in bones:
        if (bone['name'] in names or (names and bone['parent'] is None)
                or (bone['parent'] is not None and bone['parent'] not in names)):
            raise ValueError('Duplicate bone or non-topological parent')
        if len(bone['pos']) != 3 or not all(math.isfinite(x) for x in bone['pos']):
            raise ValueError('Invalid absolute bind position')
        names.add(bone['name'])
    if 'head' not in names or len(bones) > 512:
        raise ValueError('Missing head socket or too many bones')
    if not data['parts'] or len(data['parts']) > 64:
        raise ValueError('Expected one to 64 parts')
    vertices = 0
    for part in data['parts']:
        n = len(part['positions']) // 3
        if not n or n % 3:
            raise ValueError('Expected unindexed triangles')
        for _, _, width, key in ATTRS:
            values = part[key]
            if len(values) != n*width or not all(math.isfinite(x) for x in values):
                raise ValueError('Invalid attribute: ' + key)
        if any(x < 0 or x > 1 for x in part['colorsLinear']):
            raise ValueError('Linear paint out of range')
        if any(type(i) is not int or i < 0 or i >= len(bones) for i in part['skinIndices']):
            raise ValueError('Invalid skin index')
        if any(w < 0 or w > 1 for w in part['skinWeights']):
            raise ValueError('Invalid skin weight')
        if any(abs(sum(part['skinWeights'][i:i+4])-1) > 1e-6 for i in range(0, n*4, 4)):
            raise ValueError('Skin weights must sum to one')
        if any(part['furLen']):
            raise ValueError('Puffer has no fur')
        vertices += n
    return {'vertices': vertices, 'triangles': vertices//3, 'bones': len(bones), 'parts': len(data['parts'])}


def export_native_puffer(path, objects, armature):
    """Export final rest mesh/linear CORNER or POINT paint, with real weights.

    Unapplied modifiers fail rather than exporting stale base geometry. Global
    object transforms are baked into vertices/pivots. No live scene is modified.
    """
    import bpy
    bpy.context.view_layer.update()
    for pose in armature.pose.bones:
        if pose.constraints:
            raise ValueError('Bake or remove bone constraints before native export')
        if any(abs(pose.matrix_basis[i][j] - (1 if i == j else 0)) > 1e-6
               for i in range(4) for j in range(4)):
            raise ValueError('Export requires rest pose channels')
    bones = []
    pending = list(armature.data.bones)
    while pending:
        ready = [b for b in pending if b.parent is None or b.parent.name in {x['name'] for x in bones}]
        if not ready:
            raise ValueError('Cyclic rig')
        ready.sort(key=lambda b: b.name != 'body')
        for bone in ready:
            bones.append({'name': bone.name, 'parent': bone.parent.name if bone.parent else None,
                          'pos': game_point(armature.matrix_world @ bone.head_local)})
            pending.remove(bone)
    indices = {b['name']: i for i, b in enumerate(bones)}
    data = {'schema': SCHEMA, 'status': 'unaccepted integration preparation',
            'coordinates': 'x-right y-up z-forward', 'bones': bones, 'parts': []}
    for obj in objects:
        if obj.type != 'MESH':
            raise ValueError('Expected mesh object')
        for mod in obj.modifiers:
            if mod.type != 'ARMATURE' or mod.object != armature:
                raise ValueError('Apply geometry modifiers before native export: ' + obj.name)
            if mod.use_deform_preserve_volume:
                raise ValueError('Native skin uses linear blending, not preserve-volume deformation')
        mesh = obj.data
        if mesh.shape_keys is not None and any(abs(key.value) > 1e-8 for key in mesh.shape_keys.key_blocks[1:]):
            raise ValueError('Apply active shape keys before native export')
        mesh.calc_loop_triangles()
        paint = mesh.color_attributes.get('Col')
        if paint is None or paint.domain not in ('POINT', 'CORNER'):
            raise ValueError('Missing linear Col paint: ' + obj.name)
        group_names = {g.index: g.name for g in obj.vertex_groups}
        weights = [influences([(group_names[g.group], g.weight) for g in vertex.groups], indices)
                   for vertex in mesh.vertices]
        part = {'name': obj.name, **{key: [] for _, _, _, key in ATTRS}}
        determinant = obj.matrix_world.to_3x3().determinant()
        if abs(determinant) < 1e-10:
            raise ValueError('Singular object transform')
        for triangle in mesh.loop_triangles:
            # Axis swap reflects; a mirrored object reflects a second time.
            loops = reversed(triangle.loops) if determinant > 0 else triangle.loops
            for loop in loops:
                vertex = mesh.loops[loop].vertex_index
                part['positions'].extend(game_point(obj.matrix_world @ mesh.vertices[vertex].co))
                part['colorsLinear'].extend(float(c) for c in paint.data[loop if paint.domain == 'CORNER' else vertex].color[:3])
                ids, values = weights[vertex]
                part['skinIndices'].extend(ids)
                part['skinWeights'].extend(values)
                part['furLen'].append(0.)
        data['parts'].append(part)
    validate_native(data)
    encoded = json.dumps(data, separators=(',', ':'), allow_nan=False).encode()
    if len(encoded) > 5_000_000:
        raise ValueError('Native JSON exceeds storage budget')
    Path(path).write_bytes(encoded)
    return data


def pack_native_puffer(data, dims, asset_prefix='/assets/driftwood-isle/puffer-native'):
    """Return packedCreatureBodies-compatible metadata and zlib bytes.

    Explicit dimensions must be reviewed for the new hull. This function neither
    selects old gameplay dimensions nor writes/rebakes any runtime catalogue.
    """
    validate_native(data)
    if re.fullmatch(r'/assets/[a-zA-Z0-9/_-]+', asset_prefix) is None:
        raise ValueError('Invalid packed asset prefix')
    required = {'bodyY', 'bodyHalfLen', 'bodyRadius', 'headRadius', 'legLen', 'feet', 'halfWidth'}
    if set(dims) not in (required, required | {'capsuleAxis'}):
        raise ValueError('Explicit AnimalDims required')
    for key in required - {'feet'}:
        if not math.isfinite(dims[key]) or dims[key] < 0:
            raise ValueError('Invalid dimension: ' + key)
    if abs(dims['bodyY'] - data['bones'][0]['pos'][1]) > 1e-6:
        raise ValueError('bodyY must match the exported body bind pivot')
    if any(len(p) != 2 or not all(math.isfinite(v) for v in p) for p in dims['feet']):
        raise ValueError('Invalid foot rest positions')
    if dims.get('capsuleAxis', 'z') not in ('z', 'y'):
        raise ValueError('Invalid capsule axis')
    binary = bytearray()
    parts = []
    for source in data['parts']:
        offsets = []
        for _, kind, _, key in ATTRS:
            offsets.append(len(binary))
            values = source[key]
            binary.extend(struct.pack('<' + ('H' if kind == 'u16' else 'f')*len(values), *values))
            binary.extend(bytes((-len(binary)) % 4))
        parts.append({'offsets': offsets, 'row': {'attrs': [[name, kind, width, False] for name, kind, width, _ in ATTRS],
                      'count': len(source['positions'])//3, 'index': None, 'indexCount': 0, 'box': True}})
    compressed = zlib.compress(binary, 9)
    if len(compressed) > 1_000_000:
        raise ValueError('Packed Puffer exceeds binary storage budget')
    digest = hashlib.sha256(compressed).hexdigest()
    metadata = {'file': asset_prefix+'-'+digest+'.bin', 'bytes': len(binary),
                'bodies': [{'kind': 'brine-puffer', 'variant': 'brine-puffer', 'bones': data['bones'],
                            'dims': dims, 'fur': None, 'hard': parts, 'eye': None}]}
    return metadata, compressed


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Validate and pack one real Puffer export, without runtime writes')
    parser.add_argument('source', type=Path)
    parser.add_argument('dims', type=Path, help='Explicit reviewed/test-only AnimalDims JSON')
    parser.add_argument('out', type=Path, help='Scratch output directory; never a runtime catalogue')
    args = parser.parse_args()
    source = json.loads(args.source.read_text())
    dimensions = json.loads(args.dims.read_text())
    report = validate_native(source)
    metadata, compressed = pack_native_puffer(source, dimensions)
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out/'metadata.json').write_text(json.dumps(metadata, separators=(',', ':')))
    (args.out/'payload.bin').write_bytes(compressed)
    print(json.dumps({**report, 'compressedBytes': len(compressed),
                      'sourceBytes': args.source.stat().st_size, 'runtimeAcceptance': False}))
