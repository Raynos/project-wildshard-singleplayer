"""Sky Reach windmill textures (E392 loop 20, the windmill subagent): codex image_gen, one image each, in parallel.

  python3 gen.py [names...]      # -> <name>.png here (committed as <name>.jpg); then pack.py makes public/assets/far-reach/tex/mill-*.webp

  stone   a seamless tileable whitewashed rubble-stone wall, block courses, flat-on (the tower, wrapped round it)
  canvas  a worn, stained, patched sail canvas, flat-on (the sails' cloth)
  ivy     a sprite sheet of ivy sprays on magenta (alpha-cut leaf cards climbing the tower)
The reference is the H2 close-up target (art/far-reach/round-17-mockup-loop/targets/H2-1-front.jpg).
The PNG is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../..'))
REF = os.path.join(REPO, 'art/far-reach/round-17-mockup-loop/targets/H2-1-front.jpg')
STYLE = ("Painterly-realistic like the windmill in the attached mockup (Studio Ghibli / Genshin Impact background art, rich "
         "detail, soft brush work).")
PROMPTS = {
    'stone': ("Paint ONE 1024x1024 SEAMLESS TILEABLE texture (it must tile with no visible seam on all four sides), seen straight "
              "on, flat, like a material swatch: the WHITEWASHED RUBBLE STONE wall of the windmill tower in the attached image. "
              "Irregular roughly-squared stones laid in clear horizontal COURSES (about 9 courses top to bottom, each stone 1.5 to 3 "
              "times as wide as tall), every stone a slightly different off-white / cream / pale grey tone, the old lime wash worn "
              "thin on some stones showing warm grey stone beneath, recessed darker grey-brown mortar joints between every stone, a "
              "few chips, faint grey weather streaks and small lichen spots. Even, flat, soft lighting (it is a material, not a "
              "scene): no single big shadow, no vignette, no plants, no windows, no horizon. " + STYLE + " No text."),
    'canvas': ("Paint ONE 1024x1024 image, seen straight on, flat, filling the whole square edge to edge: a weathered windmill SAIL "
               "CANVAS like the sails in the attached image. Coarse cream-beige woven sailcloth, sun-bleached, with brown water "
               "stains and tide marks, darker grime toward the bottom edge, two or three sewn-on patches of slightly different tone "
               "with visible stitching, faint vertical seams where the cloth strips are joined, small frayed spots. Even, flat, soft "
               "lighting (a material, not a scene): no frame, no wood, no sky, no shadow, no vignette. " + STYLE + " No text."),
    'ivy': ("Paint ONE 1024x1024 image: a sprite sheet of 4 separate climbing IVY sprays in a 2 x 2 grid, each spray filling its "
            "own square cell, NOT touching the cell edges or each other, on a FLAT PURE MAGENTA background (#FF00FF everywhere "
            "outside the leaves, no gradient, no shadow on it). Each spray: seen flat-on as if pressed against a wall, a thin "
            "brown woody vine climbing from the BOTTOM edge of its cell upward and branching, covered with many small heart-shaped "
            "and three-lobed ivy leaves, dark green with lighter yellow-green sunlit leaves, some leaves overlapping. The sprays are "
            "vertical, taller than wide. No magenta inside the leaves. " + STYLE + " No text, no grid lines."),
}
TASK = " ... TASK FOR CODEX: generate exactly ONE image with your built-in image_gen tool. One generation only. Then stop; do not create or modify any file."


def one(name):
    out = os.path.join(HERE, f'{name}.png')
    if os.path.exists(out): return name, 'cached'
    logp = os.path.join(HERE, f'{name}.log')
    for _ in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '-i', REF], stdin=subprocess.PIPE, stdout=log, stderr=log)
        p.stdin.write((PROMPTS[name] + TASK).encode()); p.stdin.close()
        sid, t0, got = None, time.time(), None
        while time.time() - t0 < 900:
            time.sleep(5)
            if sid is None:
                m = re.search(r'session id:\s*([0-9a-f-]+)', open(logp).read()); sid = m.group(1) if m else None
            if sid:
                pngs = glob.glob(os.path.expanduser(f'~/.codex/generated_images/{sid}/*.png'))
                if pngs: time.sleep(3); got = pngs[0]; break
            if p.poll() is not None and sid is None: break
        if p.poll() is None: p.kill()
        if got:
            shutil.copy(got, out); return name, 'ok'
    return name, 'failed'


if __name__ == '__main__':
    names = sys.argv[1:] or list(PROMPTS)
    with ThreadPoolExecutor(len(names)) as ex:
        for n, st in ex.map(one, names): print(n, st, flush=True)
