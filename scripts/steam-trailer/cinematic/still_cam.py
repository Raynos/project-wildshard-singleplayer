"""TRAILERS T15 (E471): film a projected painting (`still_mesh.py`) with a real camera move in Blender.

  blender -b --python still_cam.py -- <mesh.obj> <moves.json> <outDir> [--fps 60] [--res 1920x1080] [--samples 16]

The mesh is unlit (emission = the painting), so the frame at the start of the move is the painting itself. moves.json:
  {"seconds": 15, "keys": [{"t": 0, "loc": [0, 0, 0], "rot": [0, 0, 0], "fov": null}, {"t": 15, "loc": [0, -0.2, -1.5], ...}],
   "ease": "sine"}
loc is in the mesh's units (MoGe metres), relative to where the painting was taken (the origin, looking down −z); rot is
degrees (x pitch, y yaw, z roll) added to that view; fov (degrees, horizontal) overrides the painting's. Keep moves
small (a push of ~10–30 % of the subject's distance): projection stretches where the painting has no pixels.
Writes <outDir>/%04d.png.
"""
import bpy, json, math, os, sys
argv = sys.argv[sys.argv.index('--') + 1:]
mesh, moves_p, out = argv[0], argv[1], argv[2]
opt = dict(zip(argv[3::2], argv[4::2]))
fps = int(opt.get('--fps', 60)); rw, rh = map(int, opt.get('--res', '1920x1080').split('x'))
meta = json.load(open(mesh[:-4] + '.json'))
moves = json.load(open(moves_p))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.wm.obj_import(filepath=mesh, forward_axis='NEGATIVE_Z', up_axis='Y')
obj = bpy.context.selected_objects[0]
obj.rotation_euler = (0, 0, 0)
# unlit: the painting's own pixels, no shading
mat = bpy.data.materials.new('paint'); mat.use_nodes = True
nt = mat.node_tree; nt.nodes.clear()
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(open(mesh[:-4] + '.mtl').read().split('map_Kd ')[1].strip())
tex.interpolation = 'Cubic'; tex.extension = 'EXTEND'
em = nt.nodes.new('ShaderNodeEmission'); outn = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(tex.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], outn.inputs['Surface'])
obj.data.materials.clear(); obj.data.materials.append(mat)

cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.sensor_fit = 'HORIZONTAL'; cam_d.clip_start = 0.01; cam_d.clip_end = meta['zfar'] * 4
base_fov = math.degrees(meta['fov_x'])

sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys() else 'BLENDER_EEVEE'
sc.eevee.taa_render_samples = int(opt.get('--samples', 16))
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = rw, rh, 100
sc.render.fps = fps
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0, 0, 0)
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.5

keys = moves['keys']; n = int(round(moves['seconds'] * fps))
sc.frame_start, sc.frame_end = 1, n
def ease(u):
    e = moves.get('ease', 'sine')
    return 0.5 - 0.5 * math.cos(math.pi * u) if e == 'sine' else u
def at(t):
    for k0, k1 in zip(keys, keys[1:]):
        if k0['t'] <= t <= k1['t']:
            u = ease((t - k0['t']) / max(1e-6, k1['t'] - k0['t']))
            lerp = lambda a, b: [x + (y - x) * u for x, y in zip(a, b)]
            f0 = k0.get('fov') or base_fov; f1 = k1.get('fov') or base_fov
            return lerp(k0['loc'], k1['loc']), lerp(k0.get('rot', [0, 0, 0]), k1.get('rot', [0, 0, 0])), f0 + (f1 - f0) * u
    k = keys[-1]; return k['loc'], k.get('rot', [0, 0, 0]), k.get('fov') or base_fov
for fr in range(1, n + 1):
    loc, rot, fov = at((fr - 1) / fps)
    cam.location = loc
    cam.rotation_euler = tuple(math.radians(r) for r in rot)
    cam_d.angle = math.radians(fov)
    cam.keyframe_insert('location', frame=fr); cam.keyframe_insert('rotation_euler', frame=fr); cam_d.keyframe_insert('lens', frame=fr)
os.makedirs(out, exist_ok=True)
sc.render.filepath = os.path.join(out, '')
bpy.ops.render.render(animation=True)
print('[still_cam] wrote', n, 'frames to', out)
