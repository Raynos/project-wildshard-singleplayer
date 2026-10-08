"""SHARD-PLATFORM G246 board: turn a real top-down bake (colour + height pass) into the three map looks.

  A photo           the colour bake as it is (resized to the minimap layer, 1000 px = 500 m, 2 px/m)
  B stylized        flat colours by ground type from the bake's colour + height (water flat blue, sand, grass bands,
                    rock, paths and decks highlighted with an edge, trees as crown dots), hillshade from the height pass
  C photo+outlines  the bake with +contrast and crisp dark outlines where the height or the ground type changes

Run: uv run --with scipy --with pillow --with numpy python stylize.py <slug> <bake.png> <height.png> <outdir>
"""
import sys
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage as ndi

slug, bake_p, height_p, out = sys.argv[1:5]
N = 1000
photo = Image.open(bake_p).convert('RGB').resize((N, N), Image.LANCZOS)
P = np.asarray(photo).astype(np.float32) / 255.0
hraw = np.asarray(Image.open(height_p).convert('RGB').resize((N, N), Image.NEAREST)).astype(np.float32)
mask = hraw[..., 2] > 128
H = (hraw[..., 0] * 256 + hraw[..., 1]) / 65535 * 400 - 100
H = ndi.median_filter(H, size=3)
mask = ndi.binary_opening(mask, iterations=1) if slug == 'far-reach' else mask

def hex3(h):
    h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255.0

def hillshade(h, ppm=2.0, az=315, alt=50, z=1.6):
    hs = ndi.gaussian_filter(h, 1.2)
    gy, gx = np.gradient(hs * ppm * z)
    # image x grows east, y grows south; light from the north-west
    slope = np.pi / 2 - np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    a, b = np.radians(360 - az + 90), np.radians(alt)
    s = np.sin(b) * np.sin(slope) + np.cos(b) * np.cos(slope) * np.cos(a - aspect)
    return np.clip(s, 0, 1)

def drop_small(region, n):
    lab, k = ndi.label(region)
    if k == 0: return region
    sizes = ndi.sum(region, lab, range(1, k + 1))
    keep = np.zeros(k + 1, bool); keep[1:] = sizes >= n
    return keep[lab]

def outline(region, px=1):
    """the pixels just inside a region's border"""
    return region & ~ndi.binary_erosion(region, iterations=px)

r, g, b = P[..., 0], P[..., 1], P[..., 2]
mx, mn = P.max(-1), P.min(-1)
sat = (mx - mn) / np.maximum(mx, 1e-3)
slope = np.hypot(*np.gradient(ndi.gaussian_filter(H, 1.0))) * 2.0  # metres per metre
bump = H - ndi.median_filter(H, size=15)                            # things standing on the ground (trees, huts, decks)

if slug == 'driftwood-isle':
    water = H < 0.15
    deep = H < -2.0
    green = (g > r * 1.05) & (g > b * 1.1)
    sandy = (r > 0.55) & (g > 0.45) & (b < g * 0.85) & ~green
    wood = (r > g * 1.12) & (r > 0.25) & (r < 0.75) & (sat > 0.3) & ~water & ~green
    rock = ~water & ~green & (sat < 0.28)
    rock |= ~water & (slope > 1.4)
    tree = ~water & (bump > 1.5) & green
    path = sandy & (H > 2.2)
    overwater = ndi.minimum_filter(H, size=11) < -0.5
    pier = ~water & overwater & ~green & (bump > 0.4)          # planks standing over the sea: the docks and jetties
    path = ndi.binary_opening(path & ~pier, iterations=1)
    path = drop_small(path, 150)
    deck = ndi.binary_opening(wood, iterations=1) | (wood & (H > 0.15) & (H < 3.5)) | pier
    deck = drop_small(ndi.binary_closing(deck, iterations=1), 60)
    sand = ~water & sandy & ~path
    sand = ndi.binary_closing(sand, iterations=2) & ~water
    land = ~water
    islet = land & ~drop_small(land, 600)                        # the sea rocks
    # flat colours (the current minimap palette where it has one: PATH, planks, PALM, rock)
    C = np.zeros_like(P)
    C[:] = hex3('#2f7fb8')
    C[water & ~deep] = hex3('#58a9d6')
    C[deep] = hex3('#2f7fb8')
    shore = water & ndi.binary_dilation(land, iterations=6) & ~deep
    C[shore] = hex3('#8cc9e6')
    gband = np.digitize(ndi.gaussian_filter(H, 2), [6, 16, 28])
    greens = [hex3('#7fb35a'), hex3('#6aa24d'), hex3('#5c9444'), hex3('#4f853d')]
    for i, col in enumerate(greens):
        C[land & (gband == i)] = col
    C[sand] = hex3('#ead9a2')
    C[rock & land & ~sand] = hex3('#9a958a')
    C[islet & ~deck] = hex3('#8f8a7e')
    shade = hillshade(H)
    C[land] *= (0.62 + 0.55 * shade[land])[:, None]
    # crowns: a dark dot with a soft shadow
    tl = ndi.binary_opening(tree & ~islet, iterations=1)
    sh = ndi.shift(tl.astype(np.float32), (3, 3), order=0) > 0.5
    C[sh & land & ~tl] *= 0.72
    C[tl] = hex3('#3d7a3c')
    C[outline(tl)] = hex3('#24502a')
    # paths and decks on top, each with a dark edge
    pe = ndi.binary_dilation(path, iterations=1)
    C[pe] = hex3('#8a6e46'); C[path] = hex3('#f1dca6')
    de = ndi.binary_dilation(deck, iterations=1)
    C[de] = hex3('#4a3220'); C[deck] = hex3('#c9a46c')
    coast = outline(land, 2)
    C[coast & ~deck] = C[coast & ~deck] * 0.55 + hex3('#3a2e1e') * 0.45
    classes = water * 1 + sand * 2 + (rock & land) * 3 + path * 4 + deck * 5 + tl * 6
else:  # far-reach: islands in a void
    isl = ndi.binary_opening(mask, iterations=4)
    isl = ndi.binary_propagation(isl, mask=mask) & ndi.binary_opening(mask, iterations=2)
    thin = mask & ~ndi.binary_dilation(isl, iterations=1)
    thin = ndi.binary_closing(ndi.binary_dilation(thin, iterations=1), iterations=2) & ~isl
    C = np.zeros_like(P)
    C[:] = hex3('#241f38')
    # a faint glow of the painted sea, so the void is not dead flat
    lum = ndi.gaussian_filter(P.mean(-1), 6)
    C *= (0.85 + 0.35 * (lum - lum.min()) / (lum.max() - lum.min() + 1e-6))[..., None]
    grassy = ndi.gaussian_filter(((g > r * 0.98) & (g > b * 1.15)).astype(np.float32), 3) > 0.35
    band = np.digitize(H, [40, 60])
    tops = [hex3('#7d7466'), hex3('#a0937a'), hex3('#c2b08c')]
    for i, col in enumerate(tops):
        C[isl & (band == i)] = col
    C[isl & grassy] = C[isl & grassy] * 0.2 + hex3('#79a84f') * 0.8
    shade = hillshade(H, z=0.8)
    C[isl] *= (0.7 + 0.45 * shade[isl])[:, None]
    # a cast shadow down-right of each island, by its height
    sh = ndi.shift(isl.astype(np.float32), (6, 6), order=0) > 0.5
    C[sh & ~isl & ~thin] *= 0.6
    rim = outline(isl, 2)
    C[rim] = hex3('#1a1526')
    te = ndi.binary_dilation(thin, iterations=1) & ~isl
    C[te] = hex3('#1a1526'); C[thin] = hex3('#f3dfae')
    classes = isl * 1 + thin * 2
    land = isl

Bimg = Image.fromarray((np.clip(C, 0, 1) * 255).astype(np.uint8))

# C: photo + outlines
pc = ImageEnhance.Color(ImageEnhance.Contrast(photo).enhance(1.25)).enhance(1.12)
Q = np.asarray(pc).astype(np.float32) / 255.0
edge_h = np.hypot(*np.gradient(ndi.gaussian_filter(H, 0.7))) > (0.9 if slug == 'driftwood-isle' else 3.0)
cl = classes.astype(np.int32)
edge_c = (np.abs(np.diff(cl, axis=0, prepend=cl[:1])) + np.abs(np.diff(cl, axis=1, prepend=cl[:, :1]))) > 0
if slug == 'far-reach':
    edge_c |= outline(mask, 1) | outline(ndi.binary_dilation(mask, iterations=1), 1)
edges = (edge_h | edge_c)
edges = ndi.binary_dilation(edges, iterations=1) if slug == 'far-reach' else edges
ink = hex3('#15130f')
Q[edges] = Q[edges] * 0.18 + ink * 0.82
Cimg = Image.fromarray((np.clip(Q, 0, 1) * 255).astype(np.uint8))

photo.save(f'{out}/{slug}-A.png'); Bimg.save(f'{out}/{slug}-B.png'); Cimg.save(f'{out}/{slug}-C.png')
print('ok', slug, 'land', round(float(land.mean()), 3))
