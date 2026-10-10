"""Sky Reach's Storm Roc mesh repair (E392 / E399 council round 13, finding 1: 'a stray beaked lump sits in the tail').

Hunyuan3D-2 grew a second, loose head (113 vertices) inside the eagle's tail fan, and left a few open edges. This post
welds the UV-split vertices, deletes every loose piece smaller than MIN_PART of the model, fills the open boundary loops,
and exports the GLB with its painted map (texture compression and meshopt are the target's post step).

  blender -b --factory-startup -noaudio --python-exit-code 1 -P repair.py -- <in.glb> <out.glb>
  blender -b --factory-startup -noaudio --python-exit-code 1 -P repair.py -- --check <model.glb>   (fails on a loose piece or an open edge)

The source is the eagle Hunyuan3D-2 made from art/far-reach/round-27-roc/refs/ref-eagle.jpg, after finish.sh (12k tris,
1024 map): ~/ml/img2mesh/work/roc-eagle/roc-eagle.raw.glb. The sky that showed through its legs and tail in flight was
the rig's, not the mesh's: src/shards/far-reach/species/stormRoc.ts now binds the wings with blended weights.
"""
import sys
import bpy
import bmesh

MIN_PART = 0.05  # a loose piece under 5 % of the model's vertices is generator debris
WELD = 1e-4      # metres per metre of the model's largest side
SLIT = 4e-3      # the wider weld for an open slit's vertices
# meshopt's quantisation reopens one sub-millimetre sliver (2 edges) in the shipped GLB; the repaired export has 0
MAX_OPEN = 4


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if len(meshes) != 1:
        raise SystemExit(f'expected one mesh in {path}, found {len(meshes)}')
    return meshes[0]


def parts(bm):
    seen, out = set(), []
    for v in bm.verts:
        if v in seen:
            continue
        stack, comp = [v], []
        seen.add(v)
        while stack:
            x = stack.pop()
            comp.append(x)
            for e in x.link_edges:
                o = e.other_vert(x)
                if o not in seen:
                    seen.add(o)
                    stack.append(o)
        out.append(comp)
    return sorted(out, key=len, reverse=True)


def survey(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD * max(ob.dimensions))
    p = parts(bm)
    small = [len(c) for c in p if len(c) < MIN_PART * len(bm.verts)]
    boundary = sum(1 for e in bm.edges if e.is_boundary)
    bm.free()
    return len(p), small, boundary


def repair(ob):
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD * max(ob.dimensions))
    total = len(bm.verts)
    dropped = 0
    for comp in parts(bm):
        if len(comp) < MIN_PART * total:
            dropped += len(comp)
            bmesh.ops.delete(bm, geom=comp, context='VERTS')
    edges = [e for e in bm.edges if e.is_boundary]
    filled = bmesh.ops.holes_fill(bm, edges=edges, sides=64)['faces'] if edges else []
    # a filled hole takes the mean UV of a neighbouring face, so it shows the feathers around it, not the atlas's gaps
    uv = bm.loops.layers.uv.active
    if uv is not None:
        done = set(filled)
        for f in filled:
            near = next((n for e in f.edges for n in e.link_faces if n not in done), None)
            if near is None:
                continue
            u = sum(l[uv].uv.x for l in near.loops) / len(near.loops)
            v = sum(l[uv].uv.y for l in near.loops) / len(near.loops)
            for l in f.loops:
                l[uv].uv = (u, v)
    if filled:
        bmesh.ops.triangulate(bm, faces=filled)
    # a slit too thin to fill (two open edges meeting at a sliver): close it by welding its vertices a little wider
    slit = list({v for e in bm.edges if e.is_boundary for v in e.verts})
    if slit:
        bmesh.ops.remove_doubles(bm, verts=slit, dist=SLIT * max(ob.dimensions))
    bm.to_mesh(me)
    bm.free()
    me.update()
    print(f'[roc-repair] dropped {dropped} loose vertices, filled {len(filled)} holes ({len(edges)} open edges)')


def texels(img, faces, uv):
    """The texels (a boolean H x W mask) under `faces`' UV triangles, grown by 2 px for the bilinear border."""
    import numpy as np
    w, h = img.size
    mask = np.zeros((h, w), dtype=bool)
    for f in faces:
        pts = [(l[uv].uv.x * w, l[uv].uv.y * h) for l in f.loops]
        for i in range(1, len(pts) - 1):
            (ax, ay), (bx, by), (cx, cy) = pts[0], pts[i], pts[i + 1]
            x0, x1 = int(max(0, min(ax, bx, cx) - 2)), int(min(w - 1, max(ax, bx, cx) + 2))
            y0, y1 = int(max(0, min(ay, by, cy) - 2)), int(min(h - 1, max(ay, by, cy) + 2))
            if x1 < x0 or y1 < y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-9:
                continue
            l1 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / d
            l2 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / d
            l3 = 1 - l1 - l2
            pad = 2.5 / max(1.0, min(abs(d) ** 0.5, 64))
            mask[y0:y1 + 1, x0:x1 + 1] |= (l1 > -pad) & (l2 > -pad) & (l3 > -pad)
    return mask


def repaint(ob):
    """Round 13 (seat B: 'a stray beaked lump in the tail'): Hunyuan's paint copied the reference's talons, which hang in
    front of the tail fan, onto the fan's underside as two black-and-yellow claw shapes; seen from below they read as a
    second beaked head. Paint them out with the fan's own feather colour. The real toes and the beak get gold (mockup D:
    'gold curled talons', a gold beak; the paint's dull ochre read white in the game's light)."""
    import numpy as np
    me = ob.data
    mat = me.materials[0]
    img = next(n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image is not None)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    M = ob.matrix_world
    # the model's own frame: up (glTF +Y = Blender +Z) from the tail fan's tip, forward (glTF +Z = Blender -Y) from its back
    co = {v: M @ v.co for v in bm.verts}
    ups = [c.z for c in co.values()]
    fwds = [-c.y for c in co.values()]
    up0, fwd0 = min(ups), min(fwds)
    k = 16.0 / max(ob.dimensions)  # metres of the 16 m in-game eagle per model unit

    def where(f):
        c = sum((co[v] for v in f.verts), co[f.verts[0]] * 0) / len(f.verts)
        return abs(c.x) * k, (c.z - up0) * k, (-c.y - fwd0) * k

    fan, feet, beak = [], [], []
    for f in bm.faces:
        ax, up, fwd = where(f)
        if ax < 0.8 and 6.0 < up < 8.2 and fwd > 5.8:
            beak.append(f)
        # (measured on the source: the painted claws sit on the fan's front face low down, up < 2 m, fwd 2.5-4.5 m;
        # the real feet hang 3-4 m up, 6-7.4 m forward, their toes already yellow, their claws dark)
        if ax < 1.8 and up < 2.2 and 2.4 < fwd < 4.8:
            fan.append(f)
        elif ax < 1.6 and 2.6 < up < 4.4 and fwd > 5.5:
            feet.append(f)
    lum = 0.2126 * px[..., 0] + 0.7152 * px[..., 1] + 0.0722 * px[..., 2]
    sat = px[..., :3].max(-1) - px[..., :3].min(-1)
    m_fan = texels(img, fan, uv)
    # (the fan's underside is pale tan: anything darker than a third of white there is a claw mark or its shadow)
    mark = m_fan & ((lum < 0.3) | ((sat > 0.28) & (px[..., 0] > px[..., 2] + 0.25)))
    # grow the marks a little so their soft edges go too
    grown = mark.copy()
    for dy in (-2, -1, 0, 1, 2):
        for dx in (-2, -1, 0, 1, 2):
            grown |= np.roll(np.roll(mark, dy, 0), dx, 1)
    grown &= m_fan
    keep = m_fan & ~grown
    feather = np.median(px[keep][:, :3], axis=0) if keep.any() else np.array([0.55, 0.5, 0.45])
    px[grown, :3] = feather
    m_feet = texels(img, feet, uv)
    # the toes: their dull yellow pushed to gold (the trousers' white and the claws' black stay)
    pale = m_feet & (sat > 0.12) & (px[..., 0] > px[..., 2] + 0.1) & (lum > 0.2)
    gold = np.array([0.92, 0.66, 0.16], dtype=np.float32)
    px[pale, :3] = px[pale, :3] * 0.25 + gold * 0.75
    # the hooked beak likewise: in the game's warm low sun its dull ochre read as white (round 13: 'no beak shows')
    m_beak = texels(img, beak, uv)
    ochre = m_beak & (sat > 0.12) & (px[..., 0] > px[..., 2] + 0.1) & (lum > 0.2)
    px[ochre, :3] = px[ochre, :3] * 0.25 + gold * 0.75
    img.pixels[:] = px.ravel()
    img.update()
    img.pack()
    bm.free()
    print(f'[roc-repair] repainted {int(grown.sum())} claw-mark texels on the tail ({len(fan)} faces), {int(pale.sum())} toe texels '
          f'({len(feet)} faces) and {int(ochre.sum())} beak texels ({len(beak)} faces) pushed to gold')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    if argv[0] == '--check':
        n, small, boundary = survey(load(argv[1]))
        print(f'[roc-repair] check {argv[1]}: {n} pieces, small {small}, open edges {boundary}')
        if small or boundary > MAX_OPEN:
            raise SystemExit('the Roc has a loose piece or an open edge: run repair.py')
        return
    src, out = argv[0], argv[1]
    ob = load(src)
    print('[roc-repair] before (pieces, small, open edges)', survey(ob))
    repair(ob)
    repaint(ob)
    print('[roc-repair] after (pieces, small, open edges)', survey(ob))
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='AUTO', export_yup=True,
                              export_apply=True, export_animations=False, export_skins=False, export_morph=False)


main()
