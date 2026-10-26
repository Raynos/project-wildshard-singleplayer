"""kitlib.py: the open-plots kit's shared Blender helpers (RM4, night-market-remaster-mini-plan.md).

A kit piece is built from bmesh primitives whose faces carry a material named `<Role>.<slot>`: Role is `Kit` (lit) or
`Glow` (emissive), slot a palette key (`wood`, `stone`, `gold`...). Each piece's ambient occlusion is ray-traced (BVH) into
a corner colour, then the piece is exported (scripts/blender/lib/glb.py) as one node per `<variant>.<Role>.<slot>` in
game axes (x, y up, z = -Blender y) with flat normals, the ruled-trim UVs of data/trim.json (TEXCOORD_0: metres along
and up the face plus 32 m x the slot's trim band) and the occlusion as a grey shade (COLOR_0). The game generator (src/shards/open-plots/generators/kitGlb.mjs) colours each triangle palette[slot] x
shade, so one kit retints per idea. Blender axes here: x east, y back (away from the piece's front), z up; a piece's front
faces -y, which is game +z.
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib'))
from glb import write_glb  # noqa: E402

SPACING = 12.0  # metres between variants while baking, so one variant never occludes another
PERIOD = 4.8


class Piece:
    """One variant under construction: a bmesh plus its material slots, its emitters and its stretch band."""

    def __init__(self):
        self.bm = bmesh.new()
        self.slots = []
        self.emitters = []

    def slot(self, name):
        if name not in self.slots:
            self.slots.append(name)
        return self.slots.index(name)

    def face(self, points, slot):
        verts = [self.bm.verts.new(p) for p in points]
        f = self.bm.faces.new(verts)
        f.material_index = self.slot(slot)
        return f

    def box(self, lo, hi, slot, top=None, bottom=False):
        (x0, y0, z0), (x1, y1, z1) = lo, hi
        self.face([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], top or slot)
        if bottom:
            self.face([(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)], slot)
        self.face([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], slot)
        self.face([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], slot)
        self.face([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], slot)
        self.face([(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], slot)

    def ring(self, cx, cy, r, z, sides, spin):
        return [(cx + r * math.cos(spin + 2 * math.pi * i / sides), cy + r * math.sin(spin + 2 * math.pi * i / sides), z)
                for i in range(sides)]

    def lathe(self, cx, cy, profile, sides, slots, spin=0.0, cap_top=True, cap_bottom=False):
        """Revolve [(radius, z), ...] bottom to top; band i takes slots[i] (the last slot repeats)."""
        rings = [self.ring(cx, cy, r, z, sides, spin) for r, z in profile]
        for band in range(len(rings) - 1):
            slot = slots[min(band, len(slots) - 1)]
            a, b = rings[band], rings[band + 1]
            for i in range(sides):
                j = (i + 1) % sides
                if profile[band][0] <= 1e-6:
                    self.face([a[i], b[j], b[i]], slot)
                elif profile[band + 1][0] <= 1e-6:
                    self.face([a[i], a[j], b[i]], slot)
                else:
                    self.face([a[i], a[j], b[j], b[i]], slot)
        if cap_top and profile[-1][0] > 1e-6:
            self.face(rings[-1], slots[-1])
        if cap_bottom and profile[0][0] > 1e-6:
            self.face(list(reversed(rings[0])), slots[0])

    def prism(self, cx, cy, r0, r1, z0, z1, sides, slot, spin=0.0, cap_top=True, cap_bottom=False):
        self.lathe(cx, cy, [(r0, z0), (r1, z1)], sides, [slot], spin, cap_top, cap_bottom)

    def panel(self, points, slot, back=None):
        """A thin sheet seen from both sides (cloth, a valance): the face and its reverse."""
        self.face(points, slot)
        self.face(list(reversed(points)), back or slot)

    def slab(self, corners, thickness, slot, under=None):
        """A sloped slab (a roof, an awning): `corners` its top face counter-clockwise from above, extruded down."""
        low = [(x, y, z - thickness) for x, y, z in corners]
        self.face(corners, slot)
        self.face(list(reversed(low)), under or slot)
        for i in range(len(corners)):
            j = (i + 1) % len(corners)
            self.face([low[i], low[j], corners[j], corners[i]], under or slot)

    def wheel(self, cx, cy, cz, radius, width, sides, slot, hub=None):
        """A wheel turning about the y axis (rolling along x), capped both sides."""
        ring = [(cx + radius * math.cos(2 * math.pi * i / sides), cz + radius * math.sin(2 * math.pi * i / sides))
                for i in range(sides)]
        y0, y1 = cy - width / 2, cy + width / 2
        for i in range(sides):
            j = (i + 1) % sides
            (xa, za), (xb, zb) = ring[i], ring[j]
            self.face([(xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za)], slot)
        self.face([(x, y0, z) for x, z in ring], hub or slot)
        self.face([(x, y1, z) for x, z in reversed(ring)], hub or slot)

    def paper_lantern(self, x, y, top, radius=0.3, sides=8):
        """A round red paper lantern hanging from `top` (gold caps, a red tassel), its light an emitter."""
        h = radius * 1.8
        z1 = top - 0.04
        z0 = z1 - h
        profile = [(radius * 0.25, z0 - 0.04), (radius * 0.55, z0), (radius * 0.9, z0 + h * 0.18), (radius, z0 + h * 0.5),
                   (radius * 0.9, z0 + h * 0.82), (radius * 0.55, z1), (radius * 0.25, z1 + 0.04)]
        self.lathe(x, y, profile, sides, ['Kit.gold', 'Glow.paper', 'Glow.paper', 'Glow.paper', 'Glow.paper', 'Kit.gold'],
                   cap_bottom=True)
        self.prism(x, y, radius * 0.08, radius * 0.18, z0 - 0.04 - radius * 0.6, z0 - 0.04, 4, 'Kit.stall')
        self.emitter((x, y, z0 + h * 0.5), 'paper')

    def emitter(self, at, slot):
        self.emitters.append((at, slot))


def reset_scene(ground=0.0):
    """An empty scene with the occluding floor at `ground` (a bridge's is the canal's water)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    plane = bpy.data.meshes.new('ground')
    plane.from_pydata([(-500, -500, ground), (500, -500, ground), (500, 500, ground), (-500, 500, ground)], [], [(0, 1, 2, 3)])
    scene.collection.objects.link(bpy.data.objects.new('ground', plane))
    return scene


def realise(piece, name, offset):
    """Turn a piece into a triangulated object `offset` metres along x, its faces' materials named by slot."""
    bmesh.ops.triangulate(piece.bm, faces=piece.bm.faces[:])
    mesh = bpy.data.meshes.new(name)
    piece.bm.to_mesh(mesh)
    piece.bm.free()
    for slot in piece.slots:
        material = bpy.data.materials.get(slot) or bpy.data.materials.new(slot)
        mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    obj.location.x = offset
    bpy.context.scene.collection.objects.link(obj)
    return obj


AO_DISTANCE = 0.8
AO_RAYS = 48


def hemisphere(count):
    """Fixed cosine-weighted directions about +z (a Fibonacci spiral): the same rays every build, so the bake is exact."""
    golden = math.pi * (3 - math.sqrt(5))
    rows = []
    for i in range(count):
        r = math.sqrt((i + 0.5) / count)
        a = i * golden
        rows.append((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - r * r))))
    return rows


def bake_shade(objects):
    """Ambient occlusion within AO_DISTANCE (the floor and every part of the scene occlude), traced from each corner a
    hair off its face along AO_RAYS fixed directions, into each object's corner colour `shade` (no renderer, no
    noise: a rebuild writes the same bytes)."""
    scene = bpy.context.scene
    verts, polys = [], []
    for obj in scene.objects:
        if obj.type != 'MESH':
            continue
        base = len(verts)
        verts.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        polys.extend([base + i for i in poly.vertices] for poly in obj.data.polygons)
    tree = BVHTree.FromPolygons(verts, polys, epsilon=0.0)
    rays = hemisphere(AO_RAYS)
    for obj in objects:
        mesh = obj.data
        attr = mesh.color_attributes.new('shade', 'FLOAT_COLOR', 'CORNER')
        rotation = obj.matrix_world.to_3x3()
        for poly in mesh.polygons:
            n = (rotation @ poly.normal).normalized()
            t = n.orthogonal().normalized()
            b = n.cross(t)
            for loop in poly.loop_indices:
                corner = obj.matrix_world @ mesh.vertices[mesh.loops[loop].vertex_index].co
                # start a little toward the face's middle and off it, so the corner's own edges don't occlude it
                centre = obj.matrix_world @ poly.center
                origin = corner + (centre - corner) * 0.02 + n * 1e-3
                open_rays = 0
                for x, y, z in rays:
                    hit = tree.ray_cast(origin, t * x + b * y + n * z, AO_DISTANCE)
                    if hit[0] is None:
                        open_rays += 1
                ao = open_rays / len(rays)
                attr.data[loop].color = (ao, ao, ao, 1.0)


TRIM_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'src', 'shards', 'open-plots', 'data',
                         'trim.json')


def trim_bands():
    """data/trim.json (sp-o2's RM5.3 contract): each trim's band number and the band's width in metres."""
    with open(TRIM_FILE) as f:
        trim = json.load(f)
    return trim['band'], {name: row['band'] for name, row in trim['trims'].items()}


def face_uvs(points, normal, band, width, roof):
    """A face's ruled-trim UVs: metres along its horizontal tangent (u, moved into [0, width)) plus width x its band, and
    metres up the face (v; down the slope for roof tiles). A flat face uses x and y."""
    nx, ny, nz = normal
    if abs(nz) > 0.95:
        t, b = (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)
    else:
        length = math.hypot(nx, ny)
        t = (-ny / length, nx / length, 0.0)
        b = (ny * t[2] - nz * t[1], nz * t[0] - nx * t[2], nx * t[1] - ny * t[0])
    us = [p[0] * t[0] + p[1] * t[1] + p[2] * t[2] for p in points]
    vs = [p[0] * b[0] + p[1] * b[1] + p[2] * b[2] for p in points]
    if roof:
        vs = [-v for v in vs]
    # whole steps of 4.8 m, a multiple of every trim's period (0.2, 0.24, 0.3, 0.32, 0.8 m), keep patterns continuous
    shift = math.floor(min(us) / PERIOD) * PERIOD
    if max(us) - shift >= width:
        raise ValueError(f'kit face wider than the {width} m trim band')
    return [(u - shift + band * width, v) for u, v in zip(us, vs)]


def export_family(path, family, objects, emitters, extras, trims, floor=0.42):
    """One node per `<variant>.<Role>.<slot>`; COLOR_0 is the shade lifted to [floor, 1] (Glow faces stay 1);
    TEXCOORD_0 is the ruled trim (`trims`: slot -> trim name in data/trim.json; plain otherwise)."""
    width, bands = trim_bands()
    meshes = []
    for variant, obj in enumerate(objects):
        mesh = obj.data
        shade = mesh.color_attributes['shade'].data
        tints = mesh.attributes['tint'].data if 'tint' in mesh.attributes else None
        groups = {}
        for poly in mesh.polygons:
            slot = mesh.materials[poly.material_index].name
            groups.setdefault(slot, []).append(poly)
        for slot, polys in groups.items():
            role, name = slot.split('.')
            trim = trims.get(name, 'plain') if role == 'Kit' else 'plain'
            pos, nor, uvs, col = [], [], [], []
            for poly in polys:
                n = poly.normal
                corners = [mesh.vertices[mesh.loops[loop].vertex_index].co for loop in poly.loop_indices]
                uvs.extend(face_uvs([(c.x, c.y, c.z) for c in corners], (n.x, n.y, n.z), bands[trim], width,
                                    trim == 'roofTile'))
                # a corner buried in another part bakes black; no corner falls below 0.6 x its face's brightest
                ao = [max(0.0, min(1.0, shade[loop].color[0])) for loop in poly.loop_indices]
                ao = [max(a, 0.6 * max(ao)) for a in ao]
                # an optional per-face tint (a generated tree's lighter and darker facets) multiplies the shade
                tint = tints[poly.index].value if tints is not None else 1.0
                for a, c in zip(ao, corners):
                    pos.append((c.x, c.z, -c.y))
                    nor.append((n.x, n.z, -n.y))
                    s = 1.0 if role == 'Glow' else (floor + (1 - floor) * a) * tint
                    col.append((s, s, s))
            meshes.append((f'{variant}.{slot}', {
                'POSITION': np.array(pos, dtype=np.float32), 'NORMAL': np.array(nor, dtype=np.float32),
                'TEXCOORD_0': np.array(uvs, dtype=np.float32), 'COLOR_0': np.array(col, dtype=np.float32),
                'indices': np.arange(len(pos), dtype=np.uint32), 'material': 0,
            }))
    out = {'family': family, 'variants': len(objects),
           'emitters': [[[round(x, 4), round(z, 4), round(-y, 4), slot] for (x, y, z), slot in group] for group in emitters]}
    out.update(extras)
    # one material: the SDK's world reader (kitGlb.mjs decodes through it) maps every primitive by material name
    write_glb(path, meshes, extras=out, materials=['kit'])


def build_family(out_dir, family, builders, trims, extras=None):
    """Build, bake and export one family: `builders` makes each variant's Piece at the origin; `trims` maps slots to
    their ruled trim."""
    objects, emitters = [], []
    for variant, build in enumerate(builders):
        piece = build()
        if isinstance(piece, bpy.types.Object):  # an imported model, its faces' materials already named by slot
            piece.location.x = variant * SPACING
            objects.append(piece)
            emitters.append([])
        else:
            objects.append(realise(piece, f'{family}-{variant}', variant * SPACING))
            emitters.append(piece.emitters)
    bake_shade(objects)
    export_family(os.path.join(out_dir, f'{family}.glb'), family, objects, emitters, extras or {}, trims)
    tris = sum(len(obj.data.polygons) for obj in objects)
    print(f'kit {family}: {len(objects)} variants, {tris} triangles')
