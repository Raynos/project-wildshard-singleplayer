"""
barkgen.py — the silver birch's bark, generated (Poly Haven has no birch bark): a seamless 1024² albedo / height, from which
build_trees.py writes the PBR set (diffuse / nor_gl / arm). Everything is periodic (FFT-filtered noise, np.roll), so the
tile wraps round the trunk and up it without a seam.

Betula pendula's bark: chalk-white with a faint cream / pink cast, papery; dark horizontal lenticels (short dashes, in
loose rows); black, rough diamond-shaped fissures and scars here and there; thin curls where the paper peels (a warm
tan edge). The tile is 0.8 m of trunk each way (treegen.py birch tile).
"""
import numpy as np

S = 1024


def fnoise(rng, shape, lo, hi, aniso=(1.0, 1.0)):
    """Band-limited periodic noise, normalised to [-1, 1]. lo / hi: the band in cycles per tile; aniso < 1 stretches the features along that axis."""
    h, w = shape
    fy = np.fft.fftfreq(h)[:, None] * h / aniso[1]
    fx = np.fft.fftfreq(w)[None, :] * w / aniso[0]
    f = np.sqrt(fx * fx + fy * fy)
    amp = np.where((f >= lo) & (f <= hi), 1.0 / np.maximum(f, 1.0), 0.0)
    ph = rng.uniform(0, 2 * np.pi, shape)
    n = np.real(np.fft.ifft2(amp * np.exp(1j * ph)))
    return n / (np.abs(n).max() + 1e-9)


def dash(field, cy, cx, length, thick, depth):
    """Stamp a horizontal lenticel (a soft-ended dash) into `field`, wrapping at the edges."""
    ys = np.arange(-int(thick * 2) - 1, int(thick * 2) + 2)
    xs = np.arange(-int(length / 2) - 2, int(length / 2) + 3)
    Y, X = np.meshgrid(ys, xs, indexing='ij')
    prof = np.exp(-(Y / max(thick, 0.5)) ** 2) * np.clip(1 - (np.abs(X) / (length / 2)) ** 4, 0, 1)
    rr = (cy + Y) % S
    cc = (cx + X) % S
    np.maximum.at(field, (rr, cc), prof * depth)


def birch_bark(seed=7):
    rng = np.random.default_rng(seed)
    # papery base: a very low-contrast mottling, stretched sideways (the paper's horizontal grain)
    base = 0.5 * fnoise(rng, (S, S), 1, 12, (0.33, 1.0)) + 0.25 * fnoise(rng, (S, S), 12, 60, (0.25, 1.0)) + 0.1 * fnoise(rng, (S, S), 60, 300, (0.5, 1))
    lent = np.zeros((S, S))
    rows = rng.integers(0, S, 70)
    for r in rows:
        n = rng.integers(3, 9)
        for _ in range(n):
            dash(lent, int(r + rng.normal(0, 6)), int(rng.integers(0, S)), float(rng.uniform(18, 110)), float(rng.uniform(1.2, 3.8)),
                 float(rng.uniform(0.5, 1.0)))
    for _ in range(260):  # small ones everywhere
        dash(lent, int(rng.integers(0, S)), int(rng.integers(0, S)), float(rng.uniform(6, 30)), float(rng.uniform(0.8, 2.0)), float(rng.uniform(0.3, 0.8)))
    # black fissured patches (the older bark): thresholded noise, rough inside
    patch_n = fnoise(rng, (S, S), 2, 8, (0.55, 1.0)) + 0.35 * fnoise(rng, (S, S), 20, 120)
    patch = np.clip((patch_n - 0.52) * 5, 0, 1)
    rough = 0.5 + 0.5 * fnoise(rng, (S, S), 40, 300)
    # peel curls: thin warm lines along the lenticel rows' edges
    peel = np.clip((fnoise(rng, (S, S), 3, 30, (0.15, 1.4)) - 0.6) * 6, 0, 1) * (1 - patch)

    white = np.array([0.86, 0.85, 0.81])
    albedo = white[None, None, :] * (1 + 0.06 * base[..., None])
    albedo = albedo * (1 - 0.05 * np.clip(fnoise(rng, (S, S), 1, 5), 0, 1)[..., None]) + np.array([0.02, 0.0, 0.01]) * np.clip(base, 0, 1)[..., None]
    dark = np.array([0.1, 0.09, 0.085])
    albedo = albedo * (1 - lent[..., None] * 0.85) + dark * lent[..., None] * 0.85
    pa = (patch * (0.75 + 0.25 * rough))[..., None]
    albedo = albedo * (1 - pa) + np.array([0.13, 0.12, 0.11]) * (0.6 + 0.8 * rough[..., None]) * pa
    albedo = albedo * (1 - peel[..., None] * 0.45) + np.array([0.62, 0.45, 0.33]) * peel[..., None] * 0.45
    albedo = np.clip(albedo, 0, 1)

    height = 0.5 + 0.08 * base - 0.35 * lent - 0.3 * patch * (0.5 + rough) + 0.12 * peel
    # normal (OpenGL: +y up the image = up the trunk; row 0 is the image's top)
    k = 3.2
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
    dy = (np.roll(height, 1, 0) - np.roll(height, -1, 0)) * 0.5  # up = toward row 0
    n = np.stack([-dx * k * 8, -dy * k * 8, np.ones_like(height)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    ao = np.clip(1 - 0.5 * lent - 0.35 * patch, 0, 1)
    roughness = np.clip(0.72 + 0.2 * patch - 0.1 * (1 - lent - patch) * 0.3, 0, 1)
    arm = np.stack([ao, roughness, np.zeros_like(ao)], -1)
    return albedo, n * 0.5 + 0.5, arm
