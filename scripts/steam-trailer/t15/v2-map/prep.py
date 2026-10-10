"""T15-2 'The map that draws itself': turn ink drawings and handwritten words into draw-on data.

For every drawing (art/trailers/round-4-t15/v2-map/plot-*.jpg) and every word (author handles, *yours*, the caption)
this writes, next to the page:
  build/ink/<id>.png   the ink as alpha (black RGB), 1024 px for drawings
  build/data.js        window.MAPDATA, per id: the skeleton of the ink as ordered pen strokes [{p: flat xy list, r: half-width, t0, t1}]
The page reveals the ink through those strokes (a mask drawn along the centre line of every mark, in drawing order),
so each line really draws on along its own path; nothing fades in.
Also writes build/paper.jpg (a seamless paper tile) and build/tooth.png (paper tooth for the crayon outline).

  venv/bin/python prep.py <art dir> <fonts dir> <out build dir> [--paper-only]
"""
import json
import math
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize

ART, FONTS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(f"{OUT}/ink", exist_ok=True)
rng = np.random.default_rng(7)

# drawings: id -> (file, binarise threshold, ink gain)
DRAWINGS = {
    "driftwood": ("plot-driftwood.jpg", 0.20, 1.15),
    "nalati": ("plot-nalati.jpg", 0.20, 1.1),
    "pine": ("plot-pine.jpg", 0.22, 1.1),
    "dunes": ("plot-dunes.jpg", 0.10, 1.35),
    "ninedragon": ("plot-ninedragon.jpg", 0.20, 1.1),
    "farm": ("extra-farm.jpg", 0.22, 1.1),
    "castle": ("extra-castle.jpg", 0.22, 1.1),
    "volcano": ("extra-volcano.jpg", 0.20, 1.1),
    "canyon": ("extra-canyon.jpg", 0.20, 1.1),
    "harbour": ("extra-harbour.jpg", 0.22, 1.1),
    "glacier": ("extra-glacier.jpg", 0.22, 1.1),
    "ruins": ("extra-ruins.jpg", 0.22, 1.1),
    "rice": ("extra-rice.jpg", 0.22, 1.1),
    "stones": ("extra-stones.jpg", 0.12, 1.3),
    "stilts": ("extra-stilts.jpg", 0.22, 1.1),
    "observatory": ("extra-observatory.jpg", 0.22, 1.1),
    "fair": ("extra-fair.jpg", 0.22, 1.1),
    "bamboo": ("extra-bamboo.jpg", 0.20, 1.1),
    "oasis": ("extra-oasis.jpg", 0.20, 1.1),
    "quarry": ("extra-quarry.jpg", 0.22, 1.1),
    "swamp": ("extra-swamp.jpg", 0.20, 1.1),
}
# words: id -> (text, font file, size px, variation weight or None)
WORDS = {
    "h-mara": ("@mara", "HomemadeApple-Regular.ttf", 56, None),
    "h-juno": ("@juno", "CaveatBrush-Regular.ttf", 84, None),
    "h-kofi": ("@kofi", "Kalam-Regular.ttf", 70, None),
    "h-lev": ("@lev", "ReenieBeanie.ttf", 96, None),
    "h-ines": ("@ines", "GochiHand-Regular.ttf", 78, None),
    "h-tove": ("@tove", "Zeyada.ttf", 90, None),
    "h-ash": ("@ash", "LaBelleAurore.ttf", 72, None),
    "h-rin": ("@rin", "NanumPenScript-Regular.ttf", 100, None),
    "h-oso": ("@oso", "NothingYouCouldDo.ttf", 64, None),
    "h-pia": ("@pia", "Caveat[wght].ttf", 84, 500),
    "h-sam": ("@sam", "Kalam-Regular.ttf", 66, None),
    "h-noor": ("@noor", "HomemadeApple-Regular.ttf", 48, None),
    "yours": ("yours", "Caveat[wght].ttf", 300, 700),
    "cap1": ("Every shard", "Caveat[wght].ttf", 220, 600),
    "cap2": ("built by a player.", "Caveat[wght].ttf", 220, 600),
}


def trace_paths(sk):
    """Skeleton pixels -> list of pixel paths (lists of (y, x)), split at junctions."""
    h, w = sk.shape
    k = np.ones((3, 3), np.uint8)
    k[1, 1] = 0
    deg = ndimage.convolve(sk.astype(np.uint8), k, mode="constant") * sk
    offs = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    def nbrs(y, x):
        for dy, dx in offs:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and sk[yy, xx]:
                yield yy, xx

    visited = np.zeros_like(sk, dtype=bool)
    paths = []
    seen_pairs = set()
    node_ys, node_xs = np.nonzero(sk & (deg != 2))
    for y, x in zip(node_ys, node_xs):
        if deg[y, x] == 0:
            paths.append([(y, x)])
            continue
        for m in nbrs(y, x):
            if deg[m] != 2:
                key = (min((y, x), m), max((y, x), m))
                if key not in seen_pairs:
                    seen_pairs.add(key)
                    paths.append([(y, x), m])
                continue
            if visited[m]:
                continue
            path = [(y, x), m]
            visited[m] = True
            prev, cur = (y, x), m
            while True:
                nxt = None
                for c in nbrs(*cur):
                    if c == prev:
                        continue
                    if deg[c] != 2:
                        nxt = c
                        break
                    if not visited[c]:
                        nxt = c
                if nxt is None:
                    break
                path.append(nxt)
                if deg[nxt] != 2:
                    break
                visited[nxt] = True
                prev, cur = cur, nxt
            paths.append(path)
    # closed loops with no junction
    ys, xs = np.nonzero(sk & (deg == 2) & ~visited)
    for y, x in zip(ys, xs):
        if visited[y, x]:
            continue
        path = [(y, x)]
        visited[y, x] = True
        prev, cur = None, (y, x)
        while True:
            nxt = None
            for c in nbrs(*cur):
                if c != prev and not visited[c] and deg[c] == 2:
                    nxt = c
                    break
            if nxt is None:
                break
            path.append(nxt)
            visited[nxt] = True
            prev, cur = cur, nxt
        path.append(path[0])
        paths.append(path)
    return paths


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    n = np.hypot(*ab)
    if n < 1e-9:
        d = np.hypot(*(pts - a).T)
    else:
        d = np.abs(ab[0] * (pts[:, 1] - a[1]) - ab[1] * (pts[:, 0] - a[0])) / n
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[: i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([a, b])


def strokes_from_ink(ink, thr, left_to_right=False, start=None):
    binm = ink > thr
    lab, n = ndimage.label(binm, structure=np.ones((3, 3)))
    sizes = ndimage.sum(binm, lab, range(1, n + 1))
    keep = np.isin(lab, np.nonzero(sizes >= 4)[0] + 1)
    binm &= keep
    sk = skeletonize(binm)
    dt = ndimage.distance_transform_edt(binm)
    raw = trace_paths(sk)
    items = []
    for path in raw:
        arr = np.array(path, dtype=float)[:, ::-1]  # (x, y)
        ys = [p[0] for p in path]
        xs = [p[1] for p in path]
        inner = dt[ys[1:-1], xs[1:-1]] if len(path) > 2 else dt[ys, xs]
        r = float(np.max(inner)) if len(inner) else 1.0
        length = float(np.sum(np.hypot(*np.diff(arr, axis=0).T))) if len(arr) > 1 else 1.0
        comp = int(lab[ys[0], xs[0]])
        items.append({"pts": arr, "r": r, "len": max(length, 1.0), "comp": comp})
    if not items:
        return []
    h, w = ink.shape
    # order: big connected marks first (the outlines), then the small marks (detail, hatching, dots)
    comp_len = {}
    for it in items:
        comp_len[it["comp"]] = comp_len.get(it["comp"], 0) + it["len"]
    if left_to_right:
        comp_minx = {}
        for it in items:
            comp_minx[it["comp"]] = min(comp_minx.get(it["comp"], 1e9), float(it["pts"][:, 0].min()))
        groups = [[it for it in items if it["comp"] == c] for c in sorted(comp_minx, key=comp_minx.get)]
        pen = np.array([0.0, h / 2])
    else:
        big = [it for it in items if comp_len[it["comp"]] >= 140]
        small = [it for it in items if comp_len[it["comp"]] < 140]
        groups = [big, small]
        pen = np.array(start if start else [w * 0.5, h * 0.35])
    ordered = []
    for g in groups:
        if not g:
            continue
        n_g = len(g)
        ends = np.array([it["pts"][0] for it in g] + [it["pts"][-1] for it in g])
        tree = cKDTree(ends)
        alive = np.ones(n_g, bool)
        for _ in range(n_g):
            k = 16
            while True:
                kk = min(k, 2 * n_g)
                dd, ii = tree.query(pen, k=kk)
                dd, ii = np.atleast_1d(dd), np.atleast_1d(ii)
                ok = alive[ii % n_g]
                if ok.any():
                    j = int(np.argmax(ok))
                    i, flip, jump = int(ii[j] % n_g), bool(ii[j] >= n_g), float(dd[j])
                    break
                k *= 4
            alive[i] = False
            it = g[i]
            pts = it["pts"][::-1] if flip else it["pts"]
            ordered.append((pts, it["r"], it["len"], jump))
            pen = pts[-1]
    # merge strokes that continue each other, then time them: pen travel ~ length, plus a lift for each jump
    merged = []
    for pts, r, ln, jump in ordered:
        if merged and jump <= 1.5 and abs(merged[-1]["r"] - r) <= 1.5 and len(merged[-1]["pts"]) < 4000:
            m = merged[-1]
            m["pts"] = np.vstack([m["pts"], pts[1:]]) if len(pts) > 1 else m["pts"]
            m["r"] = max(m["r"], r)
            m["len"] += ln
        else:
            merged.append({"pts": pts, "r": r, "len": ln, "jump": jump})
    t = 0.0
    out = []
    for m in merged:
        t += 2.0 + min(m["jump"], 300) * 0.12
        t0 = t
        t += m["len"]
        p = rdp(m["pts"], 0.6)
        out.append({"p": [round(float(v), 1) for v in p.reshape(-1)], "r": round(m["r"] + 1.2, 2), "t0": t0, "t1": t})
    for s in out:
        s["t0"] = round(s["t0"] / t, 5)
        s["t1"] = round(s["t1"] / t, 5)
    return out


def save_ink(ink, path):
    a = (np.clip(ink, 0, 1) * 255).astype(np.uint8)
    rgba = np.zeros(a.shape + (4,), np.uint8)
    rgba[..., 3] = a
    Image.fromarray(rgba, "RGBA").save(path, optimize=True)


def low_noise(shape, sigma):
    n = rng.standard_normal(shape)
    f = np.fft.fft2(n)
    fy = np.fft.fftfreq(shape[0])[:, None]
    fx = np.fft.fftfreq(shape[1])[None, :]
    g = np.exp(-(fx ** 2 + fy ** 2) * (2 * math.pi * sigma) ** 2 / 2)
    out = np.real(np.fft.ifft2(f * g))
    return out / (out.std() + 1e-9)


PAPER_ONLY = "--paper-only" in sys.argv
data = {}
for key, (fname, thr, gain) in ({} if PAPER_ONLY else DRAWINGS).items():
    src = f"{ART}/{fname}"
    if not os.path.exists(src):
        print("missing", src)
        continue
    g = np.asarray(Image.open(src).convert("L").resize((1024, 1024), Image.LANCZOS), dtype=np.float32) / 255
    # the paper of the scan to pure white, the ink to alpha
    paper = np.percentile(g, 92)
    ink = np.clip((paper - g) / max(paper - 0.08, 0.3), 0, 1)
    ink = np.clip(ink * gain, 0, 1)
    # a soft rim of bled ink and a little density variation, so it sits in the paper
    bleed = cv2.GaussianBlur(ink, (0, 0), 1.3)
    ink = np.maximum(ink, bleed * 0.45) * (0.88 + 0.12 * np.clip(low_noise(ink.shape, 18) * 0.5 + 0.5, 0, 1))
    save_ink(ink, f"{OUT}/ink/{key}.png")
    strokes = strokes_from_ink(ink, thr)
    data[key] = {"w": 1024, "h": 1024, "strokes": strokes}
    print(key, len(strokes), "strokes")

for key, (text, font, size, wght) in ({} if PAPER_ONLY else WORDS).items():
    f = ImageFont.truetype(f"{FONTS}/{font}", size)
    if wght:
        try:
            f.set_variation_by_axes([wght])
        except Exception as e:  # noqa: BLE001
            print("variation", key, e)
    l, t, r, b = f.getbbox(text)
    pad = int(size * 0.25)
    W, H = r - l + 2 * pad, b - t + 2 * pad
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).text((pad - l, pad - t), text, font=f, fill=255)
    ink = np.asarray(im, dtype=np.float32) / 255
    bleed = cv2.GaussianBlur(ink, (0, 0), max(1.0, size / 160))
    ink = np.maximum(ink, bleed * 0.4)
    save_ink(ink, f"{OUT}/ink/{key}.png")
    strokes = strokes_from_ink(ink, 0.35, left_to_right=True)
    # baseline offset (from the top of the image) so the page can set words on a line
    data[key] = {"w": W, "h": H, "base": pad - t + f.getmetrics()[0], "strokes": strokes}
    print(key, len(strokes), "strokes")

if not PAPER_ONLY:
  with open(f"{OUT}/data.js", "w") as fh:
    fh.write("window.MAPDATA=")
    json.dump(data, fh, separators=(",", ":"))

# paper: a seamless 2048 tile, neutral warm white, soft mottling, fibres, fine grain (overcast, not golden)
S = 2048
lum = 0.0 + 1.5 * low_noise((S, S), 60) + 1.0 * low_noise((S, S), 14) + 1.5 * low_noise((S, S), 0.8)
fib = np.zeros((S + 64, S + 64), np.float32)
for _ in range(9000):
    x, y = rng.uniform(0, S, 2)
    a = rng.uniform(0, math.pi)
    ln = rng.uniform(6, 34)
    c = rng.choice([-1.0, 1.0]) * rng.uniform(0.4, 1.0)
    pts = []
    for s in np.linspace(-0.5, 0.5, 6):
        bend = math.sin(s * 3 + a) * ln * 0.08
        pts.append((x + 32 + math.cos(a) * ln * s - math.sin(a) * bend, y + 32 + math.sin(a) * ln * s + math.cos(a) * bend))
    cv2.polylines(fib, [np.array(pts, np.int32)], False, c, 1, cv2.LINE_AA)
core = fib[32:-32, 32:-32].copy()
core[:32, :] += fib[-32:, 32:-32]
core[-32:, :] += fib[:32, 32:-32]
core[:, :32] += fib[32:-32, -32:]
core[:, -32:] += fib[32:-32, :32]
lum += core * 3.0
base = np.array([244.0, 240.0, 231.0])
img = np.clip(base[None, None, :] + lum[..., None] * np.array([1.0, 1.0, 1.05]), 0, 255).astype(np.uint8)
Image.fromarray(img, "RGB").save(f"{OUT}/paper.jpg", quality=92)
tooth = np.clip(0.5 + 0.5 * (0.7 * low_noise((512, 512), 0.9) + 0.3 * low_noise((512, 512), 3)), 0, 1)
tooth = (np.clip((tooth - 0.32) * 2.2, 0, 1) * 255).astype(np.uint8)
rgba = np.zeros((512, 512, 4), np.uint8)
rgba[..., 3] = tooth
Image.fromarray(rgba, "RGBA").save(f"{OUT}/tooth.png")
print("paper + tooth written")
