"""Face remaster for Nalati's image-to-3D camp people (NALATI-FINISH B5 / E302, the user: "all the models have terrible
faces … remaster the faces with Blender or Trellis or … Hunyuan 3D").

Why the faces are bad: a whole-body generation spends texels by surface area, so the head gets ~5 % of the atlas, and the
game packs each figure into a 256² cell on the phone (src/nalati/campPeopleModels.ts): the face ends up ~15 texels wide.
Every variant here therefore re-UVs the figure with the HEAD PRIORITISED (xatlas on a copy whose head is scaled up
`--head-scale` times, so its charts get that squared share of the atlas) and re-bakes, and then:

    (no --graft / --paint)   the current head, only re-UV'd + re-baked
    --graft <bust.glb>       the head replaced by a generated head-and-shoulders bust (Hunyuan3D-2 or TRELLIS.2 from a
                             new front portrait): the body above the neck cut is deleted, the bust scaled so its
                             neck→top matches the body's, centred on the old head, clipped a little below its neck
                             (so it tucks into the collar), decimated to --head-tris; baked from both hi sources
    --paint <json>           a simple readable face in the procedural figures' style painted on the head: the face
                             smoothed to one skin tone, then eyes (white, iris, lid), brows, a nose shade and a mouth,
                             drawn in the head's front projection (position / normal maps baked from the low mesh)

    blender -b -P face_remaster.py -- --body body.glb --out out.glb --neck 0.77 [--tex 1024] [--head-scale 2.6]
        [--graft bust.glb --bust-neck 0.52 --bust-clip 0.03 --head-tris 1800] [--paint '{"eye":0.9,...}']
        [--front front.png]

--neck        the procedural figure's neck height / its height (campPeople.ts: elder 0.769, herders 0.8, child 0.765,
              cook 0.829); the cut is the narrowest cross-section near it, as the runtime rig finds it
--bust-neck   where the bust's neck is, as a fraction of the bust's height from its top (from the portrait)
--front       an unlit ortho render of the head from the front (for tuning the paint; not shipped)
Output: <out> (uncompressed GLB, one material, one --tex² atlas) + <out>.json. Metres, +Y up, feet on 0, facing +Z.
"""
import bpy, bmesh, sys, os, json, math, argparse
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--body", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--neck", type=float, required=True)
ap.add_argument("--tex", type=int, default=1024)
ap.add_argument("--head-scale", type=float, default=1.4)
ap.add_argument("--face-scale", type=float, default=5.0)
ap.add_argument("--face-top", type=float, default=0.6, help="the face's top (the hat brim), fraction of neck cut → head top")
ap.add_argument("--graft", default=None)
ap.add_argument("--bust-neck", type=float, default=0.5)
ap.add_argument("--bust-clip", type=float, default=0.03)
ap.add_argument("--bust-grow", type=float, default=1.0, help="extra scale on the bust (1 = neck-to-top matched)")
ap.add_argument("--bust-dz", type=float, default=0.0, help="nudge the bust up/down (fraction of the figure height)")
ap.add_argument("--bust-dy", type=float, default=0.0, help="nudge the bust forward (+) / back (fraction of height)")
ap.add_argument("--head-tris", type=int, default=4000)
ap.add_argument("--bust-beard", type=float, nargs=2, default=[0.0, 0.0], help="keep a front strip below the cut: half-width, depth (fractions of H)")
ap.add_argument("--no-weld", action="store_true")
ap.add_argument("--bust-image", default=None, help="the cutout the bust was generated from: projected on its front")
ap.add_argument("--paint", default=None)
ap.add_argument("--smooth-face", type=float, default=0.0, help="0..1: bend the face normals toward a head ellipsoid")
ap.add_argument("--front", default=None)
a = ap.parse_args(argv)


def log(*x):
    print("[face]", *x, flush=True)


def import_mesh(path, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in bpy.context.scene.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    mw = ob.matrix_world.copy()
    ob.parent = None
    ob.data.transform(mw)
    ob.matrix_world = Matrix.Identity(4)
    for o in new:
        if o != ob:
            bpy.data.objects.remove(o)
    ob.name = name
    # non-metallic sources (a Hunyuan GLB leaves metallicFactor unset = 1: the colour bake comes out black)
    for ms in ob.material_slots:
        m = ms.material
        if m and m.node_tree:
            for n in m.node_tree.nodes:
                if n.type == "BSDF_PRINCIPLED":
                    for l in list(n.inputs["Metallic"].links):
                        m.node_tree.links.remove(l)
                    n.inputs["Metallic"].default_value = 0.0
    return ob


def verts_np(ob):
    co = np.empty(len(ob.data.vertices) * 3, dtype=np.float64)
    ob.data.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def delete_faces(ob, pred):
    """delete the faces whose centroid satisfies pred(centroid: Vector) -> bool"""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    kill = [f for f in bm.faces if pred(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    return len(kill)


def ntris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def project_portrait(ob, path, neck_z):
    """lay the portrait the bust was generated from (its cutout: alpha = the subject) over the bust's front, orthographic
    along -Y: the generator rebuilt the subject in that image's frame, so its silhouette box = the alpha box. The generated
    paint keeps the sides and the back; the face comes from the portrait itself (the generator's own paint splits a face
    over several UV islands and leaves dark cracks at their seams)"""
    im = bpy.data.images.load(path)
    W_, H_ = im.size
    px_ = np.empty(W_ * H_ * 4, dtype=np.float32); im.pixels.foreach_get(px_)
    al = px_.reshape(H_, W_, 4)[..., 3]                                         # row 0 = the image's bottom
    ys, xs = np.where(al > 0.5)
    ax0, ax1, ay0, ay1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1        # in bottom-up rows
    Bv = verts_np(ob)
    x0, x1, z0, z1 = Bv[:, 0].min(), Bv[:, 0].max(), Bv[:, 2].min(), Bv[:, 2].max()
    # image column = a + x·k, row (bottom-up) = b + z·k: ONE scale (the generator keeps the aspect). A first guess from
    # the boxes (widths, tops), then fitted: the mesh's front silhouette against the alpha over the head (upper 60 %).
    # The box guess alone left the eyes a few rows off the geometry's sockets (a dark crease across the cook's eyes)
    k0 = (ax1 - ax0) / max(x1 - x0, 1e-6)
    step = int(np.ceil(max(W_, H_) / 256)); f_ = 1 / step
    am = al[::step, ::step] > 0.5
    hr, wr = am.shape
    top_rows = slice(int((ay1 - 0.6 * (ay1 - ay0)) * f_), hr)
    best_ = (-1.0, k0, ax0 - x0 * k0, ay0 - z0 * (ay1 - ay0) / max(z1 - z0, 1e-6))
    sz_box = (ay1 - ay0) / H_ / max(z1 - z0, 1e-6)
    for kk_ in ([] if os.environ.get("PORTRAIT_FIT", "0") != "1" else np.linspace(0.75, 1.15, 41) * k0):
        for da in np.linspace(-0.03, 0.03, 7) * W_:
            for db in np.linspace(-0.05, 0.05, 11) * H_:
                a_ = (ax0 + ax1) / 2 - (x0 + x1) / 2 * kk_ + da
                b_ = ay1 - z1 * kk_ + db
                cc = ((a_ + Bv[:, 0] * kk_) * f_).astype(int); rr = ((b_ + Bv[:, 2] * kk_) * f_).astype(int)
                ok = (cc >= 0) & (cc < wr) & (rr >= 0) & (rr < hr)
                mm = np.zeros((hr, wr), bool); mm[rr[ok], cc[ok]] = True
                mm = mm | np.roll(mm, 1, 0) | np.roll(mm, -1, 0) | np.roll(mm, 1, 1) | np.roll(mm, -1, 1)
                A_, M_ = am[top_rows], mm[top_rows]
                iou = (A_ & M_).sum() / max(1, (A_ | M_).sum())
                if iou > best_[0]:
                    best_ = (iou, kk_, a_, b_)
    iou, kf, af, bf = best_
    if iou >= 0:   # PORTRAIT_FIT=1 (off: the silhouette is mostly headwear, and the fit moved the eyes off the sockets)
        log(f"portrait fit: IoU {iou:.3f}, scale {kf / k0:.3f} of the box guess")
        sx = kf / W_; sz = kf / H_
        ax0, x0, ay0, z0 = af, 0.0, bf, 0.0
    else:          # the boxes: u = ax0/W + (x - x0)·sx ; v = ay0/H + (z - z0)·sz (the alpha box's bottom is the bust's)
        sx = k0 / W_; sz = sz_box
    hv = Bv[Bv[:, 2] > neck_z]                                                  # the head: above the neck
    hcen = (hv.max(0) + hv.min(0)) / 2; hrad = np.maximum((hv.max(0) - hv.min(0)) / 2, 1e-3)
    for ms in ob.material_slots:
        m = ms.material
        if not (m and m.node_tree):
            continue
        nt_ = m.node_tree
        bs = next((n for n in nt_.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bs is None or not bs.inputs["Base Color"].links:
            continue
        src = bs.inputs["Base Color"].links[0].from_socket
        tc = nt_.nodes.new("ShaderNodeTexCoord"); sep = nt_.nodes.new("ShaderNodeSeparateXYZ")
        nt_.links.new(tc.outputs["Object"], sep.inputs[0])
        def lin(sock, k, c):
            mm = nt_.nodes.new("ShaderNodeMath"); mm.operation = "MULTIPLY_ADD"
            nt_.links.new(sock, mm.inputs[0]); mm.inputs[1].default_value = k; mm.inputs[2].default_value = c
            return mm.outputs[0]
        u = lin(sep.outputs["X"], sx, ax0 / W_ - x0 * sx)
        v = lin(sep.outputs["Z"], sz, ay0 / H_ - z0 * sz)
        cmb = nt_.nodes.new("ShaderNodeCombineXYZ"); nt_.links.new(u, cmb.inputs[0]); nt_.links.new(v, cmb.inputs[1])
        ti = nt_.nodes.new("ShaderNodeTexImage"); ti.image = im; ti.extension = "CLIP"; ti.interpolation = "Cubic"
        nt_.links.new(cmb.outputs[0], ti.inputs["Vector"])
        # facing the camera, from the POSITION round the head's centre (an ellipsoid), not the surface normal: a dense
        # generated surface's normals are noise, and a normal test cut the face into a patchwork of portrait and paint
        sub = nt_.nodes.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"
        nt_.links.new(tc.outputs["Object"], sub.inputs[0]); sub.inputs[1].default_value = tuple(hcen)
        scl = nt_.nodes.new("ShaderNodeVectorMath"); scl.operation = "MULTIPLY"
        nt_.links.new(sub.outputs[0], scl.inputs[0]); scl.inputs[1].default_value = tuple(1 / r for r in hrad)
        nrmz = nt_.nodes.new("ShaderNodeVectorMath"); nrmz.operation = "NORMALIZE"
        nt_.links.new(scl.outputs[0], nrmz.inputs[0])
        sn = nt_.nodes.new("ShaderNodeSeparateXYZ"); nt_.links.new(nrmz.outputs[0], sn.inputs[0])
        mr = nt_.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = -0.2; mr.inputs["From Max"].default_value = -0.6
        nt_.links.new(sn.outputs["Y"], mr.inputs["Value"])
        fac = nt_.nodes.new("ShaderNodeMath"); fac.operation = "MULTIPLY"
        nt_.links.new(mr.outputs["Result"], fac.inputs[0]); nt_.links.new(ti.outputs["Alpha"], fac.inputs[1])
        mix = nt_.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
        nt_.links.new(fac.outputs[0], mix.inputs["Factor"])
        nt_.links.new(src, mix.inputs[6]); nt_.links.new(ti.outputs["Color"], mix.inputs[7])
        nt_.links.new(mix.outputs[2], bs.inputs["Base Color"])
    log(f"portrait {os.path.basename(path)} projected on the bust front (alpha box {ax1 - ax0}x{ay1 - ay0} px)")


bpy.ops.wm.read_factory_settings(use_empty=True)
body = import_mesh(a.body, "body")
V = verts_np(body)
zmin, zmax = V[:, 2].min(), V[:, 2].max()
H = zmax - zmin
# ── the neck cut: the narrowest torso cross-section near the procedural neck (the runtime rig's own search) ──
best, zc = 1e9, zmin + a.neck * H
for z in np.arange(zmin + (a.neck - 0.07) * H, zmin + (a.neck + 0.05) * H, 0.005 * H):
    band = V[(np.abs(V[:, 2] - z) < 0.006 * H) & (np.abs(V[:, 0]) < 0.14 * H)]
    if len(band) == 0:
        continue
    w = np.abs(band[:, 0]).max()
    if w < best:
        best, zc = w, z
head_sel = V[:, 2] > zc
hc = V[head_sel].mean(0)
log(f"body {os.path.basename(a.body)}: H {H:.3f} m, neck cut z {zc - zmin:.3f} ({(zc - zmin) / H:.3f} H), half-width {best:.3f}, "
    f"head centre x {hc[0]:.3f} y {hc[1]:.3f}, tris {ntris(body)}")

his = [body]
if a.graft:
    bust = import_mesh(a.graft, "bust")
    # weld: the generator splits its vertices along every UV seam, and bake rays slipped through those hairline cracks
    # to the back of the head (white scarf lines across the face)
    # (not a TRELLIS crust: welded, its flakes turn non-manifold and the collapse stalls at ~30 k triangles)
    if not a.no_weld:
        bm = bmesh.new(); bm.from_mesh(bust.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5 * max(bust.dimensions))
        bm.to_mesh(bust.data); bm.free(); bust.data.update()
    B = verts_np(bust)
    bt, bb = B[:, 2].max(), B[:, 2].min()
    bc = bt - a.bust_neck * (bt - bb)
    s = (zmax - zc) / max(1e-6, bt - bc) * a.bust_grow
    # centre: the bust's head (above its neck) on the old head, horizontally; its neck on the cut
    bh = B[B[:, 2] > bc]
    bcx, bcy = bh[:, 0].mean(), bh[:, 1].mean()
    M = Matrix.Translation((hc[0], hc[1] - a.bust_dy * H, zc + a.bust_dz * H)) @ Matrix.Scale(s, 4) @ Matrix.Translation((-bcx, -bcy, -bc))
    bust.data.transform(M); bust.data.update()
    if a.bust_image:
        project_portrait(bust, a.bust_image, zc)
    clip = zc - a.bust_clip * H
    bw, bd = a.bust_beard
    # a beard hangs over the chest: keep the bust's front strip down to bd below the cut (bw wide) so the new beard
    # covers the old one
    k = delete_faces(bust, lambda c: c.z < clip and not (bw > 0 and abs(c.x - hc[0]) < bw * H and c.z > zc - bd * H and c.y < hc[1] - 0.02 * H))
    log(f"bust {os.path.basename(a.graft)}: scale {s:.4f}, neck at {a.bust_neck:.2f} of its height, clipped {k} faces below {clip - zmin:.3f}")
    # the body keeps what is under the cut
    body_hi = body.copy(); body_hi.data = body.data.copy(); body_hi.name = "body_hi"
    bpy.context.collection.objects.link(body_hi)
    in_beard = lambda c: bw > 0 and abs(c.x - hc[0]) < bw * H * 0.9 and c.z > zc - bd * H * 0.9 and c.y < hc[1] - 0.03 * H
    k = delete_faces(body, lambda c: c.z > zc or in_beard(c))                  # the old beard goes with the old head
    log(f"body: {k} head faces removed")
    # low bust: decimated copy
    bust_lo = bust.copy(); bust_lo.data = bust.data.copy(); bust_lo.name = "bust_lo"
    bpy.context.collection.objects.link(bust_lo)
    if ntris(bust_lo) > a.head_tris:
        m = bust_lo.modifiers.new("dec", "DECIMATE"); m.decimate_type = "COLLAPSE"
        m.ratio = a.head_tris / ntris(bust_lo); m.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = bust_lo
        bpy.ops.object.modifier_apply(modifier="dec")
    # the collapse flips a few triangles (see-through holes in a face once three culls back faces): turn each low face
    # to agree with the dense bust's surface nearest to it
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(bust, dg)
    bm = bmesh.new(); bm.from_mesh(bust_lo.data)
    flip = []
    for f in bm.faces:
        hit = tree.find_nearest(f.calc_center_median())
        if hit[1] is not None and f.normal.dot(hit[1]) < -0.2:
            flip.append(f)
    bmesh.ops.reverse_faces(bm, faces=flip)
    # then against its neighbours: a face whose winding disagrees with its corners' (area-weighted) vertex normals is
    # still inside out — drawn double-sided, three lights it from behind: a dark line across the eyes (the cook)
    nmore = 0
    for _ in range(3):
        bm.normal_update()
        more = [f for f in bm.faces if f.normal.dot(sum((v.normal for v in f.verts), Vector())) < 0]
        if not more:
            break
        bmesh.ops.reverse_faces(bm, faces=more); nmore += len(more)
    flip += [None] * nmore
    bm.to_mesh(bust_lo.data); bm.free(); bust_lo.data.update()
    log(f"bust: {ntris(bust_lo)} tris after the collapse, {len(flip)} flipped faces turned back")
    # hi = the untouched body minus its head + the full bust; low = the body minus its head + the decimated bust
    delete_faces(body_hi, lambda c: c.z > zc or in_beard(c))
    his = [body_hi, bust]
    for o in bpy.context.scene.objects:
        o.select_set(o in (body, bust_lo))
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    low = body
else:
    low = body.copy(); low.data = body.data.copy(); low.name = "low"
    bpy.context.collection.objects.link(low)
low.name = "low"

# ── fresh UVs, head first ──
sys.path.append(os.path.expanduser(os.environ.get("XATLAS_PY", "~/ml/img2mesh/blender-py")))
import xatlas  # noqa: E402
bm = bmesh.new(); bm.from_mesh(low.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5 * H)
bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(low.data); bm.free()
while low.data.uv_layers:
    low.data.uv_layers.remove(low.data.uv_layers[0])
low.data.uv_layers.new(name="UVMap")
LV = verts_np(low).astype(np.float32)
F = np.array([p.vertices[:] for p in low.data.polygons], dtype=np.uint32)
t = np.clip((LV[:, 2] - (zc - 0.04 * H)) / (0.05 * H), 0, 1)
t = t * t * (3 - 2 * t)
# the face (the head's front, below the hat) gets --face-scale, the rest of the head --head-scale — a smooth field, so the
# charts that cross it only stretch (a little more texel there), never tear
LN = np.empty(len(low.data.vertices) * 3, dtype=np.float32); low.data.vertices.foreach_get("normal", LN); LN = LN.reshape(-1, 3)
ftop = zc + a.face_top * (zmax - zc)
fr = np.clip((-LN[:, 1] - 0.15) / 0.5, 0, 1) * np.clip((ftop - LV[:, 2]) / (0.08 * (zmax - zc)), 0, 1)
kk = 1 + t * ((a.head_scale - 1) + (a.face_scale - a.head_scale) * fr)
piv = np.array([hc[0], hc[1], zc + 0.4 * (zmax - zc)], dtype=np.float32)
LVs = piv + (LV - piv) * kk[:, None]
atlas = xatlas.Atlas(); atlas.add_mesh(LVs, F)
po = xatlas.PackOptions(); po.resolution = a.tex; po.padding = 8; po.bilinear = True; po.bruteForce = True
co_ = xatlas.ChartOptions()
co_.max_cost = float(os.environ.get("XATLAS_COST", "8")); co_.normal_seam_weight = 1.0   # fewer, bigger charts: a face in one piece
atlas.generate(co_, po)
vmap, idx, uvs = atlas[0]
# the face as ONE planar chart (front projection): xatlas still cut it into 2–4 charts, and on the phone's 256-px cell
# with its mipmaps every cut through the face read as a dark line (the cook's "glasses")
FF = F.astype(np.int64)
c3 = LV[FF].mean(1)
nf = np.cross(LV[FF[:, 1]] - LV[FF[:, 0]], LV[FF[:, 2]] - LV[FF[:, 0]])
nf /= np.maximum(np.linalg.norm(nf, axis=1, keepdims=True), 1e-12)
face_tri = (c3[:, 2] > zc + 0.01 * H) & (c3[:, 2] < ftop) & (nf[:, 1] < -0.3) & (c3[:, 1] < hc[1])
if face_tri.sum() > 8 and os.environ.get("FACE_CHART", "1") == "1":
    keys, P2, U2 = {}, [], []
    F2 = np.zeros_like(FF)
    for t in range(len(FF)):
        for k in range(3):
            if face_tri[t]:
                ov = int(FF[t, k]); uv = (10.0 + float(LV[ov, 0]), float(LV[ov, 2])); key = (ov, "f")
                pos_ = LVs[ov]
            else:
                av = int(idx[t][k]); ov = int(vmap[av]); uv = (float(uvs[av][0]), float(uvs[av][1])); key = (ov, av)
                pos_ = LVs[ov]
            j = keys.get(key)
            if j is None:
                j = keys[key] = len(P2); P2.append(pos_); U2.append(uv)
            F2[t, k] = j
    at2 = xatlas.Atlas()
    at2.add_mesh(np.array(P2, np.float32), F2.astype(np.uint32), None, np.array(U2, np.float32))
    co2 = xatlas.ChartOptions(); co2.use_input_mesh_uvs = True
    at2.generate(co2, po)
    _, idx, uvs = at2[0]
    log(f"face chart: {int(face_tri.sum())} triangles in one front projection, {at2.chart_count} charts")
uvl = low.data.uv_layers["UVMap"]
for p, tri in zip(low.data.polygons, idx):
    for li, q in zip(p.loop_indices, tri):
        uvl.data[li].uv = uvs[q]
# how much of the atlas the head got (uv area share of the faces above the cut)
def uv_area(sel):
    s = 0.0
    for p, tri in zip(low.data.polygons, idx):
        if sel(p):
            u = uvs[tri]
            s += abs((u[1][0] - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (u[1][1] - u[0][1])) / 2
    return s
ha, ta = uv_area(lambda p: p.center.z > zc), uv_area(lambda p: True)
fa = uv_area(lambda p: zc < p.center.z < ftop and p.normal.y < -0.5)
log(f"xatlas: {atlas.chart_count} charts, head {ha / max(ta, 1e-9):.2f} / face {fa / max(ta, 1e-9):.2f} of the charts (x{a.head_scale} / x{a.face_scale})")

# ── bake the base colour hi → low ── (low smooth-shaded first: the cage is extruded along its normals, and flat
# faces tore the cage at every edge — the rays there hit the scarf behind the cheek: light lines along the edges)
for poly in low.data.polygons:
    poly.use_smooth = True
img = bpy.data.images.new("atlas", a.tex, a.tex, alpha=False)
mat = bpy.data.materials.new("atlas"); mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes.get("Principled BSDF")
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.85; bsdf.inputs["Metallic"].default_value = 0.0
low.data.materials.clear(); low.data.materials.append(mat)
nt.nodes.active = tex
sc = bpy.context.scene
sc.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = "GPU"
except Exception:
    pass
sc.cycles.samples = 4
for o in sc.objects:
    o.select_set(o in his or o == low)
bpy.context.view_layer.objects.active = low
ext = float(os.environ.get("BAKE_EXT", "0.012")) * H
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_selected_to_active=True, cage_extrusion=ext,
                    max_ray_distance=ext * 4, margin=3, margin_type="EXTEND")   # margin < padding / 2: no chart's margin runs into its neighbour
for o in his:
    bpy.data.objects.remove(o)


def raster_maps(zlo):
    """the low mesh's position + face normal per texel (uv-rasterised, faces above zlo only) → two (tex, tex, 3) arrays,
    row 0 = v 0 (Blender's pixel order); texels off those faces stay far away (pos 1e3) so no paint lands there"""
    T = a.tex
    pos = np.full((T, T, 3), 1e3, np.float32); nrm = np.zeros((T, T, 3), np.float32)
    uvd = low.data.uv_layers["UVMap"].data
    vco = low.data.vertices
    cov = np.zeros((T, T), bool)
    for poly in low.data.polygons:
        head = poly.center.z >= zlo
        li = list(poly.loop_indices)
        uv = np.array([uvd[k].uv[:] for k in li], np.float64) * T - 0.5
        P3 = np.array([vco[low.data.loops[k].vertex_index].co[:] for k in li], np.float64)
        for t in range(1, len(li) - 1):
            U = uv[[0, t, t + 1]]; Q = P3[[0, t, t + 1]]
            x0, y0 = np.floor(U.min(0)).astype(int); x1, y1 = np.ceil(U.max(0)).astype(int)
            x0, y0 = max(x0 - 1, 0), max(y0 - 1, 0); x1, y1 = min(x1 + 1, T - 1), min(y1 + 1, T - 1)
            gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
            d = (U[1, 1] - U[2, 1]) * (U[0, 0] - U[2, 0]) + (U[2, 0] - U[1, 0]) * (U[0, 1] - U[2, 1])
            if abs(d) < 1e-12:
                continue
            l0 = ((U[1, 1] - U[2, 1]) * (gx - U[2, 0]) + (U[2, 0] - U[1, 0]) * (gy - U[2, 1])) / d
            l1 = ((U[2, 1] - U[0, 1]) * (gx - U[2, 0]) + (U[0, 0] - U[2, 0]) * (gy - U[2, 1])) / d
            l2 = 1 - l0 - l1
            e_ = -0.6 / max(1.0, np.abs(U.max(0) - U.min(0)).max())               # a little over the edge: no seams
            ins = (l0 >= e_) & (l1 >= e_) & (l2 >= e_)
            if not ins.any():
                continue
            w = np.stack([l0[ins], l1[ins], l2[ins]], -1)
            cov[gy[ins], gx[ins]] = True
            if head:
                pos[gy[ins], gx[ins]] = w @ Q
                nrm[gy[ins], gx[ins]] = poly.normal[:]
    return pos, nrm, cov


if a.paint:
    P = json.loads(a.paint)
    pos, nrm, _ = raster_maps(zc - 0.06 * H)
    px = np.empty(a.tex * a.tex * 4, dtype=np.float32); img.pixels.foreach_get(px)
    col = px.reshape(a.tex, a.tex, 4)
    rgb = col[..., :3]
    # the face frame: front = -Y (glTF +Z); x across (the figure's LEFT is +x); z up. Units: eye spacing e (m)
    # the spec is in the --front render's pixels (768², ortho): "eyes": [x left, x right, y] and optional rows
    # "brow_y", "nose_y", "mouth_y", "keep_y" (the beard / scarf below stay as generated), "face_y" (the oval's centre)
    fscale = (zmax - zc) * 1.5; mpp = fscale / 768; fmid = zc + (zmax - zc) * 0.45
    zpx = lambda py: fmid + (384 - py) * mpp
    xl, xr, ey = P["eyes"]
    e = (xr - xl) * mpp
    cx = hc[0] + ((xl + xr) / 2 - 384) * mpp
    ez = zpx(ey)
    vpx = lambda py: (zpx(py) - ez) / e
    for k in ("brow", "nose", "mouth", "keep", "face"):
        if f"{k}_y" in P:
            P[{"keep": "keep_below", "face": "face_cv"}.get(k, f"{k}_v")] = vpx(P[f"{k}_y"])
    u = (pos[..., 0] - cx) / e
    v = (pos[..., 2] - ez) / e
    front = np.clip((-nrm[..., 1] - 0.15) / 0.45, 0, 1)                          # facing the camera
    ahead = pos[..., 1] < (hc[1] + P.get("dy", 0.0) * e)                        # the front half of the head
    fw = front * ahead * (pos[..., 2] > zc - 0.02 * H)
    log(f"paint maps: pos x {pos[..., 0].min():.2f}..{pos[..., 0].max():.2f} z {pos[..., 2].min():.2f}..{pos[..., 2].max():.2f}, "
        f"-ny>0.5 on {(nrm[..., 1] < -0.5).mean():.3f}, front-facing head texels {(fw > 0.5).sum()}")

    def ell(cu, cv, ru, rv, soft=0.35):
        d = np.sqrt(((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2)
        return np.clip((1 - d) / soft, 0, 1)

    def put(mask, c, alpha=1.0):
        m = (mask * fw * alpha)[..., None]
        rgb[...] = rgb * (1 - m) + np.array(c, dtype=np.float32)[None, None, :] * m

    # 1. one skin tone over the face oval (the generated face is mottled: blotches read as dirt at 3 m) — only on
    #    skin-coloured texels (not the beard, the scarf, the hat brim), below the brim (top_y) and above keep_y
    fu, fv = P.get("face", [1.25, 1.55])
    oval = ell(0, P.get("face_cv", -0.35), fu, fv, soft=0.5)
    r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = (r_ + g_ + b_) / 3
    skin0 = np.clip(((r_ - b_) - 0.08) / 0.1, 0, 1) * (r_ >= g_) * (lum > 0.2) * (lum < 0.92)
    # the middle of the face: the dark streaks and blotches go too (only white — a beard, a scarf — stays)
    inner = ell(0, P.get("face_cv", -0.35), fu * 0.72, fv * 0.72, soft=0.3) * (lum < 0.8)
    skinlike = np.maximum(skin0, inner * P.get("blemish", 1.0))
    inface = oval * (v > P.get("keep_below", -99.0)) * (v < (vpx(P["top_y"]) if "top_y" in P else 99.0))
    sel = (inface > 0.6) & (fw > 0.6) & (skin0 > 0.5)
    skin = np.array(P["skin"], np.float32) if "skin" in P else (np.median(rgb[sel], axis=0) if sel.sum() > 20 else np.array([0.72, 0.5, 0.38], np.float32))
    ml = lum[sel].mean() if sel.sum() > 20 else 0.5
    shade = (0.5 + 0.5 * np.clip(lum / max(ml, 1e-3), 0.85, 1.12))[..., None]
    m = (inface * fw * skinlike * P.get("smooth", 0.85))[..., None]
    rgb[...] = rgb * (1 - m) + (skin[None, None, :] * shade) * m
    dark = np.array(P.get("line", [0.12, 0.07, 0.05]), np.float32)
    # 2. cheeks: a warm flush
    for s in (-1, 1):
        put(ell(s * 0.62, -0.62, 0.34, 0.22, soft=1.0), P.get("cheek", [0.78, 0.42, 0.36]), P.get("cheek_a", 0.35))
    # 3. eyes: white, iris, pupil, upper lid (the procedural figures' black eyes, grown into something that reads)
    er = P.get("eye_r", [0.22, 0.12])
    for s in (-1, 1):
        put(ell(s * 0.5, 0, er[0], er[1], 0.25), P.get("white", [0.93, 0.9, 0.84]))
        put(ell(s * 0.5, -0.005, er[1] * 1.0, er[1] * 1.0, 0.25), P.get("iris", [0.2, 0.12, 0.07]))
        put(ell(s * 0.5, -0.005, er[1] * 0.45, er[1] * 0.45, 0.3), [0.03, 0.02, 0.02])
        put(ell(s * 0.5, er[1] * 0.75, er[0] * 1.08, er[1] * 0.38, 0.4), dark)
        # 4. brows
        bc = P.get("brow", [0.14, 0.09, 0.06])
        put(ell(s * 0.52, P.get("brow_v", 0.36), 0.3, P.get("brow_t", 0.075), 0.4), bc)
    # 5. nose: a shade under it and on its side
    put(ell(0, P.get("nose_v", -0.62), 0.2, 0.08, 0.8), [x * 0.72 for x in skin.tolist()], 0.8)
    put(ell(0.1, P.get("nose_v", -0.62) + 0.3, 0.07, 0.28, 0.9), [x * 0.85 for x in skin.tolist()], 0.6)
    # 6. mouth
    if P.get("mouth", True):
        put(ell(0, P.get("mouth_v", -1.02), P.get("mouth_w", 0.34), 0.055, 0.45), P.get("lip", [0.45, 0.16, 0.13]))
    if P.get("moustache"):
        mv = P.get("mouth_v", -1.02) + 0.13
        put(ell(0, mv, P.get("moustache_w", 0.5), 0.06, 0.4), P.get("moustache_c", [0.1, 0.07, 0.05]))
        for s in (-1, 1):                                                        # the ends droop
            put(ell(s * P.get("moustache_w", 0.5) * 0.85, mv - 0.08, 0.1, 0.1, 0.5), P.get("moustache_c", [0.1, 0.07, 0.05]))
    col[..., :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(col.ravel())
    log(f"painted face: eye z {ez - zmin:.3f}, spacing {e:.3f} m, skin {np.round(skin, 2).tolist()}")

# ── fill every texel off the charts (push-pull): the black gutters bled into the faces as dark seams once the phone's
#    256² cell and its mipmaps averaged across them ──
_, _, cov = raster_maps(1e9)
for _ in range(3):   # keep the bake's own EXTEND margin round every chart (bilinear reads half a texel past the edge)
    cov = cov | np.roll(cov, 1, 0) | np.roll(cov, -1, 0) | np.roll(cov, 1, 1) | np.roll(cov, -1, 1)
px = np.empty(a.tex * a.tex * 4, dtype=np.float32); img.pixels.foreach_get(px)
col = px.reshape(a.tex, a.tex, 4)


def push_pull(c, m):
    if c.shape[0] <= 1:
        return c
    w = m.astype(np.float32)
    h2 = c.shape[0] // 2
    cw = (c * w[..., None]).reshape(h2, 2, h2, 2, 3).sum((1, 3))
    ww = w.reshape(h2, 2, h2, 2).sum((1, 3))
    small = np.where(ww[..., None] > 0, cw / np.maximum(ww[..., None], 1e-6), 0)
    small = push_pull(small, ww > 0)
    up = small.repeat(2, 0).repeat(2, 1)
    return np.where(m[..., None], c, up)


if os.environ.get("NO_FILL") != "1":
    col[..., :3] = push_pull(col[..., :3].copy(), cov)
img.pixels.foreach_set(col.ravel())
log(f"gutters filled: {(~cov).mean():.2f} of the atlas was off the charts")
img.file_format = "PNG"
img.pack()
# smooth shading, hard only past 50° (the join + weld dropped the imported normals: a grafted head came out faceted, every
# decimated triangle its own flat patch under the cel bands — rings round the eyes, shards in a beard)
for o in bpy.context.scene.objects:
    o.select_set(o == low)
bpy.context.view_layer.objects.active = low
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(50))
for md in list(low.modifiers):
    try:
        bpy.ops.object.modifier_apply(modifier=md.name)
    except Exception:
        pass
if a.smooth_face > 0:
    # the generated face is a few hundred lumpy facets: under the painterly cel bands a dent reads as a dark blob (the
    # cook's cheek, the child's nose). Bend the face's normals toward an ellipsoid round the head — the procedural
    # figures' smooth sphere head, lit as one surface — keeping the silhouette
    Vn = verts_np(low)
    Nn = np.empty(len(low.data.vertices) * 3, dtype=np.float64); low.data.vertices.foreach_get("normal", Nn); Nn = Nn.reshape(-1, 3)
    band = (Vn[:, 2] > zc) & (Vn[:, 2] < ftop)
    c = Vn[band].mean(0); r = np.maximum((Vn[band].max(0) - Vn[band].min(0)) / 2, 1e-3)
    ne = (Vn - c) / (r * r); ne /= np.maximum(np.linalg.norm(ne, axis=1, keepdims=True), 1e-9)
    tt = np.clip((Vn[:, 2] - zc) / (0.03 * H), 0, 1) * np.clip((ftop - Vn[:, 2]) / (0.05 * H), 0, 1)
    wf = tt * np.clip((-Nn[:, 1] + 0.2) / 0.5, 0, 1) * a.smooth_face
    nn = Nn * (1 - wf[:, None]) + ne * wf[:, None]
    nn /= np.maximum(np.linalg.norm(nn, axis=1, keepdims=True), 1e-9)
    for poly in low.data.polygons:
        poly.use_smooth = True
    low.data.normals_split_custom_set_from_vertices([tuple(x) for x in nn])
    log(f"face normals smoothed toward the head ellipsoid on {(wf > 0.05).sum()} verts")
low.data.name = low.name = os.path.splitext(os.path.basename(a.out))[0]
for o in bpy.context.scene.objects:
    o.select_set(o == low)
bpy.context.view_layer.objects.active = low
# the neck cut rides along as a node extra (glTF extras.neckCut, fraction of the height): the game's rig pivots the head
# there (campPeopleModels.ts). Its own search — the narrowest cross-section near the procedural neck — found a new
# head's face narrower than the neck and bent the face across the eyes whenever the head turned (a crease under the brows)
low["neckCut"] = round(float((zc - zmin) / H), 4)
bpy.ops.export_scene.gltf(filepath=a.out, export_format="GLB", use_selection=True, export_image_format="AUTO",
                          export_yup=True, export_apply=True, export_extras=True)
json.dump({"tris": ntris(low), "verts": len(low.data.vertices), "neck_cut": round(float((zc - zmin) / H), 4),
           "head_share": round(float(ha / max(ta, 1e-9)), 3), "height": round(float(H), 3)}, open(a.out + ".json", "w"), indent=1)
log(f"{a.out}: {ntris(low)} tris, {len(low.data.vertices)} verts")

if a.front:
    # an unlit ortho render of the head from the front, with a z grid every 1 % of H (for tuning the paint)
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x = sc.render.resolution_y = 768
    world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1)
    em = nt.nodes.new("ShaderNodeEmission"); nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    sc.view_settings.view_transform = "Standard"
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"; cam.data.ortho_scale = (zmax - zc) * 1.5
    sc.collection.objects.link(cam); sc.camera = cam
    mid = zc + (zmax - zc) * 0.45
    cam.location = (hc[0], hc[1] - 3, mid); cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.render.filepath = a.front
    bpy.ops.render.render(write_still=True)
    json.dump({"z_bottom": float((mid - cam.data.ortho_scale / 2 - zmin) / H), "z_top": float((mid + cam.data.ortho_scale / 2 - zmin) / H),
               "x0": float(hc[0] - cam.data.ortho_scale / 2), "scale": float(cam.data.ortho_scale), "H": float(H)},
              open(a.front + ".json", "w"), indent=1)
    log(f"front render {a.front}: rows span z {(mid - cam.data.ortho_scale / 2 - zmin) / H:.3f}..{(mid + cam.data.ortho_scale / 2 - zmin) / H:.3f} H")
