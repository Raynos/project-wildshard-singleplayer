"""
rocklib.py — granite from code for PH-B2 (scripts/blender/pine-hollow/crags/build_crags.py): convex jointed blocks with weathered
edges, the cliff / buttress / tor / boulder / scree modules built from them, and the mesh plumbing (bmesh ↔ objects,
decimation, the Cycles vertex AO bake). Blender space throughout: Z up, a module's FRONT (the face that looks down the
slope in the game, its local +Z) is Blender −Y, its base at z = 0.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector, noise


# ── blocks ───────────────────────────────────────────────────────────────────────────────────────────────────────────

def _split_long_edges(bm, max_len, rounds=4):
    """adaptive subdivision: halve every edge longer than `max_len` (triangles re-made each round)"""
    for _ in range(rounds):
        long_edges = [e for e in bm.edges if e.calc_length() > max_len]
        if not long_edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])


def convex_block(rng, sx, sy, sz, cuts=7, chamfer=(0.04, 0.12), wobble=0.16, seg=0.85, front_bias=0.6, bevel_seg=1, lump=0.1, round_=0.18, sub=3):
    """
    A granite block: a subdivided box (sx × sy × sz, base centre at the origin) rounded a little toward an ellipsoid and
    lumped by a slow noise (the weathered body), then clipped by `cuts` planes — the joint sets: near-vertical cuts that
    shear a front corner or edge, near-horizontal ones that take a top edge off (sheeting), slanted face fractures, a few
    free ones — so the flat fracture faces meet the rounded body in crisp edges. Long edges are split and a fine noise
    pushed along the normals. Returns a bmesh (triangles).
    """
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=sub, use_grid_fill=True)
    o = Vector((rng.uniform(-90, 90), rng.uniform(-90, 90), rng.uniform(-90, 90)))
    ext = max(sx, sy, sz)
    for v in bm.verts:
        c = v.co.copy()
        sph = c.normalized() * 0.5 * math.sqrt(3) * 0.62
        c = c.lerp(sph, round_)
        p = Vector((c.x * sx, c.y * sy, (c.z + 0.5) * sz))
        n = noise.fractal(p * (1.6 / ext) + o, 0.8, 2.0, 3)
        p += Vector((c.x, c.y, c.z)).normalized() * n * lump * ext
        v.co = p
    half = Vector((sx / 2, sy / 2, sz / 2))
    centre = Vector((0, 0, sz / 2))
    for i in range(cuts):
        kind = rng.random()
        if kind < 0.38:      # a vertical joint shearing a vertical edge (front edges more often)
            ax = rng.choice((-1, 1)); ay = -1 if rng.random() < front_bias else 1
            d = Vector((ax * rng.uniform(0.2, 1.0), ay * rng.uniform(0.3, 1.0), rng.uniform(-0.3, 0.3)))
        elif kind < 0.66:    # a top edge / corner off: the sheeting and the frost
            d = Vector((rng.uniform(-0.9, 0.9), -rng.uniform(0.1, 1.0) if rng.random() < front_bias else rng.uniform(0.1, 1.0), rng.uniform(0.4, 1.3)))
        elif kind < 0.86:    # a face fractured off at a slant
            d = Vector((rng.uniform(-0.4, 0.4), -1.0 if rng.random() < front_bias else 1.0, rng.uniform(-0.4, 0.4)))
            if rng.random() < 0.35:
                d = Vector((rng.choice((-1.0, 1.0)), rng.uniform(-0.4, 0.4), rng.uniform(-0.4, 0.4)))
        else:                # anything
            d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.3, 1)))
        d.normalize()
        # the plane's distance from the centre: past 45–85 % of the block's extent along d, so it bites a corner / edge / face
        reach = abs(d.x) * half.x + abs(d.y) * half.y + abs(d.z) * half.z
        co = centre + d * reach * rng.uniform(0.45, 0.85)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=d, clear_outer=True)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    # the base stays flat (it sits in the ground)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((0, 0, 0.02 * sz)), plane_no=Vector((0, 0, -1)), clear_outer=True)
    edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if edges:
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    off = rng.uniform(*chamfer) * min(1.0, min(sx, sy, sz) / 2.5)
    if off > 0.02 and bevel_seg > 0:
        sharp = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(40)]
        if sharp:
            bmesh.ops.bevel(bm, geom=sharp, offset=off, offset_type='OFFSET', segments=bevel_seg, profile=0.6, affect='EDGES', clamp_overlap=True)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    _split_long_edges(bm, seg)
    bm.normal_update()
    if wobble > 0:
        # a slow bulge (no dead-flat fracture face) and a mid undulation, along the normals
        for v in bm.verts:
            n = 0.8 * noise.fractal(v.co * 0.3 + o, 0.9, 2.0, 2) + 0.35 * noise.fractal(v.co * 1.1 + o, 0.8, 2.0, 2)
            v.co += v.normal * n * wobble * 0.6
    bm.normal_update()
    return bm


def transform_bm(bm, m):
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts[:])
    return bm


def join_bms(bms):
    """one bmesh from several (the blocks overlap: no boolean, the AO bake darkens the joints)"""
    me = bpy.data.meshes.new('tmp_join')
    out = bmesh.new()
    for b in bms:
        b.to_mesh(me)
        out.from_mesh(me)
        b.free()
    bpy.data.meshes.remove(me)
    return out


# ── modules ──────────────────────────────────────────────────────────────────────────────────────────────────────────

def M(x=0.0, y=0.0, z=0.0, rz=0.0, rx=0.0, ry=0.0):
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(ry, 4, 'Y')


def cliff(rng, width, height, depth, tiers=(1, 3), step=0.9, foot=2):
    """
    A cliff band: columns split by vertical joints across `width`, each a stack of 1–3 sheeted slabs stepping back and
    forth (the ledges), their tops ragged, a couple of fallen blocks at the foot. Front toward −Y, back buried.
    """
    bms = []
    x = -width / 2
    while x < width / 2 - 0.8:
        cw = min(rng.uniform(2.4, 4.8), width / 2 - x)
        ch = height * rng.uniform(0.68, 1.0)
        cd = depth * rng.uniform(0.85, 1.0)
        fy = rng.uniform(-step, step) * 0.6                   # this column's front, stepped
        n = rng.randint(*tiers)
        z = 0.0
        hs = sorted(rng.uniform(0.25, 0.75) for _ in range(n - 1))
        cuts = [0.0] + [h * ch for h in hs] + [ch]
        for k in range(n):
            sh = cuts[k + 1] - cuts[k]
            if sh < 0.9:
                continue
            # an upper slab sits a little back or juts out, and leans a few degrees: a ledge or an overhang
            dy = fy + (rng.uniform(-0.2, 0.5) if k > 0 else 0)
            b = convex_block(rng, cw * rng.uniform(0.95, 1.1), cd, sh + 0.15, cuts=rng.randint(5, 9))
            transform_bm(b, M(x + cw / 2 + rng.uniform(-0.12, 0.12), dy + cd / 2 - depth / 2, cuts[k] - 0.05, rng.uniform(-0.05, 0.05), rng.uniform(-0.04, 0.04), rng.uniform(-0.03, 0.03)))
            bms.append(b)
        x += cw + rng.uniform(-0.1, 0.14)                     # the joint: overlapping to a hand's width
    for _ in range(foot):                                     # fallen blocks at the foot
        s = rng.uniform(1.0, 2.2)
        b = convex_block(rng, s * rng.uniform(0.9, 1.5), s, s * rng.uniform(0.6, 0.9), cuts=rng.randint(4, 7))
        transform_bm(b, M(rng.uniform(-width / 2.5, width / 2.5), -depth / 2 - step - rng.uniform(0.3, 1.8), -0.2, rng.uniform(0, 6.3), rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3)))
        bms.append(b)
    return join_bms(bms)


def buttress(rng, height, depth):
    """a tall prow: two or three columns jointed vertically, narrowing up, the front edge sheared"""
    bms = []
    n = rng.randint(2, 3)
    for i in range(n):
        w = rng.uniform(2.2, 3.4)
        h = height * (1 - i * rng.uniform(0.12, 0.25))
        x = (i - (n - 1) / 2) * w * 0.9 + rng.uniform(-0.3, 0.3)
        z = 0.0
        tiers = rng.randint(2, 3)
        cuts = [0.0] + sorted(rng.uniform(0.3, 0.8) * h for _ in range(tiers - 1)) + [h]
        for k in range(tiers):
            sh = cuts[k + 1] - cuts[k]
            ww = w * (1 - 0.12 * k)
            b = convex_block(rng, ww, depth * (1 - 0.1 * k), sh + 0.12, cuts=rng.randint(4, 7), front_bias=0.8)
            transform_bm(b, M(x + rng.uniform(-0.2, 0.2), rng.uniform(-0.5, 0.4) - abs(i - (n - 1) / 2) * 0.8, cuts[k] - 0.04, rng.uniform(-0.06, 0.06)))
            bms.append(b)
    return join_bms(bms)


def slab(rng, width, height):
    """an exfoliation slab: one big sheet leaning out of the slope over a jumble, its underside in shadow"""
    bms = []
    t = rng.uniform(1.2, 1.8)
    b = convex_block(rng, width, t, height, cuts=rng.randint(4, 6), chamfer=(0.15, 0.3))
    transform_bm(b, M(0, 0.6, 0.2, 0, -rng.uniform(0.28, 0.42)))   # leaning out (toward −Y) over its foot
    bms.append(b)
    b2 = convex_block(rng, width * 0.85, t * 2.0, height * 0.4, cuts=7)
    transform_bm(b2, M(rng.uniform(-0.5, 0.5), 4.6, -0.3, rng.uniform(-0.1, 0.1), 0.12))
    bms.append(b2)
    for _ in range(3):
        s = rng.uniform(0.8, 1.6)
        bb = convex_block(rng, s * 1.3, s, s * 0.8, cuts=5)
        transform_bm(bb, M(rng.uniform(-width / 3, width / 3), -rng.uniform(0.2, 1.6), -0.1, rng.uniform(0, 6.3), rng.uniform(-0.3, 0.3)))
        bms.append(bb)
    return join_bms(bms)


def tor(rng, height):
    """a granite tor: rounded 'woolsack' blocks stacked in 2–4 tiers, each tier a little off the one below"""
    bms = []
    tiers = rng.randint(2, 4)
    z = 0.0
    base = rng.uniform(4.0, 5.5)
    for k in range(tiers):
        th = height / tiers * rng.uniform(0.8, 1.2)
        w = base * (1 - 0.18 * k) * rng.uniform(0.85, 1.1)
        for j in range(rng.randint(1, 2)):
            ww = w / (1 + j * 0.6)
            b = convex_block(rng, ww, ww * rng.uniform(0.7, 1.0), th, cuts=rng.randint(2, 4), chamfer=(0.3, 0.6), wobble=0.14, bevel_seg=2, lump=0.08, round_=0.55)
            transform_bm(b, M(rng.uniform(-0.6, 0.6) + j * ww * 0.7, rng.uniform(-0.5, 0.5), z - 0.05, rng.uniform(-0.2, 0.2), rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05)))
            bms.append(b)
        z += th * 0.97
    return join_bms(bms)


def boulder(rng, size):
    b = convex_block(rng, size * rng.uniform(1.0, 1.4), size, size * rng.uniform(0.6, 0.85), cuts=rng.randint(4, 7), chamfer=(0.06, 0.16), seg=0.6, wobble=0.07 * size, lump=0.12, round_=0.45)
    transform_bm(b, M(0, 0, -size * 0.12))
    return b


def scree(rng, length, width, n, big=0.7):
    """a scree fan's patch: `n` angular stones in an ellipse, the big ones up the fan (−Y is down the slope), sunk"""
    bms = []
    for i in range(n):
        u = rng.random()
        a = rng.uniform(0, math.tau)
        r = math.sqrt(rng.random())
        x, y = math.cos(a) * r * width / 2, math.sin(a) * r * length / 2
        s = rng.uniform(0.22, big) * (1.15 - 0.5 * (y / length + 0.5))   # larger up the fan (+Y), smaller down it
        b = convex_block(rng, s * rng.uniform(1.0, 1.6), s, s * rng.uniform(0.5, 0.8), cuts=rng.randint(3, 6), chamfer=(0.0, 0.0), wobble=0.0, seg=10, lump=0.14, round_=0.3)
        transform_bm(b, M(x, y, -s * 0.25, rng.uniform(0, 6.3), rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35)))
        bms.append(b)
        del u
    return join_bms(bms)


# ── objects, decimation, AO ──────────────────────────────────────────────────────────────────────────────────────────

def bm_to_object(bm, name, scene, clean=True):
    me = bpy.data.meshes.new(name)
    if clean:
        bmesh.ops.dissolve_degenerate(bm, dist=0.002, edges=bm.edges[:])
    bm.to_mesh(me)
    bm.free()
    if clean:
        me.validate(clean_customdata=False)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def decimate(ob, target_tris):
    """collapse-decimate to about `target_tris` (applied)"""
    n = tri_count(ob)
    if n <= target_tris:
        return ob
    mod = ob.modifiers.new('dec', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = max(0.01, target_tris / n)
    mod.use_collapse_triangulate = True
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def copy_object(ob, name, scene):
    c = ob.copy()
    c.data = ob.data.copy()
    c.name = name
    c.data.name = name
    scene.collection.objects.link(c)
    return c


def smooth_by_angle(ob, deg=38):
    """smooth shading with the creases kept (split normals past `deg`) — the edges' bevels round off, the joints stay crisp"""
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(deg))


def set_colors(ob, rgba):
    """a POINT float colour attribute 'Col' (N × 4), made active for export"""
    me = ob.data
    if 'Col' in me.color_attributes:
        me.color_attributes.remove(me.color_attributes['Col'])
    a = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    a.data.foreach_set('color', np.ascontiguousarray(rgba, dtype=np.float32).ravel())
    me.color_attributes.active_color = a
    me.color_attributes.render_color_index = me.color_attributes.find('Col')
    return a


def vertex_array(ob):
    n = len(ob.data.vertices)
    co = np.empty(n * 3, np.float32)
    ob.data.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def bake_vertex_ao(obs, distance, scene, samples=64):
    """Cycles AO into each object's 'AO' POINT colour attribute; returns {name: ao (N,)}"""
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.device = 'GPU'
    scene.world.light_settings.distance = distance
    bk = scene.render.bake
    bk.target = 'VERTEX_COLORS'
    for ob in obs:
        me = ob.data
        if 'AO' in me.color_attributes:
            me.color_attributes.remove(me.color_attributes['AO'])
        me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
        me.color_attributes.active_color = me.color_attributes['AO']
        if not me.materials:
            me.materials.append(bake_material())
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.bake(type='AO')
    out = {}
    for ob in obs:
        me = ob.data
        n = len(me.vertices)
        a = np.empty(n * 4, np.float32)
        me.color_attributes['AO'].data.foreach_get('color', a)
        out[ob.name] = a.reshape(-1, 4)[:, 0].copy()
        me.color_attributes.remove(me.color_attributes['AO'])
    return out


_BAKE_MAT = None


def bake_material():
    global _BAKE_MAT
    if _BAKE_MAT is None:
        m = bpy.data.materials.new('bake')
        m.use_nodes = True
        _BAKE_MAT = m
    return _BAKE_MAT


# ── E322 F-L2 (the Debug ▸ Crags B kit, build_crags_b.py): one fused mass per module, weathered ─────────────────────────

def _smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def warp_bm(bm, rng, amp=0.9, freq=0.07):
    """a slow 3-D warp of every vertex (the columns bend, the top outline goes ragged: no box read)"""
    o = Vector((rng.uniform(-99, 99), rng.uniform(-99, 99), rng.uniform(-99, 99)))
    for v in bm.verts:
        w = noise.noise_vector(v.co * freq + o)
        # the base stays put (it sits in the ground), the warp grows with height
        v.co += Vector((w.x, w.y, w.z * 0.35)) * amp * _smooth(0.0, 3.0, v.co.z)
    return bm


def fuse(bm, name, scene, voxel):
    """
    The module's overlapping blocks as ONE watertight mass: a voxel remesh (`voxel` m) welds them, so the seams between
    the stacked blocks (A's read: a pile of boxes) go and the joints come back as carved cracks (`weather`).
    """
    ob = bm_to_object(bm, name, scene)
    mod = ob.modifiers.new('fuse', 'REMESH')
    mod.mode = 'VOXEL'
    mod.voxel_size = voxel
    mod.adaptivity = 0.0
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob], selected_editable_objects=[ob]):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def weather(ob, rng, joint=3.4, crack=0.32, strata=1.3, ledge=0.3, lump=0.3, base=0.0):
    """
    Granite's weathering carved into a fused mass along its normals: vertical joints (a Voronoi of columns, stretched up:
    cracks `crack` m deep where two cells meet), sheeting ledges on the steep faces (a sawtooth in height, warped, `ledge`
    m lips every ~`strata` m), and a lumpy fractal. The base (z < `base` + 0.3) is left alone.
    """
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.normal_update()
    o = Vector((rng.uniform(-99, 99), rng.uniform(-99, 99), rng.uniform(-99, 99)))
    moves = []
    for v in bm.verts:
        p, n = v.co.copy(), v.normal.copy()
        d, _pts = noise.voronoi(Vector((p.x / joint, p.y / joint, p.z / (joint * 3.5))) + o, distance_metric='DISTANCE', exponent=2.5)
        edge = d[1] - d[0]
        c = crack * (1 - _smooth(0.0, 0.16, edge))
        zz = (p.z + noise.fractal(p * 0.12 + o, 0.8, 2.0, 2) * 1.6) / strata
        f = zz - math.floor(zz)
        steep = 1 - abs(n.z)
        lp = ledge * (f ** 2.5) * steep * (0.6 + 0.8 * noise.noise(p * 0.2 + o * 1.7))
        lm = lump * (noise.fractal(p * 0.32 + o, 0.9, 2.0, 3) + 0.35 * noise.fractal(p * 1.3 + o, 0.8, 2.0, 2))
        keep = _smooth(base, base + 0.6, p.z)
        moves.append(n * (lm - c - lp) * keep)
    for v, m in zip(bm.verts, moves):
        v.co += m
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def hero(rng, height=26.0, width=20.0, depth=13.0):
    """
    The lookout's hero crag: a granite prow ~`height` m tall — four or five tall columns jointed vertically, the middle
    ones highest and leaning a little out, shoulders stepping down each side, a spall of blocks at the foot — for
    `fuse` + `weather` (one sculpted mass, not a stack).
    """
    bms = []
    n = rng.randint(4, 5)
    for i in range(n):
        u = (i - (n - 1) / 2) / ((n - 1) / 2)                # −1 … 1 across
        w = width / n * rng.uniform(1.05, 1.3)
        h = height * (1 - 0.45 * abs(u) ** 1.4) * rng.uniform(0.9, 1.05)
        d = depth * (1 - 0.3 * abs(u)) * rng.uniform(0.85, 1.0)
        tiers = rng.randint(2, 3)
        cuts = [0.0] + sorted(rng.uniform(0.3, 0.75) * h for _ in range(tiers - 1)) + [h]
        for k in range(tiers):
            sh = cuts[k + 1] - cuts[k]
            ww = w * (1 - 0.1 * k)
            b = convex_block(rng, ww, d * (1 - 0.12 * k), sh + 0.4, cuts=rng.randint(5, 8), front_bias=0.75, sub=4)
            transform_bm(b, M(u * width / 2 + rng.uniform(-0.4, 0.4), -k * rng.uniform(0.2, 0.9) + abs(u) * 1.5, cuts[k] - 0.2,
                              rng.uniform(-0.08, 0.08), rng.uniform(-0.1, 0.02)))
            bms.append(b)
    for _ in range(5):                                        # the spall at the foot
        s = rng.uniform(1.4, 3.2)
        b = convex_block(rng, s * rng.uniform(1.0, 1.5), s, s * rng.uniform(0.6, 0.9), cuts=rng.randint(4, 7))
        transform_bm(b, M(rng.uniform(-width / 2.2, width / 2.2), -depth / 2 - rng.uniform(0.5, 3.0), -0.3, rng.uniform(0, 6.3), rng.uniform(-0.3, 0.3)))
        bms.append(b)
    return join_bms(bms)


def chip(ob, rng, n=14, depth=(0.3, 1.4), front_bias=0.7, seg=0.7):
    """
    Fracture a fused mass: `n` planes each shear a layer `depth` m thick off the mass along a joint-set direction (steep
    joints, most toward the front; sheeting off the top; a few free), leaving flat fracture faces that run across the
    welded blocks — the facets granite breaks into, where the voxel weld alone leaves pillows. The cut faces are split
    to `seg` m so `weather` can work them.
    """
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for _ in range(n):
        kind = rng.random()
        if kind < 0.5:
            a = rng.uniform(-1.2, 1.2) if rng.random() < front_bias else rng.uniform(0, math.tau)
            d = Vector((math.sin(a), -math.cos(a), rng.uniform(-0.15, 0.25)))
        elif kind < 0.8:
            d = Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.8, 0.3), rng.uniform(0.7, 1.3)))
        else:
            d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.2, 0.8)))
        d.normalize()
        top = max(v.co.dot(d) for v in bm.verts)
        # an upward cut takes a thinner layer: repeated sheeting would plane the whole mass down
        s = top - rng.uniform(*depth) * (0.35 if d.z > 0.5 else 1.0)
        # a plane only shears where it bites into the side it faces: a cut near the base would undercut the module
        co = d * s
        if co.z < 0.8 and d.z < 0.3:
            co.z = max(co.z, 0.8)
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=d, clear_outer=True)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    _split_long_edges(bm, seg, rounds=6)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    return ob


def monolith(rng, height=26.0, width=20.0, depth=13.0):
    """the hero's body: one tall block with shoulders welded on each side and behind, for `fuse` → `chip` → `weather`"""
    bms = []
    b = convex_block(rng, width * 0.46, depth * 0.72, height, cuts=12, front_bias=0.75, sub=5, round_=0.08, lump=0.05, wobble=0.3)
    transform_bm(b, M(0, 0, -0.2, rng.uniform(-0.1, 0.1), -0.07))
    bms.append(b)
    b = convex_block(rng, width * 0.3, depth * 0.55, height * 0.8, cuts=9, front_bias=0.75, sub=4, round_=0.08, lump=0.05)
    transform_bm(b, M(width * 0.2 * rng.choice((-1, 1)), 1.2, -0.2, rng.uniform(-0.15, 0.15), -0.04))
    bms.append(b)
    for side in (-1, 1):
        for k in range(2):
            h = height * rng.uniform(0.3, 0.55) * (1 - 0.3 * k)
            w = width * rng.uniform(0.25, 0.35)
            b = convex_block(rng, w, depth * rng.uniform(0.6, 0.85), h, cuts=8, front_bias=0.7, sub=4, round_=0.12, lump=0.06)
            transform_bm(b, M(side * (width * 0.28 + k * w * 0.6), rng.uniform(0.0, 1.5) + k * 1.2, -0.2, rng.uniform(-0.25, 0.25), rng.uniform(-0.08, 0.04)))
            bms.append(b)
    b = convex_block(rng, width * 0.7, depth * 0.5, height * 0.55, cuts=6, sub=4)
    transform_bm(b, M(rng.uniform(-2, 2), depth * 0.4, -0.2))
    bms.append(b)
    for _ in range(6):                                        # the spall at the foot
        s = rng.uniform(1.2, 3.0)
        b = convex_block(rng, s * rng.uniform(1.0, 1.5), s, s * rng.uniform(0.6, 0.9), cuts=rng.randint(4, 7))
        transform_bm(b, M(rng.uniform(-width / 2.2, width / 2.2), -depth / 2 - rng.uniform(0.5, 3.0), -0.3, rng.uniform(0, 6.3), rng.uniform(-0.3, 0.3)))
        bms.append(b)
    return join_bms(bms)
