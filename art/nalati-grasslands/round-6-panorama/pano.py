"""Outpaint ONE continuous 360-degree painted panorama with codex image_gen.

Slices are 1536x1024 and cover 100 degrees of compass azimuth each (15.36 px/deg). Compass: 0 = north (+z), 90 = east,
180 = south, 270 = west; image-right = turning right = increasing azimuth. The eye-level horizon is row HOR (68%).

  A      170..270   seed (range, planet at 205, sun at 250)
  left   120..220 -> 70..170 -> 20..120      each keeps the left neighbour's known half, paints the new left half
  right  220..320 -> 270..370                 keeps the known left half, paints the new right half
  close  330..430 (= 330..70)                 both ends known, paints the middle

usage: python3 pano.py seed | left | right | close | stitch
"""
import os, subprocess, sys, json, shutil, glob, time
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, COV = 1536, 1024, 100.0
PPD = W / COV
HOR = int(H * 0.68)
REF = '/Users/raynos/projects/games/wildshard-nalati-grasslands/art/nalati-grasslands/round-4-camp-9angle'

STYLE = ("Painterly stylized video-game matte painting: the hand-painted look of Studio Ghibli background paintings, Zelda Breath "
         "of the Wild and Genshin Impact concept art; soft visible brush strokes, rich luminous natural colours, crisp readable "
         "silhouettes, lots of fine detail, late-afternoon golden light from the west (the sun is at compass 250 degrees).")
LAYOUT = (f"This is one 100-degree slice of a seamless 360-degree panorama that wraps a game's sky, seen from a meadow at eye "
          f"level in a high Tian Shan valley. STRICT layout: the eye-level horizon is a perfectly level line at 68% of the image "
          f"height from the top; distant mountains and hills rise above it with hazy bases; below it only hazy far-away valley floor "
          f"and low forested foothills (hidden later behind 3D terrain). Above the land is painted sky all the way to the top edge. "
          f"Horizontally each 15 px is one degree of azimuth, so keep the perspective of a wide cylindrical panorama: level horizon, "
          f"no vanishing-point valley, no centred composition, no framing trees. NO foreground at all: no grass close-up, no flowers, "
          f"no river in front, no people, animals, buildings, yurts or fences, no text, no UI, no border, no watermark.")

BANDS = [  # (from, to, description) in compass degrees
    (20, 70, "low rolling green steppe hills with scattered dark spruce groves under a deep clear blue sky, a few bright fluffy fair-weather cumulus and long thin cirrus streaks"),
    (70, 120, "a gorge: two steep forested mountain walls with rocky crests either side of a narrow hazy valley, snow patches on the higher tops, blue sky with cumulus"),
    (120, 170, "the massive jagged glaciated Nalati snow range, crisp white snow and blue-violet shadowed rock, strongly lit from the right, towering bright cumulus behind it in a blue sky"),
    (170, 240, "the snow range continues, even taller, its sunward faces warm gold and pink; a huge ringed gas giant planet (cream, tan and rust-orange bands, a thin bright ring crossing diagonally) hangs high in the sky, softly hazed"),
    (240, 275, "the low golden sun, a soft bright glowing disc half veiled by towering sunlit cumulus with brilliant golden rims and lavender undersides; the mountains beneath it silhouetted in warm haze"),
    (275, 325, "the valley opens flat toward the west: golden haze, the braided river a silvery thread winding into the distance, low blue ranges at the horizon; the sky golden near the sun fading to blue"),
    (325, 380, "across the valley the brown-green Avral range with dark spruce streaks down its gullies and a few snowy tops, moderate height, blue sky with scattered cumulus"),
]


LANDMARKS = [(205, 23, 'the gas giant planet (about 300 px across)'), (250, 26, 'the sun disc')]


def band_text(a0):
    """describe what lies across a slice starting at azimuth a0 (100 deg wide), as x positions"""
    parts = []
    for az, el, what in LANDMARKS:
        for shift in (-360, 0, 360):
            f = (az + shift - a0) / COV
            if 0.02 < f < 0.98:
                parts.append(f"{what} is centred at {round(f * 100)}% of the width and {round((HOR - el * PPD) / H * 100)}% of the height from the top")
    for lo, hi, desc in BANDS:
        for shift in (-360, 0, 360):
            l, h = lo + shift, hi + shift
            s, e = max(l, a0), min(h, a0 + COV)
            if e > s:
                parts.append(f"from {round((s - a0) / COV * 100)}% to {round((e - a0) / COV * 100)}% of the width: {desc}")
    return "; ".join(parts)


def run_codex(name, inp, prompt):
    out = os.path.join(HERE, f'{name}.png')
    if os.path.exists(out):
        return out
    log = open(os.path.join(HERE, f'{name}.log'), 'a')
    args = ['codex', 'exec', '-m', 'gpt-6-sol', '-s', 'danger-full-access', '--skip-git-repo-check', '-C', HERE]
    for i in inp:
        args += ['-i', i]
    args += ['--', prompt + f" ... Generate exactly one 1536x1024 landscape image with your built-in image_gen tool, then copy the "
             f"file path YOUR image_gen call reported (other runs write to the same folder at the same time, so never 'the newest file') "
             f"to {out} , do not touch any other file."]
    for attempt in range(3):
        subprocess.run(args, stdout=log, stderr=log)
        if os.path.exists(out):
            break
        time.sleep(5)
    im = Image.open(out).convert('RGB')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
        im.save(out)
    return out


def composite(name, known):
    """known = list of (image_path, src_x0, src_x1, dst_x0): paste strips of earlier slices, grey elsewhere"""
    c = Image.new('RGB', (W, H), (128, 128, 128))
    for p, s0, s1, d0 in known:
        c.paste(Image.open(p).convert('RGB').crop((s0, 0, s1, H)), (d0, 0))
    path = os.path.join(HERE, f'{name}.in.png')
    c.save(path)
    return path


def extend(name, a0, known, grey_desc):
    inp = composite(name, known)
    prompt = (f"The attached image is part of a painted panorama with a flat grey area ({grey_desc}). EDIT it: keep every painted pixel "
              f"exactly as it is and paint the grey area so it continues the painting seamlessly — same horizon height (68% from the top), "
              f"same light, same haze, same brushwork and palette, clouds and ridges flowing across the join with no visible seam. "
              f"{LAYOUT} What the whole slice shows, left to right: {band_text(a0)}. {STYLE}")
    return run_codex(name, [inp, os.path.join(REF, 'mockup-2-fp-left.jpg')], prompt)


def main(step):
    A = os.path.join(HERE, 'A.png')
    if step == 'seed':
        prompt = (f"Use the attached screenshots ONLY as style and colour references for their sky, clouds, planet and snow mountains "
                  f"(ignore their HUD, bow, arm, foreground, yurts, river and trees). {LAYOUT} What the slice shows, left to right: "
                  f"{band_text(170)}. {STYLE}")
        run_codex('A', [os.path.join(REF, 'mockup-1-fp-front.jpg'), os.path.join(REF, 'mockup-2-fp-left.jpg')], prompt)
    elif step == 'left':
        # BL covers 120..220: its right half (170..220) = A's left half
        BL = extend('BL', 120, [(A, 0, W // 2, W // 2)], 'the left half')
        CL = extend('CL', 70, [(BL, 0, W // 2, W // 2)], 'the left half')
        extend('DL', 20, [(CL, 0, W // 2, W // 2)], 'the left half')
    elif step == 'right':
        BR = extend('BR', 220, [(A, W // 2, W, 0)], 'the right half')
        extend('CR', 270, [(BR, W // 2, W, 0)], 'the right half')
    elif step == 'close':
        CR = os.path.join(HERE, 'CR.png'); DL = os.path.join(HERE, 'DL.png')
        # close covers 330..430: CR (270..370) gives 330..370 = CR x 60%..100% -> close x 0..40%; DL (20..120) gives 380..430 = DL x 0..50% -> close x 50..100%
        k = lambda f: int(round(f * W))
        extend('CLOSE', 330, [(CR, k(0.6), W, 0), (DL, 0, k(0.5), k(0.5))], 'a vertical band from 40% to 50% of the width')
    elif step == 'stitch':
        stitch()


def stitch():
    """place every slice on a 360-degree strip, feathering overlaps (newer slices' fresh halves win in their fresh region)"""
    TW = int(round(360 * PPD))
    acc = np.zeros((H, TW, 3), np.float64); wsum = np.zeros((H, TW, 1), np.float64)
    # (name, a0, fresh-range in slice fraction): weight peaks in the fresh region, low where the slice copies a neighbour
    plan = [('A', 170, (0.0, 1.0)), ('BL', 120, (0.0, 0.5)), ('CL', 70, (0.0, 0.5)), ('DL', 20, (0.0, 0.5)),
            ('BR', 220, (0.5, 1.0)), ('CR', 270, (0.5, 1.0)), ('CLOSE', 330, (0.4, 0.5))]
    xs = np.arange(W) / W
    for name, a0, (f0, f1) in plan:
        p = os.path.join(HERE, f'{name}.png')
        if not os.path.exists(p):
            print('missing', name); continue
        im = np.asarray(Image.open(p).convert('RGB').resize((W, H))).astype(np.float64)
        # weight: 1 inside the fresh range, falling to 0.05 over 12% outside it (the copied part blends the seam)
        d = np.maximum(f0 - xs, 0) + np.maximum(xs - f1, 0)
        w = np.clip(1 - d / 0.12, 0.05, 1.0) ** 2
        w[(xs < 0.01) | (xs > 0.99)] = 0.0
        col0 = int(round(a0 * PPD))
        for i in range(W):
            c = (col0 + i) % TW
            acc[:, c] += im[:, i] * w[i]; wsum[:, c] += w[i]
    out = (acc / np.maximum(wsum, 1e-6)).clip(0, 255).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(HERE, 'panorama.png'))
    print('panorama', out.shape)


if __name__ == '__main__':
    main(sys.argv[1])
