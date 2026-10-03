"""Signal Dunes (E407 row 5): one seamless 360-degree painted dusk sky per dusk stage, outpainted with codex image_gen.

The method is Sky Reach's loop 4 (art/far-reach/round-14-loop-4/pano/pano.py, after Nalati's round 6): 1536x1024
slices of 100 degrees each (15.36 px/deg both ways), a seed slice centred on the afterglow, two chains outpainting from
it, one closing slice, a feathered stitch. What changes for Signal Dunes: the land is real 3-D down to the horizon, so a
slice paints SKY ONLY above a low, level horizon of far dune silhouettes, and there are three stages (the dusk deepens
with the quest, look/dusk.ts), each its own panorama with its own mockup references.

Heading convention (look/sky.ts reads the same): heading 0 = the spawn's forward view (-z, toward the tower),
90 = right (+x), 180 = behind (+z), 270 = left (-x). The afterglow (look/sky.ts SUN_GLOW) peaks at heading ~11.5, the
sun just set below the horizon there. The horizon is row HOR (88 % from the top): the strip spans +58.6 deg above it to
-8 deg below.

  A      320..420   seed (the afterglow)
  left   270..370 -> 220..320 -> 170..270     each keeps the right neighbour's known half, paints the new left half
  right  370..470 -> 420..520                 each keeps the left neighbour's known half, paints the new right half
  close  110..210                             both ends known (CR / DL), paints the middle

usage: python3 pano.py <early|mid|late> seed | left | right | close | stitch
Codex is not waited on to copy its file: the runner reads the run's session id from its log, polls
~/.codex/generated_images/<session id>/ and copies the PNG the moment it lands (AGENTS.md, Mockups).
"""
import os, subprocess, sys, time, glob, re
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, COV = 1536, 1024, 100.0
PPD = W / COV
HOR = int(H * 0.88)
GLOW = 11.5

STYLE = ("A painterly, cinematic video-game matte painting of a desert dusk sky: rich, luminous and clean, soft visible "
         "brushwork, smooth gradients with no banding, no noise, no grain, no murk; the colours of a real desert sunset.")
LAYOUT = ("This is one 100-degree slice of a seamless 360-degree panorama that wraps a game's sky. STRICT layout: the horizon is "
          "a perfectly level line at 88% of the image height from the top. Below it there is ONLY a thin band of very distant "
          "low dunes and hazy desert ranges in soft dark silhouette, no detail, no objects. Above it is painted SKY all the way "
          "to the top edge. Horizontally each 15 px is one degree of azimuth: keep the perspective of a wide cylindrical "
          "panorama, a level horizon, no vanishing point, no centred composition, no framing. NO foreground at all: no sand "
          "close up, no rocks, no plants, no tower, no buildings, no people, no creatures, no birds, no aircraft, no moon, no "
          "sun disc (the sun has just set), no text, no UI, no HUD, no border, no watermark.")

STAGES = {
    'early': {
        'ref': 'refs/ref-early.jpg',
        'what': "the first minutes after sunset (the golden-orange afterglow)",
        'bands': [
            (320, 355, "the afterglow rising from the left: a warm apricot and rose horizon; long flat bands of stratus and stratocumulus lit coral and gold on their undersides with dusky violet tops; the sky above turning dusty rose then violet"),
            (355, 390, "the brightest afterglow, where the sun has just set: a blazing orange-gold band along the horizon, hottest just above the horizon, fading up through apricot and salmon into dusty rose and then violet-blue; torn streaks of cloud lit fiery coral and orange from below, their tops dark violet"),
            (390, 430, "the glow fading to the right: a peach and salmon horizon, broken cloud streaks in coral and rose with violet shadows, the upper sky deepening to violet-blue"),
            (430, 500, "dusky rose horizon haze, a few long thin lavender cloud streaks, a violet-blue upper sky"),
            (500, 580, "the sky opposite the sunset: the earth's shadow, a band of deep slate blue-grey along the horizon under a soft pink belt of Venus, the upper sky dusky blue-violet with the first few faint stars"),
            (580, 650, "dusky violet-blue sky, a rose horizon haze, scattered small clouds in mauve with faint pink edges"),
            (650, 680, "the glow beginning on the right of this part: a warming rose and apricot horizon, coral-lit cloud bands"),
        ],
    },
    'mid': {
        'ref': 'refs/ref-mid.jpg',
        'what': "the deepening dusk (the afterglow narrowing, the blue hour beginning)",
        'bands': [
            (320, 355, "a rose and deep orange horizon under the afterglow; long flat cloud streaks now dark plum with thin orange-red undersides; the sky above violet turning indigo; faint stars high up"),
            (355, 390, "the afterglow, narrower now: a deep orange to red-orange band low on the horizon, hottest just above it, fading quickly through dusky rose into violet and deep indigo; a few cloud streaks dark plum silhouettes with thin glowing red-orange rims; stars beginning high up"),
            (390, 430, "a dusky rose horizon fading to the right, dark plum cloud streaks with faint rims, violet-indigo sky with scattered small stars"),
            (430, 500, "a faint purple-rose horizon, deep indigo sky with scattered crisp small stars, one or two thin dark cloud streaks"),
            (500, 580, "the sky opposite the sunset: a deep blue-grey horizon band, indigo to navy sky with many small crisp stars"),
            (580, 650, "indigo sky full of small crisp stars, a faint violet horizon, a few dark thin clouds"),
            (650, 680, "the horizon warming toward the afterglow: dusky rose, dark plum cloud streaks"),
        ],
    },
    'late': {
        'ref': 'refs/ref-late.jpg',
        'what': "the late blue hour (the last of the afterglow, night falling)",
        'bands': [
            (320, 355, "a thin warm salmon line along the horizon, quickly fading into deep violet and indigo; small crisp stars"),
            (355, 390, "the last of the afterglow: a thin glowing orange-salmon band hugging the horizon, fading up through a short dusky pink-violet into deep indigo-navy; very few clouds, thin dark silhouettes; many small crisp white stars above"),
            (390, 430, "a thin pink-violet horizon line, deep indigo-navy sky full of small crisp stars"),
            (430, 500, "a dark navy night sky full of small crisp white stars and a faint band of the milky way, a faint purple horizon"),
            (500, 580, "the darkest part of the sky, opposite the sunset: deep navy full of small crisp stars, the faint milky way rising from the horizon, a dark blue-grey horizon band"),
            (580, 650, "dark navy sky full of small crisp stars, a faint violet horizon"),
            (650, 680, "the horizon warming toward the afterglow: a thin dusky violet-pink line, indigo above with stars"),
        ],
    },
}


def band_text(stage, a0):
    """describe what lies across a slice starting at heading a0 (100 deg wide), as x positions"""
    parts = []
    for lo, hi, desc in STAGES[stage]['bands']:
        for shift in (-720, -360, 0, 360):
            l, h = lo + shift, hi + shift
            s, e = max(l, a0), min(h, a0 + COV)
            if e > s:
                parts.append(f"from {round((s - a0) / COV * 100)}% to {round((e - a0) / COV * 100)}% of the width: {desc}")
    for shift in (-360, 0, 360):
        f = (GLOW + 360 + shift - a0) / COV
        if 0.02 < f < 0.98:
            parts.append(f"the afterglow's hottest point is just above the horizon at {round(f * 100)}% of the width")
    return "; ".join(parts)


def run_codex(dirp, name, inp, prompt):
    out = os.path.join(dirp, f'{name}.png')
    if os.path.exists(out):
        return out
    logp = os.path.join(dirp, f'{name}.log')
    full = prompt + (" ... TASK FOR CODEX: generate exactly ONE 1536x1024 landscape image with your built-in image_gen tool (use the "
                     "attached images as described). One generation only. Then stop; do not create or modify any file.")
    for attempt in range(3):
        log = open(logp, 'a')
        args = ['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', dirp, '--add-dir', os.path.expanduser('~/.codex/generated_images')]
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


def composite(dirp, name, known):
    """known = list of (image_path, src_x0, src_x1, dst_x0): paste strips of earlier slices, grey elsewhere"""
    c = Image.new('RGB', (W, H), (128, 128, 128))
    for p, s0, s1, d0 in known:
        c.paste(Image.open(p).convert('RGB').crop((s0, 0, s1, H)), (d0, 0))
    path = os.path.join(dirp, f'{name}.in.png')
    c.save(path)
    return path


def extend(stage, dirp, name, a0, known, grey_desc):
    inp = composite(dirp, name, known)
    prompt = (f"The first attached image is part of a painted panorama with a flat grey area ({grey_desc}). EDIT it: keep every "
              f"painted pixel exactly as it is and paint the grey area so it continues the painting seamlessly: the same horizon "
              f"height (88% from the top), the same light, colours, brushwork and star density, the gradients and cloud streaks "
              f"flowing across the join with no visible seam. The second attached image is a colour reference only (game "
              f"screenshots; ignore their HUD, hands, tower and sand). The sky is {STAGES[stage]['what']}. {LAYOUT} What the whole "
              f"slice shows, left to right: {band_text(stage, a0)}. {STYLE}")
    return run_codex(dirp, name, [inp, os.path.join(HERE, STAGES[stage]['ref'])], prompt)


def main(stage, step):
    dirp = os.path.join(HERE, stage)
    os.makedirs(dirp, exist_ok=True)
    A = os.path.join(dirp, 'A.png')
    if step == 'seed':
        prompt = (f"Use the attached image ONLY as a colour and mood reference for its sky (game screenshots; ignore their HUD, "
                  f"hands, whip, tower, creatures and sand). The sky is {STAGES[stage]['what']}. {LAYOUT} What the slice shows, "
                  f"left to right: {band_text(stage, 320)}. {STYLE}")
        run_codex(dirp, 'A', [os.path.join(HERE, STAGES[stage]['ref'])], prompt)
    elif step == 'left':
        BL = extend(stage, dirp, 'BL', 270, [(A, 0, W // 2, W // 2)], 'the left half')
        CL = extend(stage, dirp, 'CL', 220, [(BL, 0, W // 2, W // 2)], 'the left half')
        extend(stage, dirp, 'DL', 170, [(CL, 0, W // 2, W // 2)], 'the left half')
    elif step == 'right':
        BR = extend(stage, dirp, 'BR', 370, [(A, W // 2, W, 0)], 'the right half')
        extend(stage, dirp, 'CR', 420, [(BR, W // 2, W, 0)], 'the right half')
    elif step == 'close':
        CR = os.path.join(dirp, 'CR.png'); DL = os.path.join(dirp, 'DL.png')
        # close covers 110..210 (= 470..570): CR (420..520) gives 470..520 = CR x 50%..100% -> close x 0..50%;
        # DL (170..270) gives 170..210 = DL x 0..40% -> close x 60..100%
        k = lambda f: int(round(f * W))
        extend(stage, dirp, 'CLOSE', 110, [(CR, k(0.5), W, 0), (DL, 0, k(0.4), k(0.6))], 'a vertical band from 50% to 60% of the width')
    elif step == 'stitch':
        stitch(dirp)


def stitch(dirp):
    """place every slice on a 360-degree strip (x 0 = heading 0), feathering overlaps (fresh halves win)"""
    TW = int(round(360 * PPD))
    acc = np.zeros((H, TW, 3), np.float64); wsum = np.zeros((H, TW, 1), np.float64)
    plan = [('A', 320, (0.0, 1.0)), ('BL', 270, (0.0, 0.5)), ('CL', 220, (0.0, 0.5)), ('DL', 170, (0.0, 0.5)),
            ('BR', 370, (0.5, 1.0)), ('CR', 420, (0.5, 1.0)), ('CLOSE', 110, (0.3, 0.8), 0.25)]
    xs = np.arange(W) / W
    for name, a0, (f0, f1), *feather in plan:
        p = os.path.join(dirp, f'{name}.png')
        if not os.path.exists(p):
            print('missing', name); continue
        im = np.asarray(Image.open(p).convert('RGB').resize((W, H))).astype(np.float64)
        d = np.maximum(f0 - xs, 0) + np.maximum(xs - f1, 0)
        # the closing slice repaints its known ends a little, so it fades in over a wider band (a 0.12 feather left a seam at 158 deg)
        w = np.clip(1 - d / (feather[0] if feather else 0.12), 0.05, 1.0) ** 2
        # taper each slice's own edges (Sky Reach: a hard 0 -> 1 weight step left a seam)
        w = w * np.clip(xs / 0.08, 0, 1) ** 2 * np.clip((1 - xs) / 0.08, 0, 1) ** 2 + 1e-4
        col0 = int(round(a0 * PPD))
        for i in range(W):
            c = (col0 + i) % TW
            acc[:, c] += im[:, i] * w[i]; wsum[:, c] += w[i]
    out = (acc / np.maximum(wsum, 1e-6)).clip(0, 255).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(dirp, 'panorama.png'))
    print('panorama', out.shape)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
