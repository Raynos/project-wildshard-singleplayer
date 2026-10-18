"""Capture original V9 unchanged with a shared candidate-camera receipt.

Preparation: python3 <script> --describe --camera <nine-view-camera.json> --out <scratch>
Render only with coordinator lane: blender -b -t 2 --python-exit-code 1 -P <script> --
  --camera <nine-view-camera.json> --out <new scratch directory>
No geometry builder runs, no blend/GLB is saved, no existing frame is replaced.
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
    parser.add_argument('--blend', type=Path, default=ROOT/'tmp/puffer-lowpoly-v9/inspection.blend')
    parser.add_argument('--camera', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--describe', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else None)
    blend, camera_path, out = args.blend.resolve(), args.camera.resolve(), args.out.resolve()
    camera = json.loads(camera_path.read_text())
    if camera['projection'] != 'orthographic' or camera['imageSize'] != [600, 740]:
        raise ValueError('Expected the V27/V28 orthographic 600x740 shared camera contract')
    scale, target_values = camera['fixedScale'], camera['target']
    if not math.isfinite(scale) or scale <= 0 or len(target_values) != 3 or not all(math.isfinite(v) for v in target_values):
        raise ValueError('Invalid shared camera receipt')
    if not blend.is_file():
        raise ValueError('Original V9 inspection.blend is required; do not silently rebuild')
    outputs = ['matched-style.png'] + [name+'.png' for name, _, _ in SHOTS] + ['baseline-capture.json']
    if out == blend.parent or any((out/name).exists() for name in outputs):
        raise ValueError('Use a fresh scratch output directory; original files remain untouched')
    receipt = {'status': 'prepared, not rendered', 'sourceBlendSha256': digest(blend),
               'v9BuilderSha256': digest(ROOT/'art/driftwood-isle/approved-puffer/build_puffer_lowpoly_v9.py'),
               'cameraReceiptSha256': digest(camera_path), 'scriptSha256': digest(Path(__file__)),
               'nineViewCamera': camera, 'shots': SHOTS, 'orbitRadius': 5,
               'hero': {'location': [3, 4.6, 2.25], 'target': [0, -.03, .84],
                        'orthoScale': 3.2, 'imageSize': [780, 960], 'samples': 32},
               'lights': LIGHTS, 'lightTarget': [0, 0, .7], 'worldColor': [.18]*3,
               'floorColor': [.028, .045, .06, 1], 'nineViewSamples': 24,
               'denoising': False, 'viewTransform': 'AgX',
               'comparisonScope': 'Exact shared diagnostic camera and studio settings, not AI mockup camera verification or game rendering'}
    if args.describe:
        print(json.dumps(receipt, indent=2))
        return

    import bpy
    from mathutils import Vector
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    model = bpy.data.objects.get('Puffer style revision skin')
    if model is None or model.type != 'MESH':
        raise ValueError('Original V9 saved model is missing')
    if any(obj.type in ('LIGHT', 'CAMERA') or obj.name == 'Ground' for obj in bpy.context.scene.objects):
        raise ValueError('Expected original pre-studio V9 inspection file; refuse ambiguous lighting')

    def model_fingerprint():
        mesh = model.data
        content = {'vertices': [list(v.co) for v in mesh.vertices],
                   'faces': [list(p.vertices) for p in mesh.polygons],
                   'colors': [list(c.color) for c in mesh.color_attributes['Col'].data],
                   'weights': [[(g.group, g.weight) for g in v.groups] for v in mesh.vertices],
                   'transform': [list(row) for row in model.matrix_world]}
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
    cam.location = (3, 4.6, 2.25)
    cam.rotation_euler = (Vector((0,-.03,.84))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(out/'matched-style.png')
    bpy.ops.render.render(write_still=True)
    scene.render.resolution_x, scene.render.resolution_y = 600, 740
    scene.cycles.samples = 24
    target = Vector(target_values)
    data.ortho_scale = scale  # Never refit to V9 bounds: same target and scale as candidate.
    for name, yaw, elevation in SHOTS:
        yaw, elevation = math.radians(yaw), math.radians(elevation)
        cam.location = target + Vector((5*math.sin(yaw)*math.cos(elevation),
                                        5*math.cos(yaw)*math.cos(elevation), 5*math.sin(elevation)))
        cam.rotation_euler = (target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath = str(out/(name+'.png'))
        bpy.ops.render.render(write_still=True)
    if model_fingerprint() != before or digest(blend) != receipt['sourceBlendSha256']:
        raise RuntimeError('V9 geometry or original source changed during capture')
    receipt.update(status='rendered unchanged V9 diagnostic baseline', geometryFingerprint=before,
                   images=[{'name': name, 'sha256': digest(out/name), 'bytes': (out/name).stat().st_size}
                           for name in outputs if name.endswith('.png')])
    (out/'baseline-capture.json').write_text(json.dumps(receipt, indent=2)+'\n')


if __name__ == '__main__':
    main()
