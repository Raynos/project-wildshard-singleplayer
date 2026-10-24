"""hi3d_refine.py — Hi3D v1.0 refinement of TRELLIS.2 / Hunyuan3D generations (HI3D-REFINE, E494).

  ~/projects/localai/bin/img2mesh/run-locked.sh <log> ~/ml/img2mesh/hi3d-mlx/.venv/bin/python -I \
    scripts/img2mesh/hi3d_refine.py [--res 1024] [--seed 0] <out dir> <gen.glb> <ref image> [<gen.glb> <ref image> …]

Runs in the MLX port's venv (cguldogan/mlx-vlm@hi3d, ~/ml/img2mesh/hi3d-mlx). The model loads once per batch. For each
pair it writes <out>/<stem>.hi3d<res>.obj and <stem>.hi3d<res>.json:
 1. the coarse mesh is the generation's textured GLB itself (Hi3D re-voxelizes at 64³ on its first pass, so the raw
    decoder mesh adds nothing), in the glTF frame (Y-up). The port puts the reference's side on +Z; a TRELLIS.2 GLB has
    it on −Z, so --turn (default 180) turns the coarse mesh about Y going in and back coming out. Without it the
    reference's detail is carved into the far side (stone-a's glyphs, 2026-10-24);
 2. the reference is cut out on its white background (the refs are one object on white) unless it carries alpha;
 3. Hi3D's output (centred, unit radius) is moved back onto the GLB: bounding-box centre and the mean extent ratio, so
    driftwood_post.py --geo can use it in place of the generated mesh's geometry;
 4. the JSON records the timings, the peak MLX memory and both meshes' health (loose parts, hole edges, non-manifold
    edges) plus how far the refined surface strays from the coarse one (the mean nearest distance / the bbox diagonal).
"""
import argparse
import json
import os
import time

import mlx.core as mx
import numpy as np
import trimesh
from PIL import Image

from mlx_vlm.models.hi3d import Model

MODEL = os.path.expanduser("~/projects/weights/manual/mlx-community/Hi3Dv1.0-mlx")

ap = argparse.ArgumentParser()
ap.add_argument("--res", type=int, default=1024, choices=(512, 1024, 1536))
ap.add_argument("--seed", type=int, default=0)
ap.add_argument("--turn", type=float, default=180.0, help="degrees about Y that bring the reference's side to +Z")
ap.add_argument("--model", default=MODEL)
ap.add_argument("out")
ap.add_argument("pairs", nargs="+", help="<gen.glb> <ref image> …")
a = ap.parse_args()
if len(a.pairs) % 2:
    ap.error("pairs come as <gen.glb> <ref image>")
os.makedirs(a.out, exist_ok=True)


def cutout(path):
    """The reference with alpha: its own, else everything that is not near-white."""
    im = Image.open(path)
    if im.mode == "RGBA" and np.asarray(im)[..., 3].min() < 255:
        return im
    rgb = np.asarray(im.convert("RGB"))
    alpha = ((255 - rgb.astype(np.int16)).max(axis=2) > 18).astype(np.uint8) * 255
    return Image.fromarray(np.dstack([rgb, alpha]))


def health(m):
    edges = np.sort(m.edges, axis=1)
    _, counts = np.unique(edges, axis=0, return_counts=True)
    return {"faces": int(len(m.faces)), "loose_parts": len(m.split(only_watertight=False)),
            "hole_edges": int((counts == 1).sum()), "nonmanifold_edges": int((counts > 2).sum())}


t0 = time.perf_counter()
model = Model.from_pretrained(a.model)
load_s = time.perf_counter() - t0
for glb, ref in zip(a.pairs[::2], a.pairs[1::2]):
    stem = os.path.basename(glb).removesuffix(".glb")
    coarse = trimesh.load(os.path.expanduser(glb), force="mesh")
    coarse.merge_vertices()
    turn = trimesh.transformations.rotation_matrix(np.radians(a.turn), [0, 1, 0])
    facing = coarse.copy()
    facing.apply_transform(turn)
    mx.reset_peak_memory()
    t1 = time.perf_counter()
    res = model(cutout(os.path.expanduser(ref)), np.asarray(facing.vertices, np.float32),
                np.asarray(facing.faces, np.int32), resolution=a.res, seed=a.seed)
    secs = time.perf_counter() - t1
    fine = trimesh.Trimesh(np.asarray(res.vertices), np.asarray(res.faces), process=False)
    fine.apply_transform(np.linalg.inv(turn))
    scale = float(np.mean(coarse.extents / fine.extents))
    fine.apply_scale(scale)
    fine.apply_translation(coarse.bounds.mean(0) - fine.bounds.mean(0))
    diag = float(np.linalg.norm(coarse.extents))
    pts = coarse.sample(20000, seed=a.seed)
    _, dist, _ = trimesh.proximity.closest_point(fine, pts)
    path = os.path.join(a.out, f"{stem}.hi3d{a.res}.obj")
    fine.export(path)
    rec = {"source": glb, "ref": ref, "res": a.res, "seed": a.seed, "turn": a.turn, "seconds": round(secs, 1),
           "load_seconds": round(load_s, 1), "timings": {k: round(v, 2) for k, v in res.timings.items()},
           "peak_memory_gb": round(mx.get_peak_memory() / 1e9, 2), "scale_back": round(scale, 5),
           "drift": round(float(dist.mean()) / diag, 5), "coarse": health(coarse), "refined": health(fine)}
    with open(path.removesuffix(".obj") + ".json", "w") as fh:
        json.dump(rec, fh, indent=1)
    print(json.dumps(rec), flush=True)
