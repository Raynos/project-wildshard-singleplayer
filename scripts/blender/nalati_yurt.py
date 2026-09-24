"""
The Nalati yurt (kiiz ui) modelled from code in Blender — NALATI-MERGE D1, the "Blender pipeline" twin of the generated
yurt (public/assets/nalati/models/yurt.glb, Hunyuan3D-2). Main's way (scripts/blender/assets.py, E52): low-poly facets
built from code, one flat colour per face (the ornament is drawn by the faces themselves, so nothing smears up close),
Cycles AO baked into the vertex colour's alpha, one glb with COLOR_0 only.

  blender -b -P scripts/blender/nalati_yurt.py -- --out <dir> [--ao 0.35]

Output: <dir>/yurt-blender.glb (+ .json). Metres, glTF +Y up, pivot = the centre of the base on y = 0, the door faces +Z
(the convention of every Nalati model, art/nalati-grasslands/round-5-models/README.md). Proportions follow the
procedural yurt (src/world/nalati/Yurt.ts at r = 2.26: wall 1.46 m, roof rise 1.18 m), so modelProps.ts's colliders and
stove pipe fit it as they fit the procedural one.

  wall      white felt over the lattice, a red base band, the broad red-and-ochre ram-horn band (koshkar muiiz) at the top
  roof      a low felt dome, a red eave band, eight red straps (baskur) running up to the crown
  shanyrak  the smoke ring and its crossed arches (kulyk), dark inside
  door      a carved, painted double door in a frame, the felt flap rolled up above it
"""
import argparse
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--ao", type=float, default=0.3, help="AO distance in metres; 0 = no bake")
ap.add_argument("--name", default="yurt-blender")
a = ap.parse_args(argv)
bpy.ops.wm.read_factory_settings(use_empty=True)


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# the camp's palette (src/world/nalati/Yurt.ts YURT_C, src/nalati/campPeople.ts), sRGB → linear
C = {k: srgb(v) for k, v in {
    'felt': '#ece4d2', 'feltShade': '#e4dac6', 'feltRoof': '#e8dfcb', 'red': '#b5302a', 'redDark': '#7c2420',
    'ochre': '#d7a647', 'wood': '#7a4e2c', 'woodDark': '#4f321d', 'door': '#c2552a', 'doorGold': '#e0b04c',
    'soot': '#2a2220', 'rope': '#8a3a2a',
}.items()}

R = 2.26            # wall radius (m)
WALL = 1.46         # wall height
RISE = 1.18         # roof rise, eave → crown ring
EAVE = 0.1          # the roof overhangs the wall
CROWN_R = 0.44      # the shanyrak's radius
N = 64              # segments round (one ornament cell each)
DOOR_A = -math.pi / 2   # the door's angle: Blender −Y = glTF +Z

verts, cols, faces = [], [], []   # a face = (vertex ids), one colour per face


def oriented(pts, away):
    """the points in the winding whose normal points AWAY from `away` (a point; None = the yurt's axis at the face's
    height, i.e. radially outward; 'in' = toward the axis). Every face is one-sided in the game: its winding is its front."""
    ps = [Vector(p) for p in pts]
    c = sum(ps, Vector()) / len(ps)
    n = (ps[1] - ps[0]).cross(ps[2] - ps[0])
    if away == 'in':
        d = Vector((-c.x, -c.y, 0.0))
    else:
        a = Vector((0.0, 0.0, c.z)) if away is None else Vector(away)
        d = c - a
    return ps if n.dot(d) >= 0 else list(reversed(ps))


def quad(p0, p1, p2, p3, col, away=None):
    base = len(verts)
    verts.extend(oriented([p0, p1, p2, p3], away))
    faces.append(((base, base + 1, base + 2, base + 3), col))


def tri(p0, p1, p2, col, away=None):
    base = len(verts)
    verts.extend(oriented([p0, p1, p2], away))
    faces.append(((base, base + 1, base + 2), col))


def ring_pt(r, ang, z):
    return (r * math.cos(ang), r * math.sin(ang), z)


# ── the ram-horn band (koshkar muiiz): two curls off one stem, cream on red, 16 × 7 cells a motif (row 0 at the top);
#    the band has its own ring of NB columns (eight motifs round), finer than the wall's
MOTIF = [
    "................",
    ".XXX........XXX.",
    "X...X......X...X",
    "X.X.X......X.X.X",
    "X..XXX....XXX..X",
    ".X...XXXXXX...X.",
    "................",
]
NB = 128


def door_cell(i):
    """the wall columns the door covers (drawn over by the door frame: left plain felt / red)"""
    ang = (i + 0.5) / N * math.pi * 2
    d = math.atan2(math.sin(ang - DOOR_A), math.cos(ang - DOOR_A))
    return abs(d) < 0.24


# the wall: rows bottom → top, each (z0, z1, colour-fn(col, row))
wall_rows = [(0.0, 0.1, lambda i: C['red']), (0.1, 0.16, lambda i: C['ochre'])]
felt_z = [0.16, 0.5, 0.75, 0.98]
for k in range(len(felt_z) - 1):
    wall_rows.append((felt_z[k], felt_z[k + 1], lambda i: C['felt'] if (i // 8) % 2 else C['feltShade']))
band_top = WALL
band_bot = 0.98
wall_rows.append((band_top - 0.05, band_top, lambda i: C['ochre']))          # the band's gold edges
wall_rows.append((band_bot, band_bot + 0.04, lambda i: C['ochre']))
band_rows = len(MOTIF)
bh = (band_top - 0.05 - band_bot - 0.04) / band_rows
band = []
for r in range(band_rows):
    z1 = band_top - 0.05 - r * bh
    z0 = z1 - bh
    row = MOTIF[r]
    band.append((z0, z1, (lambda row: (lambda i: C['felt'] if row[i % 16] == 'X' else C['red']))(row)))
wall_rows.sort(key=lambda t: t[0])


def wall_ring(rows, n):
    for (z0, z1, fn) in rows:
        for i in range(n):
            a0, a1 = i / n * math.pi * 2, (i + 1) / n * math.pi * 2
            # the felt bulges a touch between the lattice's ribs
            r0 = R * (1.0 + 0.012 * math.sin(z0 / WALL * math.pi))
            r1 = R * (1.0 + 0.012 * math.sin(z1 / WALL * math.pi))
            quad(ring_pt(r0, a0, z0), ring_pt(r0, a1, z0), ring_pt(r1, a1, z1), ring_pt(r1, a0, z1), fn(i))


wall_ring(wall_rows, N)
wall_ring(band, NB)

# the eave's underside (a flat ring under the overhang, dark felt)
for i in range(N):
    a0, a1 = i / N * math.pi * 2, (i + 1) / N * math.pi * 2
    quad(ring_pt(R, a1, WALL), ring_pt(R, a0, WALL), ring_pt(R + EAVE, a0, WALL - 0.02), ring_pt(R + EAVE, a1, WALL - 0.02), C['redDark'], (0, 0, WALL + 2))

# ── the roof: a low dome, eave → crown ring ──
roof = []   # (radius, z)
TS = [0.0, 0.08, 0.12, 0.3, 0.5, 0.72, 1.0]
steps = len(TS) - 1
for t in TS:
    r = (R + EAVE) + (CROWN_R - (R + EAVE)) * t
    # a dome: the uyk poles rise steeply off the wall and flatten toward the crown
    z = WALL - 0.02 + RISE * (1 - (1 - t) ** 1.7)
    roof.append((r, z))
for s in range(steps):
    (r0, z0), (r1, z1) = roof[s], roof[s + 1]
    for i in range(N):
        a0, a1 = i / N * math.pi * 2, (i + 1) / N * math.pi * 2
        strap = i % 8 == 0                 # eight straps up to the crown
        if s == 0:
            col = C['red']                 # the eave band
        elif s == 1:
            col = C['ochre']               # its gold line
        elif strap:
            col = C['rope']
        else:
            col = C['feltRoof'] if (i // 8) % 2 else C['felt']
        quad(ring_pt(r0, a0, z0), ring_pt(r0, a1, z0), ring_pt(r1, a1, z1), ring_pt(r1, a0, z1), col)

# ── the shanyrak: the ring (a square-section torus), dark inside, the crossed arches ──
zc = roof[-1][1]
ring_in, ring_out, ring_h = CROWN_R - 0.08, CROWN_R + 0.02, 0.12
for i in range(N // 2):
    a0, a1 = i / (N // 2) * math.pi * 2, (i + 1) / (N // 2) * math.pi * 2
    quad(ring_pt(ring_out, a0, zc), ring_pt(ring_out, a1, zc), ring_pt(ring_out, a1, zc + ring_h), ring_pt(ring_out, a0, zc + ring_h), C['wood'])
    quad(ring_pt(ring_out, a0, zc + ring_h), ring_pt(ring_out, a1, zc + ring_h), ring_pt(ring_in, a1, zc + ring_h), ring_pt(ring_in, a0, zc + ring_h), C['woodDark'], (0, 0, zc - 5))
    quad(ring_pt(ring_in, a1, zc), ring_pt(ring_in, a0, zc), ring_pt(ring_in, a0, zc + ring_h), ring_pt(ring_in, a1, zc + ring_h), C['woodDark'], 'in')
    # the sooty inside, a shallow cone under the opening (no see-through into an empty yurt)
    tri(ring_pt(ring_in, a1, zc), ring_pt(0, 0, zc - 0.35), ring_pt(ring_in, a0, zc), C['soot'], (0, 0, zc - 5))
# the kulyk: three arches each way, bowed up over the opening
for axis in (0, 1):
    for off in (-0.2, 0.0, 0.2):
        seg = 8
        w = 0.035
        for k in range(seg):
            def P(t, dz=0.0, side=0.0):
                u = -ring_in + 2 * ring_in * t
                lim = math.sqrt(max(0.0, ring_in * ring_in - off * off))
                u = max(-lim, min(lim, u))
                z = zc + ring_h + 0.16 * (1 - (u / max(lim, 1e-3)) ** 2) + dz
                return (u, off + side, z) if axis == 0 else (off + side, u, z)
            t0, t1 = k / seg, (k + 1) / seg
            quad(P(t0, 0, -w), P(t1, 0, -w), P(t1, 0, w), P(t0, 0, w), C['red'], (0, 0, zc - 5))
            quad(P(t0, -0.04, w), P(t1, -0.04, w), P(t1, -0.04, -w), P(t0, -0.04, -w), C['woodDark'], (0, 0, zc + 5))

# ── the door: a frame proud of the wall, two painted leaves, the rolled felt flap above ──
dw, dh, dd = 0.92, 1.28, 0.08
cx, cy = R * math.cos(DOOR_A), R * math.sin(DOOR_A)
nx, ny = math.cos(DOOR_A), math.sin(DOOR_A)          # outward normal (−Y)
tx, ty = -ny, nx                                       # along the wall


def dp(u, z, out):
    return (cx + tx * u + nx * out, cy + ty * u + ny * out, z)


def box(u0, u1, z0, z1, o0, o1, col, col_front=None):
    cf = col_front or col
    ctr = dp((u0 + u1) / 2, (z0 + z1) / 2, (o0 + o1) / 2)

    def quad(p0, p1, p2, p3, c):
        globals()['quad'](p0, p1, p2, p3, c, ctr)
    quad(dp(u0, z0, o1), dp(u1, z0, o1), dp(u1, z1, o1), dp(u0, z1, o1), cf)          # front
    quad(dp(u0, z1, o1), dp(u1, z1, o1), dp(u1, z1, o0), dp(u0, z1, o0), col)         # top
    quad(dp(u1, z0, o0), dp(u1, z0, o1), dp(u1, z1, o1), dp(u1, z1, o0), col)         # side +
    quad(dp(u0, z0, o1), dp(u0, z0, o0), dp(u0, z1, o0), dp(u0, z1, o1), col)         # side −
    quad(dp(u0, z0, o0), dp(u1, z0, o0), dp(u1, z0, o1), dp(u0, z0, o1), col)         # bottom


# the frame: posts, lintel, sill
box(-dw / 2 - 0.1, -dw / 2, 0.0, dh + 0.1, -0.05, dd, C['woodDark'], C['wood'])
box(dw / 2, dw / 2 + 0.1, 0.0, dh + 0.1, -0.05, dd, C['woodDark'], C['wood'])
box(-dw / 2 - 0.1, dw / 2 + 0.1, dh, dh + 0.14, -0.05, dd + 0.01, C['woodDark'], C['wood'])
box(-dw / 2, dw / 2, 0.0, 0.06, -0.05, dd, C['woodDark'])
# the leaves: painted orange-red, a gold diamond-and-bar carving drawn as faces (a 4 × 6 grid per leaf)
for leaf in (-1, 1):
    u0, u1 = (-dw / 2, -0.01) if leaf < 0 else (0.01, dw / 2)
    z0, z1 = 0.06, dh
    gx, gz = 5, 9
    for ix in range(gx):
        for iz in range(gz):
            ua, ub = u0 + (u1 - u0) * ix / gx, u0 + (u1 - u0) * (ix + 1) / gx
            za, zb = z0 + (z1 - z0) * iz / gz, z0 + (z1 - z0) * (iz + 1) / gz
            edge = ix in (0, gx - 1) or iz in (0, gz - 1)
            centre = ix == gx // 2 and iz == gz // 2
            col = C['doorGold'] if centre else C['woodDark'] if edge else C['door']
            quad(dp(ua, za, dd * 0.6), dp(ub, za, dd * 0.6), dp(ub, zb, dd * 0.6), dp(ua, zb, dd * 0.6), col, (0, 0, 1))
# the felt door flap, rolled up above the lintel (an 8-sided roll along the wall)
roll_r, roll_z = 0.1, dh + 0.26
for k in range(8):
    b0, b1 = k / 8 * math.pi * 2, (k + 1) / 8 * math.pi * 2
    for (u0, u1) in ((-dw / 2 - 0.12, 0.0), (0.0, dw / 2 + 0.12)):
        p = lambda u, b: dp(u, roll_z + roll_r * math.sin(b), dd * 0.4 + roll_r * math.cos(b))
        quad(p(u0, b0), p(u1, b0), p(u1, b1), p(u0, b1), C['felt'] if k % 2 else C['feltShade'], dp((u0 + u1) / 2, roll_z, dd * 0.4))
# two ties hanging from the roll
for u in (-dw / 2 + 0.05, dw / 2 - 0.05):
    box(u - 0.02, u + 0.02, roll_z - 0.34, roll_z, dd * 0.4 + 0.08, dd * 0.4 + 0.11, C['red'])

# ── the mesh ──
me = bpy.data.meshes.new(a.name)
bm = bmesh.new()
bv = [bm.verts.new(v) for v in verts]
col_layer = bm.loops.layers.float_color.new("Color")
for (ids, col) in faces:
    try:
        f = bm.faces.new([bv[i] for i in ids])
    except ValueError:
        continue
    for lp in f.loops:
        lp[col_layer] = (col[0], col[1], col[2], 1.0)
bmesh.ops.triangulate(bm, faces=bm.faces[:])
bm.to_mesh(me)
bm.free()
for p in me.polygons:
    p.use_smooth = False
ob = bpy.data.objects.new(a.name, me)
scene = bpy.context.scene
scene.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
me.color_attributes.active_color = me.color_attributes["Color"]

# ── Cycles AO into the colour's alpha (the kit's convention: rgb = albedo, a = AO 0.35..1) ──
if a.ao > 0:
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.world = bpy.data.worlds.new("w")
    scene.world.light_settings.distance = a.ao
    # the ground under it occludes too: a big plane, hidden from the export
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.005))
    ground = bpy.context.active_object
    mat = bpy.data.materials.new("bake")
    mat.use_nodes = True
    ob.data.materials.append(mat)
    ground.data.materials.append(mat)
    ao = me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
    me.color_attributes.active_color = ao
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.bake(type="AO")
    colattr = me.color_attributes["Color"]
    for i in range(len(colattr.data)):
        r, g, b, _ = colattr.data[i].color
        colattr.data[i].color = (r, g, b, 0.35 + 0.65 * ao.data[i].color[0])
    me.color_attributes.remove(ao)
    bpy.data.objects.remove(ground)
# the exporter writes the RENDER colour attribute as COLOR_0
me.color_attributes.active_color = me.color_attributes["Color"]
me.color_attributes.render_color_index = me.color_attributes.active_color_index

out_mat = bpy.data.materials.new("nalati-yurt")
out_mat.use_nodes = True
nt = out_mat.node_tree
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Color"
nt.links.new(vc.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
ob.data.materials.clear()
ob.data.materials.append(out_mat)
os.makedirs(a.out, exist_ok=True)
path = os.path.join(a.out, a.name + ".glb")
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                          export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_normals=True,
                          export_image_format="NONE")
d = ob.dimensions
info = {"name": a.name, "tris": len(me.polygons), "size_m": [round(d.x, 2), round(d.z, 2), round(d.y, 2)],
        "source": "scripts/blender/nalati_yurt.py (modelled from code)", "facing": "+z (the door)",
        "vertex_colour": "COLOR_0 rgb = albedo (linear), a = Cycles AO (0.35..1)"}
with open(os.path.join(a.out, a.name + ".json"), "w") as fh:
    json.dump(info, fh, indent=1)
print("NALATI_YURT", json.dumps(info))
