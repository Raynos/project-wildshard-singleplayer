"""Camera-only study of unchanged V29. Actual Blender render, not game capture.
Run with approved render lane: blender -b -t 2 --python-exit-code 1 -P SCRIPT -- --out FRESH_DIR
The original hero baseline and model geometry are never changed or saved.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
SHOTS = [(f'yaw-{yaw:02d}-elev-{elevation:g}', yaw, elevation)
         for elevation in (14.34, 22, 30) for yaw in (33, 45, 57)]
LIGHTS = [('Warm key', (-3, 4, 5), 650, 4, (1, .90, .76)),
          ('Cool fill', (4, 1, 3), 360, 4, (.73, .87, 1)),
          ('Rim', (0, -4, 4), 500, 3, (.66, .87, 1))]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--blend', type=Path, default=ROOT/'tmp/puffer-lowpoly-v29-from-v9/inspection.blend')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--describe', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else None)
    blend, out = args.blend.resolve(), args.out.resolve()
    scale, target_values = 3.2, [0, -.03, .84]
    camera = {'projection': 'orthographic', 'imageSize': [520, 640],
              'fixedScale': scale, 'target': target_values}
    if not blend.is_file():
        raise ValueError('Original V29 inspection.blend is required; do not silently rebuild')
    outputs = [name+'.png' for name, _, _ in SHOTS] + ['baseline-capture.json']
    if out == blend.parent or any((out/name).exists() for name in outputs):
        raise ValueError('Use a fresh scratch output directory; original files remain untouched')
    receipt = {'status': 'prepared, not rendered', 'sourceBlendSha256': digest(blend),
               'v29BuilderSha256': digest(ROOT/'art/driftwood-isle/approved-puffer/build_puffer_lowpoly_v29_from_v9.py'),
               'scriptSha256': digest(Path(__file__)),
               'nineViewCamera': camera, 'shots': SHOTS, 'orbitRadius': math.sqrt(3**2+4.63**2+1.41**2),
               'hero': {'location': [3, 4.6, 2.25], 'target': [0, -.03, .84],
                        'orthoScale': 3.2, 'imageSize': [780, 960], 'samples': 32},
               'lights': LIGHTS, 'lightTarget': [0, 0, .7], 'worldColor': [.18]*3,
               'floorColor': [.028, .045, .06, 1], 'nineViewSamples': 16,
               'denoising': False, 'viewTransform': 'AgX',
               'comparisonScope': 'Separate camera-only study; unchanged V29, not a new model, game capture, calibrated concept match or replacement baseline'}
    if args.describe:
        print(json.dumps(receipt, indent=2))
        return

    import bpy
    from mathutils import Vector
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    model = bpy.data.objects.get('Puffer style revision skin')
    if model is None or model.type != 'MESH':
        raise ValueError('Original V29 saved model is missing')
    if any(obj.type in ('LIGHT', 'CAMERA') or obj.name == 'Ground' for obj in bpy.context.scene.objects):
        raise ValueError('Expected original pre-studio V29 inspection file; refuse ambiguous lighting')

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
    scene.render.resolution_x, scene.render.resolution_y = 520, 640
    scene.cycles.samples = 16
    target = Vector(target_values)
    data.ortho_scale = scale  # Never refit to V9 bounds: same target and scale as candidate.
    for name, yaw, elevation in SHOTS:
        yaw, elevation = math.radians(yaw), math.radians(elevation)
        cam.location = target + Vector((receipt['orbitRadius']*math.sin(yaw)*math.cos(elevation),
                                        receipt['orbitRadius']*math.cos(yaw)*math.cos(elevation), receipt['orbitRadius']*math.sin(elevation)))
        cam.rotation_euler = (target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath = str(out/(name+'.png'))
        bpy.ops.render.render(write_still=True)
    if model_fingerprint() != before or digest(blend) != receipt['sourceBlendSha256']:
        raise RuntimeError('V29 geometry or original source changed during capture')
    receipt.update(status='rendered unchanged V29 camera-only study', geometryFingerprint=before,
                   images=[{'name': name, 'sha256': digest(out/name), 'bytes': (out/name).stat().st_size}
                           for name in outputs if name.endswith('.png')])
    (out/'baseline-capture.json').write_text(json.dumps(receipt, indent=2)+'\n')


if __name__ == '__main__':
    main()
