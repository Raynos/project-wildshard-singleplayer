"""gauntlet_preview.py — preview renders of gauntlet.blend (lab P8 "viewmodel", E169).

  blender -b <scratch>/gauntlet.blend --python gauntlet_preview.py -- <scratch dir> <out prefix> [--maps] [--only=eye,frame,side,toon]

Views (GAUNTLET-local glTF → Blender (x, −z, y)): `eye` = from the game eye (the SPEC's direction), aimed at the
gauntlet, 30° lens; `frame` = the true game frame (portrait, 70° vertical, the gauntlet lower-left); `side` = an
orthographic side view from +x. Looks: `studio` (Cycles, Principled, the baked object-space normal map when --maps) and
`toon` (Cycles emission: 3 bands of the lab's view-space key light, AO, curvature ink, detail, + Freestyle silhouettes)
— a stand-in for the lab's program so the forms can be judged before the browser sees them.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = {a[2:].split('=')[0]: (a.split('=', 1)[1] if '=' in a else True) for a in ARGV if a.startswith('--')}
POS = [a for a in ARGV if not a.startswith('--')]
SCRATCH, PREFIX = POS[0], POS[1]
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
PUBLIC = os.path.join(REPO, 'public', 'assets', 'nine-dragon', 'lab', 'viewmodel')
ONLY = set(str(OPT.get('only', 'eye,frame,side,toon')).split(','))


def B(x, y, z):
    """glTF → Blender"""
    return Vector((x, -z, y))


EYE = B(1.06, 0.38, 0.351)
FWD = B(-0.989, 0.0, -0.145).normalized()
UP = B(-0.122, 0.546, 0.829).normalized()
RIGHT = B(0.079, 0.838, -0.541).normalized()
KEY = (RIGHT * -0.45 + UP * 0.75 - FWD * 0.5).normalized()

RGB = {
    'brass': 0x9c7c3a, 'brass_dark': 0x76592a, 'steel': 0x191c22, 'lacquer': 0x121317, 'leather': 0x1d1c20,
    'glove': 0x24252b, 'cloth_cream': 0xe4ddcc, 'sleeve': 0x2a2d38, 'trim_red': 0xa8281c, 'silk_red': 0xc22d1e,
    'carbon': 0x16171b, 'glow': 0xd9fbff, 'gold_thread': 0xc9a24a,
}


def lin(h):
    out = []
    for s in (16, 8, 0):
        c = ((h >> s) & 255) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def cam_matrix(pos, fwd, up):
    f = fwd.normalized()
    r = f.cross(up).normalized()
    u = r.cross(f).normalized()
    m = Matrix((r, u, -f)).transposed().to_4x4()
    m.translation = pos
    return m


def camera(name, pos, fwd, up, lens_deg=None, ortho=None, sensor_fit='AUTO'):
    cd = bpy.data.cameras.new(name)
    if ortho is not None:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    else:
        cd.sensor_fit = sensor_fit
        cd.angle = math.radians(lens_deg)
    cd.clip_start = 0.01
    cd.clip_end = 20
    co = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(co)
    co.matrix_world = cam_matrix(pos, fwd, up)
    return co


def light(name, kind, direction, energy, size=1.0, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == 'AREA':
        ld.size = size
    if kind == 'SUN':
        ld.angle = math.radians(size)
    lo = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(lo)
    d = direction.normalized()
    lo.matrix_world = cam_matrix(Vector((0, 0, -0.2)) + d * 2.0, -d, Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((0, 1, 0)))
    return lo


def maps_images():
    if 'maps' not in OPT:
        return None, None
    m = bpy.data.images.load(os.path.join(PUBLIC, 'gauntlet-maps.webp'))
    n = bpy.data.images.load(os.path.join(PUBLIC, 'gauntlet-nrm.webp'))
    for im in (m, n):
        im.colorspace_settings.name = 'Non-Color'
    return m, n


def studio_materials(maps, nrm):
    for mat in bpy.data.materials:
        if mat.name not in RGB:
            continue
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(bs.outputs[0], out.inputs['Surface'])
        c = lin(RGB[mat.name])
        metal = mat.name in ('brass', 'brass_dark', 'steel', 'gold_thread')
        bs.inputs['Metallic'].default_value = 1.0 if metal else 0.0
        bs.inputs['Roughness'].default_value = 0.34 if metal else 0.72
        if mat.name == 'glow':
            bs.inputs['Emission Color'].default_value = (*c, 1)
            bs.inputs['Emission Strength'].default_value = 6.0
        if maps is None:
            bs.inputs['Base Color'].default_value = (*c, 1)
            continue
        tm = nt.nodes.new('ShaderNodeTexImage')
        tm.image = maps
        tn = nt.nodes.new('ShaderNodeTexImage')
        tn.image = nrm
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(tm.outputs['Color'], sep.inputs[0])
        # base × (0.35 + 0.65 AO) × (0.45 + 1.1 detail)
        ao = nt.nodes.new('ShaderNodeMapRange')
        ao.inputs['To Min'].default_value = 0.35
        nt.links.new(sep.outputs[0], ao.inputs['Value'])
        de = nt.nodes.new('ShaderNodeMapRange')
        de.inputs['To Min'].default_value = 0.45
        de.inputs['To Max'].default_value = 1.55
        nt.links.new(sep.outputs[2], de.inputs['Value'])
        m1 = nt.nodes.new('ShaderNodeMath')
        m1.operation = 'MULTIPLY'
        nt.links.new(ao.outputs[0], m1.inputs[0])
        nt.links.new(de.outputs[0], m1.inputs[1])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[6].default_value = (*c, 1)
        nt.links.new(m1.outputs[0], mix.inputs[7])
        nt.links.new(mix.outputs[2], bs.inputs['Base Color'])
        vm = nt.nodes.new('ShaderNodeVectorMath')
        vm.operation = 'MULTIPLY_ADD'
        vm.inputs[1].default_value = (2, 2, 2)
        vm.inputs[2].default_value = (-1, -1, -1)
        nt.links.new(tn.outputs['Color'], vm.inputs[0])
        nz = nt.nodes.new('ShaderNodeVectorMath')
        nz.operation = 'NORMALIZE'
        nt.links.new(vm.outputs[0], nz.inputs[0])
        nt.links.new(nz.outputs[0], bs.inputs['Normal'])


def toon_materials(maps, nrm):
    """emission: the lab-ish program (bands of a fixed key light, AO, ink creases, detail, a metal highlight)"""
    for mat in bpy.data.materials:
        if mat.name not in RGB:
            continue
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(em.outputs[0], out.inputs['Surface'])
        c = lin(RGB[mat.name])
        if mat.name == 'glow':
            em.inputs['Color'].default_value = (*c, 1)
            em.inputs['Strength'].default_value = 2.0
            continue
        if maps is None:
            geo = nt.nodes.new('ShaderNodeNewGeometry')
            nsrc = geo.outputs['Normal']
        else:
            tn = nt.nodes.new('ShaderNodeTexImage')
            tn.image = nrm
            vm = nt.nodes.new('ShaderNodeVectorMath')
            vm.operation = 'MULTIPLY_ADD'
            vm.inputs[1].default_value = (2, 2, 2)
            vm.inputs[2].default_value = (-1, -1, -1)
            nt.links.new(tn.outputs['Color'], vm.inputs[0])
            nz = nt.nodes.new('ShaderNodeVectorMath')
            nz.operation = 'NORMALIZE'
            nt.links.new(vm.outputs[0], nz.inputs[0])
            nsrc = nz.outputs[0]
        dot = nt.nodes.new('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        dot.inputs[1].default_value = KEY
        nt.links.new(nsrc, dot.inputs[0])
        # bands: 0.5 / 0.74 / 1.0 (+0.4 highlight on metal above 0.8)
        metal = mat.name in ('brass', 'brass_dark', 'steel', 'gold_thread')
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.interpolation = 'CONSTANT'
        els = ramp.color_ramp.elements
        els[0].position = 0.0
        els[0].color = (0.5, 0.5, 0.5, 1)
        els[1].position = 0.375
        els[1].color = (0.74, 0.74, 0.74, 1)
        e2 = els.new(0.625)
        e2.color = (1.0, 1.0, 1.0, 1)
        if metal:
            e3 = els.new(0.9)
            e3.color = (1.55, 1.45, 1.2, 1)
            els[0].color = (0.36, 0.33, 0.28, 1)
        remap = nt.nodes.new('ShaderNodeMapRange')
        remap.inputs['From Min'].default_value = -1.0
        nt.links.new(dot.outputs['Value'], remap.inputs['Value'])
        nt.links.new(remap.outputs[0], ramp.inputs['Fac'])
        col = nt.nodes.new('ShaderNodeMix')
        col.data_type = 'RGBA'
        col.blend_type = 'MULTIPLY'
        col.inputs['Factor'].default_value = 1.0
        col.inputs[6].default_value = (*c, 1)
        nt.links.new(ramp.outputs['Color'], col.inputs[7])
        last = col.outputs[2]
        if maps is not None:
            tm = nt.nodes.new('ShaderNodeTexImage')
            tm.image = maps
            sep = nt.nodes.new('ShaderNodeSeparateColor')
            nt.links.new(tm.outputs['Color'], sep.inputs[0])
            ao = nt.nodes.new('ShaderNodeMapRange')
            ao.inputs['To Min'].default_value = 0.45
            nt.links.new(sep.outputs[0], ao.inputs['Value'])
            de = nt.nodes.new('ShaderNodeMapRange')
            de.inputs['To Min'].default_value = 0.4
            de.inputs['To Max'].default_value = 1.6
            nt.links.new(sep.outputs[2], de.inputs['Value'])
            m1 = nt.nodes.new('ShaderNodeMath')
            m1.operation = 'MULTIPLY'
            nt.links.new(ao.outputs[0], m1.inputs[0])
            nt.links.new(de.outputs[0], m1.inputs[1])
            m2 = nt.nodes.new('ShaderNodeMix')
            m2.data_type = 'RGBA'
            m2.blend_type = 'MULTIPLY'
            m2.inputs['Factor'].default_value = 1.0
            nt.links.new(last, m2.inputs[6])
            nt.links.new(m1.outputs[0], m2.inputs[7])
            # ink in the creases (G < ~0.3)
            ink = nt.nodes.new('ShaderNodeMapRange')
            ink.inputs['From Min'].default_value = 0.34
            ink.inputs['From Max'].default_value = 0.22
            nt.links.new(sep.outputs[1], ink.inputs['Value'])
            m3 = nt.nodes.new('ShaderNodeMix')
            m3.data_type = 'RGBA'
            nt.links.new(ink.outputs[0], m3.inputs['Factor'])
            nt.links.new(m2.outputs[2], m3.inputs[6])
            m3.inputs[7].default_value = (0.006, 0.006, 0.007, 1)
            last = m3.outputs[2]
        nt.links.new(last, em.inputs['Color'])


def render(cam, path, w, h, samples, freestyle=False):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.render.use_freestyle = freestyle
    if freestyle:
        vl = sc.view_layers[0]
        vl.use_freestyle = True
        fs = vl.freestyle_settings
        fs.crease_angle = math.radians(120)
        ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('ink')
        if ls.linestyle is None:
            ls.linestyle = bpy.data.linestyles.new('ink')
        ls.select_by_visibility = True
        ls.select_silhouette = True
        ls.select_border = True
        ls.select_crease = False
        ls.linestyle.color = (0.01, 0.01, 0.012)
        ls.linestyle.thickness = 1.6
    sc.render.filepath = path
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    print('[preview] wrote', path, flush=True)


def main():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'METAL'
    sc.cycles.device = 'GPU'
    sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'
    sc.render.film_transparent = False
    w = bpy.data.worlds.new('pv') if sc.world is None else sc.world
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value = (0.2, 0.21, 0.23, 1)
    bg.inputs['Strength'].default_value = 0.6
    maps, nrm = maps_images()
    light('key', 'AREA', KEY, 260, size=1.2)
    light('rim', 'AREA', (-FWD * -0.6 + UP * 0.5 - RIGHT * 0.6), 120, size=1.0, color=(0.75, 0.85, 1.0))
    light('fill', 'AREA', (-FWD + RIGHT * 0.6 - UP * 0.2), 40, size=2.0)
    target = B(0.02, -0.09, 0.03)
    eye_cam = camera('eye', EYE, target - EYE, UP, lens_deg=24)
    frame_cam = camera('frame', Vector((0, 0, 0)) + EYE, FWD, UP, lens_deg=70, sensor_fit='VERTICAL')
    side_cam = camera('side', B(1.2, -0.27, 0.05), B(-1, 0, 0), B(0, 0, 1), ortho=1.05)
    drum = B(0.06, -0.095, 0.0)
    close_cam = camera('close', EYE, drum - EYE, UP, lens_deg=8)
    top_cam = camera('top', B(0.05, -0.27, 1.2), B(0, 0, -1), B(-1, 0, 0), ortho=1.05)
    if 'eye' in ONLY or 'frame' in ONLY or 'side' in ONLY or 'close' in ONLY:
        studio_materials(maps, nrm)
        if 'eye' in ONLY:
            render(eye_cam, f'{PREFIX}-eye.png', 1024, 1024, 48)
        if 'close' in ONLY:
            render(close_cam, f'{PREFIX}-close.png', 1024, 1024, 48)
        if 'frame' in ONLY:
            render(frame_cam, f'{PREFIX}-frame.png', 603, 1311, 32)
        if 'side' in ONLY:
            render(side_cam, f'{PREFIX}-side.png', 1400, 600, 32)
            render(top_cam, f'{PREFIX}-top.png', 1400, 600, 32)
    if 'toon' in ONLY:
        toon_materials(maps, nrm)
        render(eye_cam, f'{PREFIX}-toon.png', 1024, 1024, 16, freestyle=True)


main()
