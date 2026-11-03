"""alien.py <out-dir>: Pastel Alien Plain's theme kit family (OPEN-PLOTS OP20), in kit.py's format (kitlib.py), retinted by a
layout's palette like every kit family. Target: art/grid/round-62-open-plot-palettes/13-alien-plain.jpg.

`alien`, three variants in the plain's obsidian, violet and acid lime (a family holds at most three; the glow plants are
the generator's own leaf fans, alien.mjs):
- 0 crystal cluster: violet hexagonal crystals and two glowing lime ones fanning out of a low dark rock, 3.6 m tall;
- 1 dome habitat: a 20 m faceted pale dome on a dark ring base, a band of lit lime windows round it and a lit door to
  the front (Blender -y, glTF +z), a small mast on its crown;
- 2 rock spire: a 7 m leaning dark faceted rock split by a glowing lime crack, violet crystals at its foot.
Run: bash scripts/blender/build.sh open-plots/alien.
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import Piece, build_family, reset_scene  # noqa: E402
from kit import SLOTS, TRIMS  # noqa: E402

# Slots a layout may not define (sRGB); the palette's own colour wins.
ALIEN_SLOTS = {**SLOTS, 'obsidian': '#2c2638', 'crystal': '#9a58e0', 'glowLime': '#c4f040', 'shell': '#c8c4d8',
               'shellDark': '#3a3448'}
ALIEN_TRIMS = {**TRIMS, 'obsidian': 'stone', 'shellDark': 'stone'}


def crystal(p, x, y, r, h, lean, slot):
    """A hexagonal crystal rising from (x, y) and leaning by `lean`, its pointed tip `h` up."""
    ring = [(x + r * math.cos(math.pi * k / 3), y + r * math.sin(math.pi * k / 3), 0.0) for k in range(6)]
    top = [(x + lean[0] * 0.8 + r * 0.85 * math.cos(math.pi * k / 3), y + lean[1] * 0.8 + r * 0.85 * math.sin(math.pi * k / 3), h * 0.78) for k in range(6)]
    tip = (x + lean[0], y + lean[1], h)
    for k in range(6):
        n = (k + 1) % 6
        p.face([ring[k], ring[n], top[n], top[k]], slot)
        p.face([top[k], top[n], tip], slot)


def rock(p, x, y, r, h, lean, sides, rng, slot, crack=None):
    """A leaning faceted rock narrowing in three tiers to a blunt top; `crack` lights a zigzag strip up its front face."""
    tiers = [(0.0, 1.0), (0.5, 0.75), (1.0, 0.3)]
    spin = rng.uniform(0, math.pi)
    radii = [r * rng.uniform(0.8, 1.15) for _ in range(sides)]
    def at(t, k, s):
        a = spin + 2 * math.pi * k / sides
        return (x + lean[0] * t + radii[k % sides] * s * math.cos(a), y + lean[1] * t + radii[k % sides] * s * math.sin(a), h * t)
    front = min(range(sides), key=lambda k: math.sin(spin + 2 * math.pi * (k + 0.5) / sides))
    centres = [0.35, 0.65, 0.4]
    mix = lambda u, v, f: tuple(u[i] + (v[i] - u[i]) * f for i in range(3))
    for j in range(len(tiers) - 1):
        (t0, s0), (t1, s1) = tiers[j], tiers[j + 1]
        for k in range(sides):
            a0, a1, b0, b1 = at(t0, k, s0), at(t0, k + 1, s0), at(t1, k, s1), at(t1, k + 1, s1)
            if crack and k == front:
                c0, c1, w = centres[j], centres[j + 1], 0.1
                al, ar, bl, br = mix(a0, a1, c0 - w), mix(a0, a1, c0 + w), mix(b0, b1, c1 - w), mix(b0, b1, c1 + w)
                p.face([a0, al, bl, b0], slot)
                p.face([al, ar, br, bl], crack)
                p.face([ar, a1, b1, br], slot)
            else:
                p.face([a0, a1, b1, b0], slot)
    p.face([at(1.0, k, 0.3) for k in range(sides)], slot)


def cluster():
    """Variant 0: the crystal cluster."""
    p = Piece()
    rng = random.Random(3)
    rock(p, 0.0, 0.0, 1.1, 0.7, (0.0, 0.0), 5, rng, 'Kit.obsidian')
    for x, y, r, h, lx, ly, slot in ((0.0, 0.0, 0.42, 3.6, 0.1, 0.0, 'Kit.crystal'), (-0.7, 0.3, 0.32, 2.6, -0.8, 0.3, 'Kit.crystal'),
                                     (0.7, 0.4, 0.34, 2.8, 0.9, 0.4, 'Glow.glowLime'), (0.2, -0.7, 0.28, 2.0, 0.3, -0.8, 'Kit.crystal'),
                                     (-0.4, -0.5, 0.26, 1.7, -0.5, -0.7, 'Glow.glowLime'), (0.3, 0.8, 0.24, 1.5, 0.2, 0.9, 'Kit.crystal')):
        crystal(p, x, y, r, h, (lx, ly), slot)
    p.emitter((0.6, 0.0, 2.0), 'glowLime')
    return p


def dome():
    """Variant 1: the dome habitat, its door to the front (Blender -y)."""
    p = Piece()
    R, sides = 10.0, 12
    p.prism(0.0, 0.0, R + 0.6, R + 0.4, 0.0, 0.8, sides, 'Kit.shellDark', cap_top=True)
    # the shell: four rings of facets, the lowest carrying the window band
    prof = [(R, 0.8), (R, 2.0), (R * 0.97, 3.4), (R * 0.86, 5.6), (R * 0.62, 7.8), (R * 0.3, 9.2), (0.0, 9.6)]
    p.lathe(0.0, 0.0, prof, sides, ['Kit.shell', 'Kit.shell', 'Kit.shell', 'Kit.shell', 'Kit.shell', 'Kit.shell'])
    for k in range(sides):  # a lit window on every facet of the band, the front one a door
        a0, a1 = 2 * math.pi * (k + 0.2) / sides, 2 * math.pi * (k + 0.8) / sides
        mid = 2 * math.pi * (k + 0.5) / sides
        door = abs(math.sin(mid) + 1) < 0.05
        z0, z1 = (0.8, 3.0) if door else (2.2, 3.1)
        rr0, rr1 = (R + 0.06, R * 0.97 + 0.06) if not door else (R + 0.06, R + 0.06)
        if door:
            a0, a1 = mid - 0.08, mid + 0.08
        p.panel([(rr0 * math.cos(a0), rr0 * math.sin(a0), z0), (rr0 * math.cos(a1), rr0 * math.sin(a1), z0),
                 (rr1 * math.cos(a1), rr1 * math.sin(a1), z1), (rr1 * math.cos(a0), rr1 * math.sin(a0), z1)], 'Glow.window')
    for k in range(sides):  # the dark ribs between the facets of the upper shell
        a = 2 * math.pi * k / sides
        for (r0, z0), (r1, z1) in zip(prof[1:-1], prof[2:]):
            d = 0.12
            p.panel([((r0 + 0.05) * math.cos(a - d / r0), (r0 + 0.05) * math.sin(a - d / r0), z0), ((r0 + 0.05) * math.cos(a + d / r0), (r0 + 0.05) * math.sin(a + d / r0), z0),
                     ((r1 + 0.05) * math.cos(a + d / max(r1, 1)), (r1 + 0.05) * math.sin(a + d / max(r1, 1)), z1), ((r1 + 0.05) * math.cos(a - d / max(r1, 1)), (r1 + 0.05) * math.sin(a - d / max(r1, 1)), z1)], 'Kit.shellDark')
    p.prism(0.0, 0.0, 0.12, 0.08, 9.5, 12.0, 4, 'Kit.shellDark')  # the mast
    p.box((-0.2, -0.2, 12.0), (0.2, 0.2, 12.4), 'Glow.glowLime')
    p.emitter((0.0, -R - 0.6, 2.4), 'window')
    return p


def spire():
    """Variant 2: the rock spire, its crack to the front."""
    p = Piece()
    rng = random.Random(11)
    rock(p, 0.0, 0.0, 1.8, 7.0, (0.6, 0.3), 6, rng, 'Kit.obsidian', crack='Glow.glowLime')
    rock(p, 1.6, 1.0, 0.9, 3.2, (0.5, 0.4), 5, rng, 'Kit.obsidian')
    for x, y, h, lx, ly in ((-1.6, -1.2, 1.8, -0.5, -0.3), (-1.9, -0.4, 1.3, -0.6, 0.1), (1.4, -1.5, 1.5, 0.4, -0.5)):
        crystal(p, x, y, 0.26, h, (lx, ly), 'Kit.crystal')
    p.emitter((0.3, -2.0, 3.0), 'glowLime')
    return p


def main():
    out = sys.argv[sys.argv.index('--') + 1]
    os.makedirs(out, exist_ok=True)
    reset_scene()
    build_family(out, 'alien', [cluster, dome, spire], ALIEN_TRIMS, {'slots': ALIEN_SLOTS})


if __name__ == '__main__':
    main()
