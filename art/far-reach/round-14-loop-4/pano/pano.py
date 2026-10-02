"""Sky Reach (Gilded Air): outpaint ONE continuous 360-degree painted panorama with codex image_gen (loop 4, E374).

The Nalati round-6 method (art/nalati-grasslands/round-6-panorama/pano.py): 1536x1024 slices of 100 degrees each
(15.36 px/deg both ways), a seed slice centred on the sun, two chains outpainting from it, one closing slice, a feathered
stitch. What changes for Sky Reach: the viewer stands on a floating island ABOVE the clouds, so the eye-level horizon
is the far edge of a lit cloud sea, and the painting below it is cloud sea, not land.

Heading convention (look/sky.ts reads the same): heading 0 = the spawn's forward view (-z, toward the windmill isle),
90 = right (+x), 180 = behind (+z), 270 = left (-x). The sun (look/sun.ts SUN_DIR) is at heading ~351, ~8.7 deg up.
The eye-level horizon is row HOR (60 % from the top): the strip spans +40 deg above it to -26.7 deg below.

  A      300..400   seed (the sun)
  left   250..350 -> 200..300 -> 150..250     each keeps the right neighbour's known half, paints the new left half
  right  350..450 -> 400..500                 each keeps the left neighbour's known half, paints the new right half
  close  90..190                              both ends known (CR / DL), paints the middle

usage: python3 pano.py seed | left | right | close | stitch
Codex is not waited on to copy its file: the runner reads the run's session id from its log, polls
~/.codex/generated_images/<session id>/ and copies the PNG the moment it lands (AGENTS.md, Mockups).
"""
import os, subprocess, sys, time, glob, re, shutil
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
W, H, COV = 1536, 1024, 100.0
PPD = W / COV
HOR = int(H * 0.60)
REFS = [os.path.join(REPO, 'art/far-reach/round-1-proposals/B-sky-reach.jpg'),
        os.path.join(REPO, 'art/far-reach/round-13-loop-3/targets/target-H1-1-front.jpg')]

STYLE = ("Painterly stylized video-game matte painting in the 'Gilded Air' style: the luminous hand-painted look of Studio Ghibli "
         "background paintings and Genshin Impact sky concept art; soft visible brush strokes, rich warm golden-hour colours "
         "(gold, apricot, peach and rose in the light; soft lavender and dusty violet in the shade; a clear soft blue high up), "
         "towering volumetric cumulus with brilliant gold rims and lavender-mauve undersides, crisp readable silhouettes, lots of "
         "fine detail, no grey, no murk.")
LAYOUT = ("This is one 100-degree slice of a seamless 360-degree panorama that wraps a game's sky, seen from high above a sea of "
          "clouds. STRICT layout: the eye-level horizon is a perfectly level line at 60% of the image height from the top: it is "
          "the far edge of a vast sea of soft billowing clouds. Below the horizon there is ONLY that cloud sea, seen from above, "
          "its billows growing larger toward the bottom edge, lit gold and peach on their tops with lavender hollows. Above the "
          "horizon is painted sky all the way to the top edge, with banks of cumulus rising from the cloud sea. Horizontally each "
          "15 px is one degree of azimuth: keep the perspective of a wide cylindrical panorama, level horizon, no vanishing point, "
          "no centred composition, no framing. NO foreground at all: no grass, no rocks, no nearby island, no bridge, no windmill, "
          "no people, no creatures, no birds, no text, no UI, no border, no watermark. Any floating island is FAR away and small.")

BANDS = [  # (from, to, what) in headings
    (300, 330, "warm apricot sky; a tall bank of cumulus with gold-lit edges rising from the cloud sea; one far floating island, small, a dark-lavender rock keel tapering to a point, a grassy top with two tiny pines, a thread of waterfall falling into the clouds"),
    (330, 375, "the low golden sun just above the cloud-sea horizon: a soft blazing white-gold disc with a wide warm glow and gentle sun rays, towering cumulus either side with brilliant gold rims and peach-lit faces, the cloud sea below it glittering gold"),
    (375, 420, "rose-gold sky with big sunlit cumulus; two far floating islands at different heights, small and hazy, their keels lavender in the haze"),
    (420, 480, "peach and pink cumulus banks rising from a lit cloud sea, the sky above them clearing to soft blue; one very distant tiny floating island"),
    (480, 560, "the sky away from the sun: a soft blue-lavender upper sky with pink-tinged cumulus tops and lavender undersides; the cloud sea in soft rose and lavender; a medium far floating island with a waterfall"),
    (560, 600, "soft lavender and pink cumulus, the horizon haze warming toward peach; scattered small distant floating islands"),
    (600, 660, "the sky warming again toward the sun: apricot-pink cumulus with gold edges, a large but far floating island with tiny trees, a ruined white tower and a long waterfall into the cloud sea"),
]
LANDMARKS = [(351, 8.7, 'the sun disc (about 70 px across with a wide glow)')]


def band_text(a0):
    """describe what lies across a slice starting at heading a0 (100 deg wide), as x positions"""
    parts = []
    for az, el, what in LANDMARKS:
        for shift in (-360, 0, 360):
            f = (az + shift - a0) / COV
            if 0.02 < f < 0.98:
                parts.append(f"{what} is centred at {round(f * 100)}% of the width and {round((HOR - el * PPD) / H * 100)}% of the height from the top")
    for lo, hi, desc in BANDS:
        for shift in (-720, -360, 0, 360):
            l, h = lo + shift, hi + shift
            s, e = max(l, a0), min(h, a0 + COV)
            if e > s:
                parts.append(f"from {round((s - a0) / COV * 100)}% to {round((e - a0) / COV * 100)}% of the width: {desc}")
    return "; ".join(parts)


def run_codex(name, inp, prompt):
    out = os.path.join(HERE, f'{name}.png')
    if os.path.exists(out):
        return out
    logp = os.path.join(HERE, f'{name}.log')
    full = prompt + (" ... TASK FOR CODEX: generate exactly ONE 1536x1024 landscape image with your built-in image_gen tool (use the "
                     "attached images as described). One generation only. Then stop; do not create or modify any file.")
    for attempt in range(3):
        log = open(logp, 'a')
        args = ['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '--add-dir', os.path.expanduser('~/.codex/generated_images')]
        for i in inp:
            args += ['-i', i]
        p = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=log, stderr=log)
        p.stdin.write(full.encode()); p.stdin.close()
        sid, t0, got = None, time.time(), None
        while time.time() - t0 < 900:
            time.sleep(5)
            if sid is None:
                m = re.search(r'session id:\s*([0-9a-f-]+)', open(logp).read())
                sid = m.group(1) if m else None
            if sid:
                pngs = glob.glob(os.path.expanduser(f'~/.codex/generated_images/{sid}/*.png'))
                if pngs:
                    time.sleep(3); got = pngs[0]; break
            if p.poll() is not None and sid is None:
                break
        if p.poll() is None:
            p.kill()
        if got:
            im = Image.open(got).convert('RGB')
            if im.size != (W, H):
                im = im.resize((W, H), Image.LANCZOS)
            im.save(out)
            return out
        print(name, 'attempt', attempt, 'failed', flush=True)
    raise SystemExit(f'{name}: no image')


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
    prompt = (f"The first attached image is part of a painted panorama with a flat grey area ({grey_desc}). EDIT it: keep every "
              f"painted pixel exactly as it is and paint the grey area so it continues the painting seamlessly: the same horizon "
              f"height (60% from the top), the same light, haze, brushwork and palette, clouds and the cloud sea flowing across the "
              f"join with no visible seam. The second attached image is a style reference only. {LAYOUT} What the whole slice "
              f"shows, left to right: {band_text(a0)}. {STYLE}")
    return run_codex(name, [inp, REFS[0]], prompt)


def main(step):
    A = os.path.join(HERE, 'A.png')
    if step == 'seed':
        prompt = (f"Use the attached images ONLY as style and colour references for their sky, sun, clouds, cloud sea and far "
                  f"floating islands (ignore their HUD, fan, hand, grass, bridge, windmill and near islands). {LAYOUT} What the "
                  f"slice shows, left to right: {band_text(300)}. {STYLE}")
        run_codex('A', REFS, prompt)
    elif step == 'left':
        BL = extend('BL', 250, [(A, 0, W // 2, W // 2)], 'the left half')
        CL = extend('CL', 200, [(BL, 0, W // 2, W // 2)], 'the left half')
        extend('DL', 150, [(CL, 0, W // 2, W // 2)], 'the left half')
    elif step == 'right':
        BR = extend('BR', 350, [(A, W // 2, W, 0)], 'the right half')
        extend('CR', 400, [(BR, W // 2, W, 0)], 'the right half')
    elif step == 'close':
        CR = os.path.join(HERE, 'CR.png'); DL = os.path.join(HERE, 'DL.png')
        # close covers 90..190 (= 450..550): CR (400..500) gives 450..500 = CR x 50%..100% -> close x 0..50%;
        # DL (150..250) gives 150..190 = DL x 0..40% -> close x 60..100%
        k = lambda f: int(round(f * W))
        extend('CLOSE', 90, [(CR, k(0.5), W, 0), (DL, 0, k(0.4), k(0.6))], 'a vertical band from 50% to 60% of the width')
    elif step == 'stitch':
        stitch()


def stitch():
    """place every slice on a 360-degree strip (x 0 = heading 0), feathering overlaps (fresh halves win)"""
    TW = int(round(360 * PPD))
    acc = np.zeros((H, TW, 3), np.float64); wsum = np.zeros((H, TW, 1), np.float64)
    plan = [('A', 300, (0.0, 1.0)), ('BL', 250, (0.0, 0.5)), ('CL', 200, (0.0, 0.5)), ('DL', 150, (0.0, 0.5)),
            ('BR', 350, (0.5, 1.0)), ('CR', 400, (0.5, 1.0)), ('CLOSE', 90, (0.5, 0.6))]
    xs = np.arange(W) / W
    for name, a0, (f0, f1) in plan:
        p = os.path.join(HERE, f'{name}.png')
        if not os.path.exists(p):
            print('missing', name); continue
        im = np.asarray(Image.open(p).convert('RGB').resize((W, H))).astype(np.float64)
        d = np.maximum(f0 - xs, 0) + np.maximum(xs - f1, 0)
        w = np.clip(1 - d / 0.12, 0.05, 1.0) ** 2
        # taper each slice's own edges (a hard 0 -> 1 weight step left a seam at 151 deg)
        w = w * np.clip(xs / 0.08, 0, 1) ** 2 * np.clip((1 - xs) / 0.08, 0, 1) ** 2 + 1e-4
        col0 = int(round(a0 * PPD))
        for i in range(W):
            c = (col0 + i) % TW
            acc[:, c] += im[:, i] * w[i]; wsum[:, c] += w[i]
    out = (acc / np.maximum(wsum, 1e-6)).clip(0, 255).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(HERE, 'panorama.png'))
    print('panorama', out.shape)


if __name__ == '__main__':
    main(sys.argv[1])
