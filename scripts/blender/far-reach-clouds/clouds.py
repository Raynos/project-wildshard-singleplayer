"""Sky Reach's volumetric cumulus (E407, top-10 row 5): eight cloud shapes rendered as true Cycles volumes, each lit
twice (`front`: the sun behind the camera; `back`: the low sun behind the cloud, as every view toward the mill and the
crown sees them), on a transparent film. look/puffs.ts blends the two by the view's angle to the sun.

    blender -b --factory-startup --python-exit-code 1 -P scripts/blender/far-reach-clouds/clouds.py -- <out dir> [samples] [only: 0,3]

Writes <out dir>/cloud-<i>-<front|back>.png (512 x 256 each); atlas.py packs them into
public/assets/far-reach/tex/cumulus.webp. Seeded: the same shapes every run.
"""
import math
import random
import sys

import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/far-reach-clouds'
SAMPLES = int(argv[1]) if len(argv) > 1 else 96
ONLY = [int(k) for k in argv[2].split(',')] if len(argv) > 2 else list(range(8))
W, H = 512, 256
# the frame: x in [-2, 2], z in [-0.5, 1.5] (2:1), the cloud's flat base near z = -0.25
HALF_W = 2.0

scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
for d in prefs.devices:
    d.use = True
scene.cycles.device = 'GPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.volume_bounces = 12
scene.cycles.max_bounces = 8
scene.cycles.transparent_max_bounces = 8
scene.cycles.volume_step_rate = 1.0
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = -0.35

# the world: a soft lavender sky light for the shaded bellies (the mockups' cloud undersides)
world = bpy.data.worlds.new('sky'); scene.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.42, 0.42, 0.62, 1); bg.inputs['Strength'].default_value = 0.4

# the camera: orthographic, looking along +y
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = HALF_W * 2
cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam); scene.camera = cam
cam.location = (0, -12, 0.5); cam.rotation_euler = (math.pi / 2, 0, 0)

sun_data = bpy.data.lights.new('sun', 'SUN'); sun_data.energy = 7.5; sun_data.color = (1.0, 0.84, 0.66); sun_data.angle = math.radians(1.5)
sun = bpy.data.objects.new('sun', sun_data); scene.collection.objects.link(sun)

# the domain: a box covering the frame
bpy.ops.mesh.primitive_cube_add(size=1)
dom = bpy.context.active_object; dom.name = 'domain'
dom.scale = (HALF_W * 2, 3.0, 2.0); dom.location = (0, 0, 0.5)
bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)


def node(tree, kind, **inputs):
    n = tree.nodes.new(kind)
    for k, v in inputs.items():
        if k == 'operation':
            n.operation = v
        else:
            n.inputs[k].default_value = v
    return n


def cloud_material(spheres, seed):
    """Density = the union of the spheres' falloffs, the sample point warped by a noise (billows), eroded by a finer
    noise, the base flattened (cumulus sit on a level condensation line)."""
    mat = bpy.data.materials.new(f'cloud{seed}'); mat.use_nodes = True
    t = mat.node_tree
    for n in list(t.nodes):
        t.nodes.remove(n)
    out = t.nodes.new('ShaderNodeOutputMaterial')
    vol = t.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (1, 1, 1, 1)
    vol.inputs['Anisotropy'].default_value = 0.6
    t.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    co = t.nodes.new('ShaderNodeTexCoord')
    warp = node(t, 'ShaderNodeTexNoise', Scale=1.6, Detail=4.0, Roughness=0.55)
    warp.noise_dimensions = '4D'; warp.inputs[1].default_value = seed * 1.7
    t.links.new(co.outputs['Object'], warp.inputs['Vector'])
    centred = node(t, 'ShaderNodeVectorMath', operation='SUBTRACT'); centred.inputs[1].default_value = (0.5, 0.5, 0.5)
    t.links.new(warp.outputs['Color'], centred.inputs[0])
    amp = node(t, 'ShaderNodeVectorMath', operation='SCALE'); amp.inputs['Scale'].default_value = 0.32
    t.links.new(centred.outputs['Vector'], amp.inputs[0])
    p0 = node(t, 'ShaderNodeVectorMath', operation='ADD')
    t.links.new(co.outputs['Object'], p0.inputs[0]); t.links.new(amp.outputs['Vector'], p0.inputs[1])
    fine = node(t, 'ShaderNodeTexNoise', Scale=4.5, Detail=3.0, Roughness=0.5)
    fine.noise_dimensions = '4D'; fine.inputs[1].default_value = seed * 2.3 + 5
    t.links.new(co.outputs['Object'], fine.inputs['Vector'])
    fc = node(t, 'ShaderNodeVectorMath', operation='SUBTRACT'); fc.inputs[1].default_value = (0.5, 0.5, 0.5)
    t.links.new(fine.outputs['Color'], fc.inputs[0])
    fa = node(t, 'ShaderNodeVectorMath', operation='SCALE'); fa.inputs['Scale'].default_value = 0.12
    t.links.new(fc.outputs['Vector'], fa.inputs[0])
    p = node(t, 'ShaderNodeVectorMath', operation='ADD')
    t.links.new(p0.outputs['Vector'], p.inputs[0]); t.links.new(fa.outputs['Vector'], p.inputs[1])
    field = None
    for (cx, cy, cz, r) in spheres:
        d = node(t, 'ShaderNodeVectorMath', operation='DISTANCE'); d.inputs[1].default_value = (cx, cy, cz)
        t.links.new(p.outputs['Vector'], d.inputs[0])
        f = node(t, 'ShaderNodeMath', operation='DIVIDE'); f.inputs[1].default_value = r
        t.links.new(d.outputs['Value'], f.inputs[0])
        g = node(t, 'ShaderNodeMath', operation='SUBTRACT'); g.inputs[0].default_value = 1.0
        t.links.new(f.outputs['Value'], g.inputs[1])
        if field is None:
            field = g
        else:
            m = node(t, 'ShaderNodeMath', operation='SMOOTH_MAX'); m.inputs[2].default_value = 0.4
            t.links.new(field.outputs['Value'], m.inputs[0]); t.links.new(g.outputs['Value'], m.inputs[1]); field = m
    erode = node(t, 'ShaderNodeTexNoise', Scale=7.0, Detail=6.0, Roughness=0.6)
    erode.noise_dimensions = '4D'; erode.inputs[1].default_value = seed * 3.1
    t.links.new(co.outputs['Object'], erode.inputs['Vector'])
    e = node(t, 'ShaderNodeMath', operation='MULTIPLY_ADD'); e.inputs[1].default_value = -0.12; e.inputs[2].default_value = 0.06
    t.links.new(erode.outputs['Factor'], e.inputs[0])
    shaped = node(t, 'ShaderNodeMath', operation='ADD')
    t.links.new(field.outputs['Value'], shaped.inputs[0]); t.links.new(e.outputs['Value'], shaped.inputs[1])
    dens = node(t, 'ShaderNodeMapRange'); dens.inputs['From Min'].default_value = 0.0; dens.inputs['From Max'].default_value = 0.07
    dens.inputs['To Min'].default_value = 0.0; dens.inputs['To Max'].default_value = 18.0; dens.interpolation_type = 'SMOOTHSTEP'
    t.links.new(shaped.outputs['Value'], dens.inputs['Value'])
    # the flat base: density fades out under z = base
    sep = t.nodes.new('ShaderNodeSeparateXYZ'); t.links.new(co.outputs['Object'], sep.inputs['Vector'])
    base = node(t, 'ShaderNodeMapRange'); base.inputs['From Min'].default_value = -0.32; base.inputs['From Max'].default_value = -0.18
    base.interpolation_type = 'SMOOTHSTEP'; t.links.new(sep.outputs['Z'], base.inputs['Value'])
    fin = node(t, 'ShaderNodeMath', operation='MULTIPLY')
    t.links.new(dens.outputs['Result'], fin.inputs[0]); t.links.new(base.outputs['Result'], fin.inputs[1])
    t.links.new(fin.outputs['Value'], vol.inputs['Density'])
    return mat


def shape(rng, kind):
    """A cumulus: a row of wide base lobes, then smaller lobes heaped on top. `kind` 0..7 runs from a low bank to a tall
    heap, so the atlas holds both the wide banks between the isles and the towers near the keels."""
    tall = kind / 7.0
    spheres = []
    n_base = 6 + rng.randint(0, 2)
    width = 1.75 - 0.55 * tall
    for i in range(n_base):
        x = -width + 2 * width * (i + 0.5) / n_base + rng.uniform(-0.12, 0.12)
        r = rng.uniform(0.42, 0.56) * (1.0 - 0.35 * abs(x) / width)
        spheres.append((x, rng.uniform(-0.2, 0.2), -0.1 + r * 0.45, r))
    n_top = 2 + int(tall * 4) + rng.randint(0, 1)
    for i in range(n_top):
        x = rng.uniform(-width * 0.55, width * 0.55) * (1 - 0.4 * tall)
        r = rng.uniform(0.34, 0.48) * (1 - 0.2 * i / max(1, n_top))
        z = 0.25 + (0.25 + 0.75 * tall) * (i + 1) / n_top * rng.uniform(0.75, 1.0)
        spheres.append((x, rng.uniform(-0.2, 0.2), min(z, 1.45 - r), r))
    return spheres


LIGHTS = {
    # the sun behind the camera, high to the left: the lit crowns face us
    'front': (math.radians(40), math.radians(-60), 0.0),
    # the low sun behind the cloud (10 deg up, a little right): silver rims, a darker lavender core
    'back': (math.radians(-80), math.radians(12), 0.0),
}

for i in ONLY:
    rng = random.Random(5101 + i * 37)
    dom.data.materials.clear(); dom.data.materials.append(cloud_material(shape(rng, i), i))
    for name, rot in LIGHTS.items():
        sun.rotation_euler = rot
        scene.render.filepath = f'{OUT}/cloud-{i}-{name}.png'
        bpy.ops.render.render(write_still=True)
        print(f'[clouds] {i} {name}', flush=True)
