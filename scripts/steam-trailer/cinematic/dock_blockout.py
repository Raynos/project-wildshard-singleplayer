"""TRAILERS CT1 #1 (E466): the cinematic bake-off's grey blockout — a shard docks into the grid (docs/plans/trailers/ct1-shot.md).

    blender -b --factory-startup -noaudio --python-exit-code 1 -P scripts/steam-trailer/cinematic/dock_blockout.py -- <outDir> [--frames N]

Renders three passes of the same 145-frame, 1280 × 704, 24 fps shot with EEVEE:
  <outDir>/grey/%04d.png    clay: one grey material, a low dusk sun; the lattice walls and the beacons glow (they are the
                            shot's light sources, so a video model sees where the light is)
  <outDir>/depth/%04d.png   camera depth, near = white, one range (NEAR..FAR m) for the whole shot, the sky black
  <outDir>/normal/%04d.png  camera-space normals as colour (n · 0.5 + 0.5), the sky flat
Blender is the layout and the camera only (Jake: a Blender render is never the final look); the models paint it.
Everything is built here from primitives with a fixed seed: no assets, no .blend.
"""

import math
import random
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/ct1-blockout"
FRAMES = int(argv[argv.index("--frames") + 1]) if "--frames" in argv else 145
W, H, FPS = 1280, 704, 24
CELL, WALL = 20.0, 0.25          # a cell is 20 m here (the shard's 500 m, scaled); a lattice wall's thickness
N = 4                            # the grid runs -N..N cells each way (9 × 9)
DOCK = 118                       # the frame the shard seats on
NEAR, FAR = 15.0, 170.0          # the depth range: the shot's nearest and farthest ground, so the pass uses its full scale
rng = random.Random(466)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, FRAMES
scene.render.fps = FPS
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = W, H, 100
for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "Standard"


def mat(name, color=(0.6, 0.6, 0.6), emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    if emit > 0:
        bsdf.inputs["Emission Color"].default_value = (1, 1, 1, 1)
        bsdf.inputs["Emission Strength"].default_value = emit
    return m


CLAY = mat("clay", (0.62, 0.62, 0.62))
DARK = mat("pit", (0.18, 0.18, 0.18))
GLOW = mat("lattice", (0.8, 0.8, 0.8), emit=1.2)
BEACON = mat("beacon", (0.9, 0.9, 0.9), emit=0.4)


def add(obj, m):
    obj.data.materials.append(m)
    return obj


def box(x, y, z, sx, sy, sz, m=CLAY, rot=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z), rotation=(0, 0, rot))
    o = bpy.context.object
    o.scale = (sx, sy, sz)
    return add(o, m)


def cone(x, y, z, r, h, m=CLAY, verts=8):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=0, depth=h, location=(x, y, z + h / 2))
    return add(bpy.context.object, m)


def cyl(x, y, z, r, h, m=CLAY, verts=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(x, y, z + h / 2))
    return add(bpy.context.object, m)


# ── the grid: biome cells, each a slab with its own landform, and the lattice walls between them ─────────────────────
def biome(cx, cy, kind):
    box(cx, cy, -1.0, CELL - WALL, CELL - WALL, 2.0)                       # the cell's ground slab, top at z = 0
    if kind == "mesa":
        for _ in range(rng.randint(3, 6)):
            box(cx + rng.uniform(-7, 7), cy + rng.uniform(-7, 7), 0, rng.uniform(1.5, 4), rng.uniform(1.5, 4), rng.uniform(1.5, 5))
    elif kind == "peaks":
        for _ in range(rng.randint(3, 5)):
            cone(cx + rng.uniform(-6, 6), cy + rng.uniform(-6, 6), 0, rng.uniform(2.5, 5), rng.uniform(4, 10), verts=6)
    elif kind == "forest":
        for _ in range(rng.randint(14, 24)):
            x, y = cx + rng.uniform(-8.5, 8.5), cy + rng.uniform(-8.5, 8.5)
            cone(x, y, 0.4, rng.uniform(0.5, 0.9), rng.uniform(2, 3.5))
    elif kind == "crystal":
        for _ in range(rng.randint(6, 10)):
            o = cone(cx + rng.uniform(-7, 7), cy + rng.uniform(-7, 7), 0, rng.uniform(0.4, 1.0), rng.uniform(2, 6), verts=5)
            o.rotation_euler = (rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), 0)
    elif kind == "badland":
        for _ in range(rng.randint(5, 9)):
            cone(cx + rng.uniform(-7, 7), cy + rng.uniform(-7, 7), 0, rng.uniform(0.6, 1.6), rng.uniform(2, 7), verts=5)
    elif kind == "city":
        for _ in range(rng.randint(8, 14)):
            box(cx + rng.uniform(-7, 7), cy + rng.uniform(-7, 7), 0, rng.uniform(1, 2.5), rng.uniform(1, 2.5), rng.uniform(2, 9))


KINDS = ["mesa", "peaks", "forest", "crystal", "badland", "city", "forest", "mesa"]
for i in range(-N, N + 1):
    for j in range(-N, N + 1):
        cx, cy = i * CELL, j * CELL
        if (i, j) == (0, 0):
            box(cx, cy, -6.0, CELL - WALL, CELL - WALL, 2.0, DARK)          # the empty cell: a dark pit 5 m down
            continue
        biome(cx, cy, KINDS[(i * 3 + j * 5) % len(KINDS)] if rng.random() > 0.15 else rng.choice(KINDS))
box(0, 0, -9.0, CELL * (2 * N + 3), CELL * (2 * N + 3), 1.0, DARK)        # a floor under it all: no see-through gaps
for k in range(-N, N + 2):                                                 # the lattice: walls of light on every seam
    e = (k - 0.5) * CELL
    box(e, 0, 0.6, WALL, CELL * (2 * N + 1), 1.2, GLOW)
    box(0, e, 0.6, CELL * (2 * N + 1), WALL, 1.2, GLOW)

# the nine beacons round the empty cell (corners, edge midpoints, centre) — they flare as the shard seats
beacons = []
h = CELL / 2 - 0.6
for bx in (-h, 0, h):
    for by in (-h, 0, h):
        beacons.append(cyl(bx, by, -5.0 if (bx, by) == (0, 0) else 0, 0.18, 6.0 if (bx, by) != (0, 0) else 4.0, BEACON))
em = BEACON.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
for f, v in ((1, 0.4), (DOCK - 10, 0.8), (DOCK, 9.0), (DOCK + 12, 4.0), (FRAMES, 3.0)):
    em.default_value = v
    em.keyframe_insert("default_value", frame=f)
ge = GLOW.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
for f, v in ((1, 1.2), (DOCK, 1.2), (DOCK + 6, 3.5), (FRAMES, 2.0)):
    ge.default_value = v
    ge.keyframe_insert("default_value", frame=f)

# ── the shard: a floating cube of land, parented to one empty that flies it down ────────────────────────────────────
bpy.ops.object.empty_add(location=(0, 0, 0))
shard = bpy.context.object
shard.name = "shard"
parts = []
S = CELL - WALL - 0.6
parts.append(box(0, 0, -4.0, S, S, 8.0))                                   # the cube of earth, top at z = 0
bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=S * 0.5, radius2=0, depth=12, location=(0, 0, -14), rotation=(math.pi, 0, 0))
parts.append(add(bpy.context.object, CLAY))                                # the rocky underside, a floating island's keel
for _ in range(10):                                                        # hanging roots under the cube's edge
    a = rng.uniform(0, 2 * math.pi)
    r = rng.uniform(0.35, 0.48) * S
    parts.append(cyl(math.cos(a) * r, math.sin(a) * r, -8 - rng.uniform(2, 6), 0.12, rng.uniform(2, 6)))
bpy.ops.mesh.primitive_uv_sphere_add(radius=5, location=(3, 2, -1.5), segments=16, ring_count=8)
hill = add(bpy.context.object, CLAY)
hill.scale = (1.0, 0.8, 0.55)
parts.append(hill)
for _ in range(16):                                                        # pines
    x, y = rng.uniform(-8, 8), rng.uniform(-8, 8)
    if math.hypot(x - 3, y - 2) < 4.5:
        continue
    parts.append(cyl(x, y, 0, 0.12, 0.6))
    parts.append(cone(x, y, 0.5, rng.uniform(0.6, 0.9), rng.uniform(2.2, 3.2)))
parts.append(cyl(-5, -4, 0, 1.0, 5.0, verts=12))                           # the small stone tower
parts.append(cone(-5, -4, 5.0, 1.4, 2.0, verts=12))
for p in parts:
    p.parent = shard

# the descent: from high in the sky, a slow yaw that unwinds, an eased landing that seats on DOCK with a small settle
for f, z, yaw in ((1, 62.0, math.radians(14)), (DOCK - 30, 12.0, math.radians(4)), (DOCK, 0.0, 0.0), (DOCK + 5, 0.35, 0.0), (DOCK + 11, 0.0, 0.0), (FRAMES, 0.0, 0.0)):
    shard.location = (0, 0, z)
    shard.rotation_euler = (0, 0, yaw)
    shard.keyframe_insert("location", frame=f)
    shard.keyframe_insert("rotation_euler", frame=f)

# ── the camera: beside the shard high in the sky (its land on top, the grid far below), riding down with it and pulling
# back to a wide three-quarter aerial as it seats ──────────────────────────────────────────────────────────────────
bpy.ops.object.empty_add(location=(0, 0, 40))
aim = bpy.context.object
aim.name = "aim"
for f, loc in ((1, (0, 0, 58)), (DOCK - 30, (0, 0, 12)), (DOCK, (0, 0, 1)), (FRAMES, (0, 6, 0))):
    aim.location = loc
    aim.keyframe_insert("location", frame=f)
bpy.ops.object.camera_add(location=(-16, -26, 3))
cam = bpy.context.object
scene.camera = cam
cam.data.clip_start, cam.data.clip_end = 0.5, 2000
track = cam.constraints.new("TRACK_TO")
track.target = aim
track.track_axis, track.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
for f, loc, lens in ((1, (-20, -26, 72), 24), (DOCK - 30, (-34, -50, 42), 24), (DOCK, (-48, -70, 42), 26), (FRAMES, (-58, -84, 50), 28)):
    cam.location = loc
    cam.data.lens = lens
    cam.keyframe_insert("location", frame=f)
    cam.data.keyframe_insert("lens", frame=f)

# ── light: a low dusk sun and a soft sky ───────────────────────────────────────────────────────────────────────────
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(72), 0, math.radians(-40)))
bpy.context.object.data.energy = 3.0
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]


def pass_material(name, kind):
    """An emission-only override: camera depth (near = white) or camera-space normals as colour."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    if kind == "depth":
        camdata = nt.nodes.new("ShaderNodeCameraData")
        rng_node = nt.nodes.new("ShaderNodeMapRange")
        rng_node.inputs["From Min"].default_value = NEAR
        rng_node.inputs["From Max"].default_value = FAR
        rng_node.inputs["To Min"].default_value = 1.0
        rng_node.inputs["To Max"].default_value = 0.0
        nt.links.new(camdata.outputs["View Z Depth"], rng_node.inputs["Value"])
        nt.links.new(rng_node.outputs["Result"], emit.inputs["Color"])
    else:
        geo = nt.nodes.new("ShaderNodeNewGeometry")
        vt = nt.nodes.new("ShaderNodeVectorTransform")
        vt.vector_type, vt.convert_from, vt.convert_to = "NORMAL", "WORLD", "CAMERA"
        scale = nt.nodes.new("ShaderNodeVectorMath")
        scale.operation = "MULTIPLY_ADD"
        scale.inputs[1].default_value = (0.5, 0.5, -0.5)
        scale.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(geo.outputs["Normal"], vt.inputs["Vector"])
        nt.links.new(vt.outputs["Vector"], scale.inputs[0])
        nt.links.new(scale.outputs["Vector"], emit.inputs["Color"])
    return m


PASSES = (
    ("grey", None, (0.55, 0.57, 0.62), 1.0),
    ("depth", pass_material("depth", "depth"), (0, 0, 0), 0.0),
    ("normal", pass_material("normal", "normal"), (0.5, 0.5, 1.0), 1.0),
)
# --pick 1,60,118,145: only those frames of the grey pass, as stills (the layout / camera check before the full render)
PICK = [int(f) for f in argv[argv.index("--pick") + 1].split(",")] if "--pick" in argv else None
layer = scene.view_layers[0]
for name, override, sky, strength in PASSES[:1] if PICK else PASSES:
    layer.material_override = override
    bg.inputs["Color"].default_value = (*sky, 1)
    bg.inputs["Strength"].default_value = strength
    scene.view_settings.view_transform = "Standard"
    if PICK:
        for f in PICK:
            scene.frame_set(f)
            scene.render.filepath = f"{OUT}/{name}/pick-{f:04d}.png"
            bpy.ops.render.render(write_still=True)
        continue
    scene.render.filepath = f"{OUT}/{name}/"
    bpy.ops.render.render(animation=True)
    print(f"[dock_blockout] {name}: {FRAMES} frames → {OUT}/{name}/")
