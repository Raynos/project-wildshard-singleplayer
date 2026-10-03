"""Signal Dunes (E407 row 6): a real fire for the waymark braziers, the signal fire and the keeper's lamp, as a flipbook.

A Mantaflow gas sim with fire (Blender 5.2, headless): a log-pile flow object burning in a tall domain, baked, its flame
rendered emission-only (Cycles, transparent film, an orthographic side view), FRAMES frames from the settled middle of
the burn, then packed by pack.py into one 8 x 4 atlas the flame billboards play (world/fireFx.ts).

usage (repo root, under the model lock):
  lockf -k ~/projects/localai/.model.lock blender -b --factory-startup --python-exit-code 1 \
    -P art/sunscar-dunes/round-26-fire/fire.py -- <out_dir>
"""
import math, os, sys
import bpy

out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/sunscar-fire'
os.makedirs(out, exist_ok=True)
FRAMES, START, END = 32, 70, 101  # rendered frames: 70..101 (the burn settled), the bake runs to END
RES, W, H = 128, 256, 512

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, END

# the domain: 1.2 m square, 2.4 m tall, its floor at z 0 (round 2: a 3.2 m domain at 96 left the flame a quarter of the frame)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.2))
domain = bpy.context.active_object; domain.name = 'domain'; domain.scale = (1.2, 1.2, 2.4)
bpy.ops.object.transform_apply(scale=True)
fm = domain.modifiers.new('Fluid', 'FLUID'); fm.fluid_type = 'DOMAIN'
ds = fm.domain_settings
ds.domain_type = 'GAS'; ds.resolution_max = RES
ds.cache_directory = os.path.join(out, 'cache'); ds.cache_type = 'ALL'
ds.cache_frame_start, ds.cache_frame_end = 1, END
ds.use_adaptive_domain = False
ds.alpha = 0.6        # density buoyancy
ds.beta = 1.7         # heat buoyancy (round 3: 2.4 with more fuel shot a tall jet out of the frame)
ds.vorticity = 0.55
ds.burning_rate = 0.85
ds.flame_smoke = 0.15
ds.flame_vorticity = 1.7
ds.flame_ignition = 1.3
ds.flame_max_temp = 3.0
ds.use_dissolve_smoke = True; ds.dissolve_speed = 18

# the flow: a broad low ember bed (round 3: three crossed log cylinders combed the flame's base into stripes)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.3, location=(0, 0, 0.12))
bpy.context.active_object.scale = (1.0, 1.0, 0.35)
bpy.ops.object.transform_apply(scale=True)
flow = bpy.context.active_object; flow.name = 'flow'
ff = flow.modifiers.new('Fluid', 'FLUID'); ff.fluid_type = 'FLOW'
fs = ff.flow_settings
fs.flow_type = 'FIRE'; fs.flow_behavior = 'INFLOW'; fs.flow_source = 'MESH'
fs.fuel_amount = 1.5; fs.surface_distance = 0.1; fs.temperature = 1.7
fs.use_plane_init = False

# bake the sim
bpy.context.view_layer.objects.active = domain
with bpy.context.temp_override(object=domain, active_object=domain, selected_objects=[domain]):
    bpy.ops.fluid.bake_all()
flow.hide_render = True

# the flame's material: emission only, colour and strength from the sim's 'flame' field (no smoke: fireFx draws its own)
mat = bpy.data.materials.new('flame'); mat.use_nodes = True
nt = mat.node_tree; nt.nodes.clear()
outn = nt.nodes.new('ShaderNodeOutputMaterial')
vol = nt.nodes.new('ShaderNodeVolumePrincipled')
attr = nt.nodes.new('ShaderNodeAttribute'); attr.attribute_name = 'flame'
ramp = nt.nodes.new('ShaderNodeValToRGB')
cr = ramp.color_ramp
cr.elements[0].position = 0.0; cr.elements[0].color = (0, 0, 0, 1)
cr.elements[1].position = 1.0; cr.elements[1].color = (1.0, 0.95, 0.75, 1)
for pos, col in ((0.12, (0.35, 0.03, 0.0, 1)), (0.3, (0.9, 0.2, 0.02, 1)), (0.55, (1.0, 0.5, 0.08, 1)), (0.8, (1.0, 0.78, 0.35, 1))):
    e = cr.elements.new(pos); e.color = col
mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 14.0
vol.inputs['Density'].default_value = 0.0
nt.links.new(attr.outputs['Fac'], ramp.inputs['Fac'])
nt.links.new(ramp.outputs['Color'], vol.inputs['Emission Color'])
nt.links.new(attr.outputs['Fac'], mul.inputs[0])
nt.links.new(mul.outputs['Value'], vol.inputs['Emission Strength'])
nt.links.new(vol.outputs['Volume'], outn.inputs['Volume'])
domain.data.materials.append(mat)

# an orthographic side camera framing the domain's lower 2.8 m
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 1.9
cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam)
cam.location = (0, -6, 0.92); cam.rotation_euler = (math.pi / 2, 0, 0)
scene.camera = cam
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
scene.cycles.samples = 64
scene.cycles.volume_step_rate = 0.25
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = W, H, 100
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
scene.world = bpy.data.worlds.new('w'); scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get('Background')
if bg: bg.inputs['Color'].default_value = (0, 0, 0, 1)
for i, f in enumerate(range(START, START + FRAMES)):
    scene.frame_set(f)
    scene.render.filepath = os.path.join(out, f'f{i:02d}.png')
    bpy.ops.render.render(write_still=True)
print('fire frames', FRAMES, 'in', out)
