# Builds the RGBA twig cutout used for the runtime branch-card bake from the Poly Haven
# pine_tree_01 twig atlas (diffuse + alpha). Cleans the neighbouring opaque scan junk so the
# top-left twig is an isolated sprite. Run after `pnpm assets`.
from PIL import Image
import numpy as np
from collections import deque

base = 'public/assets/tex/pine_tree_01/'
a = Image.open(base + 'twig_diff.jpg').convert('RGBA')
m = np.array(Image.open(base + 'twig_alpha.jpg').convert('L'))
arr = np.array(a)
mask = m > 100
# cut the twig free from the neighbouring opaque regions
mask[446:, :300] = False
mask[350:, :30] = False
# flood fill from a stem pixel (4-connected)
keep = np.zeros_like(mask)
q = deque([(300, 140)]); keep[300, 140] = True
H, W = mask.shape
while q:
    y, x = q.popleft()
    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
        ny, nx = y+dy, x+dx
        if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not keep[ny, nx]:
            keep[ny, nx] = True; q.append((ny, nx))
region = np.zeros_like(mask)
region[:446, :230] = True
alpha = np.where(region, np.where(keep, m, 0), m)
arr[:, :, 3] = alpha
Image.fromarray(arr).save(base + 'twig_rgba.png')
ys, xs = np.where(keep)
print('twig bbox', xs.min(), xs.max(), ys.min(), ys.max())
