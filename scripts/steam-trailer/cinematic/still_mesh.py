"""TRAILERS T15 (E471): one painting → a depth mesh for camera projection (the matte-painting trick).

  ~/ml/img2mesh/Pixal3D-mac/.venv/bin/python still_mesh.py <image.png> <out.obj> [--step 2] [--far 0.985]

MoGe-2 (Ruicheng/moge-2-vitl) predicts per-pixel camera-space points; the grid of points becomes a triangle mesh whose
UVs are the pixel coordinates, so the painting maps back onto itself exactly. Blender (`still_cam.py`) then films the
mesh with a moving camera: the picture never changes, only the parallax does. Writes <out.obj> and <out>.json (the
horizontal field of view, so the Blender camera starts exactly where the painting was "taken"). Pixels MoGe masks out
(sky) are pushed back to a far plane instead of dropped, so the sky stays a backdrop. Run it under the model lock.
"""
import argparse, json, math, os
import numpy as np
import torch
from PIL import Image
from moge.model.v2 import MoGeModel

ap = argparse.ArgumentParser()
ap.add_argument('image'); ap.add_argument('out')
ap.add_argument('--step', type=int, default=2, help='mesh every Nth pixel')
ap.add_argument('--far', type=float, default=0.985, help='depth quantile the masked sky is pushed to (× 1.6)')
a = ap.parse_args()

dev = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
model = MoGeModel.from_pretrained(os.path.expanduser('~/projects/weights/manual/Ruicheng/moge-2-vitl/model.pt')).to(dev).eval()
img = np.asarray(Image.open(a.image).convert('RGB'))
H, W = img.shape[:2]
with torch.no_grad():
    out = model.infer(torch.tensor(img / 255.0, dtype=torch.float32, device=dev).permute(2, 0, 1))
pts = out['points'].cpu().numpy()          # (H, W, 3), camera space, +z forward, +y down (OpenCV)
mask = out['mask'].cpu().numpy().astype(bool)
K = out['intrinsics'].cpu().numpy()        # normalised: fx in units of image width
fov_x = 2 * math.atan(0.5 / K[0, 0])

# the sky (masked) goes to a far plane along each pixel's ray, so nothing is missing behind the camera move
z = pts[..., 2]
zfar = np.quantile(z[mask], a.far) * 1.6 if mask.any() else 100.0
ys, xs = np.mgrid[0:H, 0:W]
ray = np.stack([((xs + 0.5) / W - K[0, 2]) / K[0, 0], ((ys + 0.5) / H - K[1, 2]) / K[1, 1], np.ones(z.shape)], -1)
bad = ~mask | ~np.isfinite(z) | (z <= 0)
pts = np.where(bad[..., None], ray * zfar, pts)
pts[..., 2] = np.minimum(pts[..., 2], zfar)

s = a.step
gy, gx = np.mgrid[0:H:s, 0:W:s]
P = pts[gy, gx]                             # (h, w, 3)
h, w = gx.shape
with open(a.out, 'w') as f:
    f.write(f'mtllib {os.path.basename(a.out)[:-4]}.mtl\nusemtl paint\n')
    for v in P.reshape(-1, 3):
        f.write(f'v {v[0]:.5f} {-v[1]:.5f} {-v[2]:.5f}\n')     # OpenCV → Blender/OBJ (+y up, −z forward)
    for yy, xx in zip(gy.reshape(-1), gx.reshape(-1)):
        f.write(f'vt {(xx + 0.5) / W:.6f} {1 - (yy + 0.5) / H:.6f}\n')
    idx = np.arange(h * w).reshape(h, w) + 1
    for i in range(h - 1):
        for j in range(w - 1):
            q = (idx[i, j], idx[i, j + 1], idx[i + 1, j + 1], idx[i + 1, j])
            f.write('f ' + ' '.join(f'{k}/{k}' for k in q) + '\n')
with open(a.out[:-4] + '.mtl', 'w') as f:
    f.write(f'newmtl paint\nmap_Kd {os.path.abspath(a.image)}\n')
json.dump({'fov_x': fov_x, 'width': W, 'height': H, 'zfar': float(zfar), 'z_median': float(np.median(z[mask])) if mask.any() else None},
          open(a.out[:-4] + '.json', 'w'), indent=1)
print(f'{a.out}: {h * w} verts, fov_x {math.degrees(fov_x):.1f}°, sky at z={zfar:.2f}')
