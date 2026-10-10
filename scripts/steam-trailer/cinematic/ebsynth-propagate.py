#!/usr/bin/env python3
"""ebsynth-propagate.py — propagate styled keyframes across a frame sequence with jamriska/ebsynth (TRAILERS CT1 #5/#6).

Every in-between frame f (k0 < f < k1) is synthesised twice, from the styled key k0 and from k1, each with the guide
pairs (guide/k → guide/f); the two are cross-faded by distance (the classic EbSynth two-key blend). Keys are copied.

  ebsynth-propagate.py --keys <dir of styled %04d.png> --key-frames "1 11 21 ..." --n 145 --out <dir> \
      --guide <dir>:<weight> [--guide <dir>:<weight> ...] [--edges <rgb dir>:<weight>] [--jobs 4] \
      [--ebsynth ~/ml/video/ebsynth/bin/ebsynth] [--uniformity 3500] [--patchsize 5] [--fast]

--guide   a folder of %04d.png guide frames (grey render, depth, normals, the source RGB...) and its weight
--edges   build a blurred Sobel edge guide from that RGB folder (cached in <out>/_edges) and add it with that weight
Writes <out>/%04d.png plus <out>/_fwd, <out>/_bwd (the one-sided passes) and <out>/timing.json.
"""
import argparse, json, os, subprocess, time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument("--keys", required=True)
ap.add_argument("--key-frames", required=True)
ap.add_argument("--n", type=int, required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--guide", action="append", default=[])
ap.add_argument("--edges", default="")
ap.add_argument("--jobs", type=int, default=4, help="concurrent ebsynth processes, each under nice 10; keep <= 4 on "
                "the shared Mac (MACHINE.md): 14 drove the load to 108 and timed out the push gate")
a_jobs_cap = 4
ap.add_argument("--ebsynth", default=os.path.expanduser("~/ml/video/ebsynth/bin/ebsynth"))
ap.add_argument("--uniformity", type=float, default=3500)
ap.add_argument("--patchsize", type=int, default=5)
ap.add_argument("--fast", action="store_true", help="-searchvoteiters 6 -patchmatchiters 3 (about half the time per run)")
a = ap.parse_args()
a.jobs = max(1, min(a.jobs, a_jobs_cap))

keys = sorted(int(k) for k in a.key_frames.split())
# keys need not start at 1 / end at n: only keys[0]..keys[-1] is written, so a sequence can be done in parts
assert len(keys) >= 2 and 1 <= keys[0] and keys[-1] <= a.n, "need two keys inside 1..n"
os.makedirs(a.out, exist_ok=True)
fn = lambda d, f: os.path.join(d, f"{f:04d}.png")
guides = []
for g in a.guide:
    d, w = g.rsplit(":", 1)
    guides.append((d, float(w)))

if a.edges:
    src, w = a.edges.rsplit(":", 1)
    ed = os.path.join(a.out, "_edges")
    os.makedirs(ed, exist_ok=True)
    for f in range(1, a.n + 1):
        if os.path.exists(fn(ed, f)):
            continue
        g = np.asarray(Image.open(fn(src, f)).convert("L"), np.float32)
        gx = np.zeros_like(g); gy = np.zeros_like(g)
        gx[:, 1:-1] = g[:, 2:] - g[:, :-2]
        gy[1:-1, :] = g[2:, :] - g[:-2, :]
        m = np.clip(np.hypot(gx, gy) * 2.0, 0, 255).astype(np.uint8)
        Image.fromarray(m).filter(ImageFilter.GaussianBlur(1.5)).save(fn(ed, f))
    guides.append((ed, float(w)))

fwd, bwd = os.path.join(a.out, "_fwd"), os.path.join(a.out, "_bwd")
os.makedirs(fwd, exist_ok=True); os.makedirs(bwd, exist_ok=True)


def synth(key, target, dst):
    if os.path.exists(dst):
        return 0.0
    cmd = ["nice", "-n", "10", a.ebsynth, "-style", fn(a.keys, key), "-uniformity", str(a.uniformity), "-patchsize", str(a.patchsize)]
    if a.fast:
        cmd += ["-searchvoteiters", "6", "-patchmatchiters", "3"]
    for d, w in guides:
        cmd += ["-guide", fn(d, key), fn(d, target), "-weight", str(w)]
    cmd += ["-output", dst]
    t = time.time()
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return time.time() - t


tasks = []
for k0, k1 in zip(keys, keys[1:]):
    for f in range(k0 + 1, k1):
        tasks.append((k0, f, fn(fwd, f)))
        tasks.append((k1, f, fn(bwd, f)))
t0 = time.time()
with ThreadPoolExecutor(a.jobs) as ex:
    secs = [s for s in ex.map(lambda t: synth(*t), tasks) if s > 0]
wall = time.time() - t0

for k0, k1 in zip(keys, keys[1:]):
    Image.open(fn(a.keys, k0)).convert("RGB").save(fn(a.out, k0))
    for f in range(k0 + 1, k1):
        t = (f - k0) / (k1 - k0)
        A = np.asarray(Image.open(fn(fwd, f)).convert("RGB"), np.float32)
        B = np.asarray(Image.open(fn(bwd, f)).convert("RGB"), np.float32)
        Image.fromarray(np.clip(A * (1 - t) + B * t + 0.5, 0, 255).astype(np.uint8)).save(fn(a.out, f))
Image.open(fn(a.keys, keys[-1])).convert("RGB").save(fn(a.out, keys[-1]))
meta = dict(keys=keys, n=a.n, guides=guides, uniformity=a.uniformity, patchsize=a.patchsize, fast=a.fast, jobs=a.jobs,
            synth_runs=len(secs), median_run_s=round(sorted(secs)[len(secs) // 2], 1) if secs else None,
            wall_s=round(wall, 1))
json.dump(meta, open(os.path.join(a.out, "timing.json"), "w"), indent=1)
print(json.dumps(meta))
