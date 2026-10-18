"""Read-only saved-Puffer nine-view capture with an explicit shared framing contract.

Prepare: python3 SCRIPT --describe --blend SAVED.blend --source BUILDER.py
  --version V38 --scale 4.2 --out FRESH_DIRECTORY
Render only with lane approval: blender -b -t 2 --python-exit-code 1 -P SCRIPT --
  --blend SAVED.blend --source BUILDER.py --version V38 --scale 4.2 --out FRESH_DIRECTORY
No builder execution, model edits, blend saves, baseline replacement or automatic fit.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
SHOTS = [('01-front', 0, 0), ('02-left', 90, 0), ('03-right', -90, 0),
         ('04-back', 180, 0), ('05-top', 0, 90),
         ('06-elevated-front', 0, 39.2894), ('07-elevated-left', 90, 39.2894),
         ('08-elevated-right', -90, 39.2894), ('09-elevated-back', 180, 39.2894)]
LIGHTS = [('Warm key', (-3, 4, 5), 650, 4, (1, .90, .76)),
          ('Cool fill', (4, 1, 3), 360, 4, (.73, .87, 1)),
          ('Rim', (0, -4, 4), 500, 3, (.66, .87, 1))]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--blend', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--version', required=True)
    parser.add_argument('--scale', type=float, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--describe', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else None)
    blend, source, out = args.blend.resolve(), args.source.resolve(), args.out.resolve()
    if not source.is_file():
        raise ValueError('Explicit source identity must be an existing file')
    scale = args.scale
    if not math.isfinite(scale) or scale <= 0:
        raise ValueError('Explicit fixed scale must be finite and positive')
    target_values = [0, -.05750000476837158, .7900000214576721]
    camera = {'projection': 'orthographic', 'imageSize': [600, 740],
              'fixedScale': scale, 'target': target_values, 'minimumMargin': .04}
    if not blend.is_file():
        raise ValueError('Saved Puffer inspection.blend is required; do not silently rebuild')
    outputs = [name+'.png' for name, _, _ in SHOTS] + ['shared-capture.json']
    if out == blend.parent or any((out/name).exists() for name in outputs):
        raise ValueError('Use a fresh scratch output directory; original files remain untouched')
    receipt = {'status': 'prepared, not rendered', 'version': args.version,
               'sourceBlend': str(blend.relative_to(ROOT)), 'sourceBlendSha256': digest(blend),
               'sourceBuilder': str(source.relative_to(ROOT)), 'sourceBuilderSha256': digest(source),
               'scriptSha256': digest(Path(__file__)), 'nineViewCamera': camera,
               'shots': SHOTS, 'orbitRadius': 5, 'lights': LIGHTS,
               'lightTarget': [0, 0, .7], 'worldColor': [.18]*3,
               'floorColor': [.028, .045, .06, 1], 'samples': 24,
               'denoising': False, 'viewTransform': 'AgX',
               'scope': 'New explicitly framed actual Blender diagnostic capture; not a replacement baseline, new model, game capture or visual acceptance'}
    if args.describe:
        print(json.dumps(receipt, indent=2))
        return

    import bpy
    from mathutils import Vector
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    model = bpy.data.objects.get('Puffer style revision skin')
    if model is None or model.type != 'MESH':
        raise ValueError('Saved Puffer saved model is missing')
    if any(obj.type in ('LIGHT', 'CAMERA') or obj.name == 'Ground' for obj in bpy.context.scene.objects):
        raise ValueError('Expected pre-studio Puffer inspection file; refuse ambiguous lighting')

    def model_fingerprint():
        mesh = model.data
        content = {'vertices': [list(v.co) for v in mesh.vertices],
                   'faces': [list(p.vertices) for p in mesh.polygons],
                   'colors': [list(c.color) for c in mesh.color_attributes['Col'].data],
                   'weights': [[(g.group, g.weight) for g in v.groups] for v in mesh.vertices],
                   'transform': [list(row) for row in model.matrix_world],
                   'pose': {ob.name: {bone.name: [list(row) for row in bone.matrix]
                            for bone in ob.pose.bones} for ob in bpy.context.scene.objects if ob.type == 'ARMATURE'}}
        return hashlib.sha256(json.dumps(content, separators=(',', ':')).encode()).hexdigest()

    before = model_fingerprint()
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = False
    scene.render.resolution_x, scene.render.resolution_y = 780, 960
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world.color = (.18, .18, .18)
    scene.view_settings.view_transform = 'AgX'
    floor = bpy.data.materials.new('Studio')
    floor.diffuse_color = (.028, .045, .06, 1)
    mesh = bpy.data.meshes.new('Baseline studio ground')
    mesh.from_pydata([(-100,-100,0), (100,-100,0), (100,100,0), (-100,100,0)], [], [(0,1,2,3)])
    mesh.update()
    ground = bpy.data.objects.new('Ground', mesh)
    bpy.context.collection.objects.link(ground)
    mesh.materials.append(floor)
    for name, location, power, size, color in LIGHTS:
        data = bpy.data.lights.new(name, 'AREA')
        data.energy, data.shape, data.size, data.color = power, 'DISK', size, color
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector((0,0,.7))-obj.location).to_track_quat('-Z', 'Y').to_euler()
    data = bpy.data.cameras.new('Matched style camera')
    cam = bpy.data.objects.new('Matched style camera', data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    data.type, data.ortho_scale = 'ORTHO', 3.2
    scene.render.resolution_x, scene.render.resolution_y = 600, 740
    scene.cycles.samples = 24
    target = Vector(target_values)
    data.ortho_scale = scale  # Never refit to V9 bounds: same target and scale as candidate.
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    evaluated = model.evaluated_get(bpy.context.evaluated_depsgraph_get())
    evaluated_mesh = evaluated.to_mesh()
    try:
        points = [evaluated.matrix_world @ vertex.co for vertex in evaluated_mesh.vertices]
    finally:
        evaluated.to_mesh_clear()
    if not points:
        raise ValueError('Saved Puffer has no evaluated geometry')
    receipt['worldBounds'] = [[min(p[i] for p in points), max(p[i] for p in points)] for i in range(3)]
    cameras = []
    # Preflight every orientation before any frame is rendered. Never silently refit.
    for name, yaw, elevation in SHOTS:
        y, e = math.radians(yaw), math.radians(elevation)
        cam.location = target + Vector((5*math.sin(y)*math.cos(e),
                                        5*math.cos(y)*math.cos(e), 5*math.sin(e)))
        cam.rotation_euler = (target-cam.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.view_layer.update()
        projected = [world_to_camera_view(scene, cam, point) for point in points]
        bounds = [[min(p[i] for p in projected), max(p[i] for p in projected)] for i in range(2)]
        margin = min(bounds[0][0], 1-bounds[0][1], bounds[1][0], 1-bounds[1][1])
        if margin < .04 or any(p.z <= 0 for p in projected):
            raise ValueError(f'{name}: fixed scale {scale} violates 4% margin: {margin:.6f}; choose a new explicit common scale')
        cameras.append({'name': name, 'yaw': yaw, 'elevation': elevation,
                        'location': list(cam.location), 'rotationEuler': list(cam.rotation_euler),
                        'normalizedBounds': bounds, 'minimumMargin': margin})
    receipt['cameras'] = cameras
    for shot in cameras:
        cam.location = shot['location']
        cam.rotation_euler = shot['rotationEuler']
        scene.render.filepath = str(out/(shot['name']+'.png'))
        bpy.ops.render.render(write_still=True)
    if model_fingerprint() != before or digest(blend) != receipt['sourceBlendSha256'] or digest(source) != receipt['sourceBuilderSha256']:
        raise RuntimeError('Puffer geometry or original source changed during capture')
    receipt.update(status='rendered unchanged saved Puffer with explicit shared framing',
                   geometryFingerprint=before, geometryFingerprintUnchanged=True,
                   images=[{'name': name, 'sha256': digest(out/name), 'bytes': (out/name).stat().st_size}
                           for name in outputs if name.endswith('.png')])
    (out/'shared-capture.json').write_text(json.dumps(receipt, indent=2)+'\n')


if __name__ == '__main__':
    main()
