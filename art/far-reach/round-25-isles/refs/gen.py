"""Sky Reach top-10 row 1 (E407): hero floating islands from the mockups, one island each on white, in parallel.

  python3 gen.py [names...]      # -> ref-<name>.png here; then BiRefNet cutout -> Hunyuan3D-2 turbo + paint -> finish.sh

The round-21 isles were flat grassy tops over a keel (the council and the zoom-out audit: 'pancakes, extruded mesas').
These follow the mockups' islands: rounded rock masses with overhangs, bushy canopies spilling over the rim, heavy root
and vine curtains, waterfalls where the mockups show them. Each prompt names the island in its mockup.
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
A = os.path.join(REPO, 'art/far-reach/round-11-review/mockup-A-spawn-look.jpg')
C = os.path.join(REPO, 'art/far-reach/round-18-council-mockups/mockup-C-hands-fan-painterly.jpg')
D = os.path.join(REPO, 'art/far-reach/round-11-review/mockup-D-crown-arena.jpg')
P = os.path.join(REPO, 'art/far-reach/round-1-proposals/B-sky-reach.jpg')
REFS = {'mass': A, 'canopy': A, 'falls': P, 'spire': C, 'twin': A, 'shelf': D}
STYLE = ("Painterly-stylized game-asset concept matching the floating islands in the attached mockup (Genshin Impact / Studio "
         "Ghibli finish): soft visible brush work, rich surface detail, clean readable shapes. Soft EVEN warm studio light from the "
         "front-left, gentle shading, no strong rim light. The WHOLE island fully in frame with a generous margin all round, on a "
         "PURE WHITE background (#FFFFFF), nothing else in the image: no sky, no clouds, no water below, no ground, no scenery, no "
         "text, no watermark.")
COMMON = ("NOT a flat-topped mesa: the top is a ROUNDED, UNEVEN mound, lumpy with mossy boulders and DENSE round bushy shrubs and "
          "small leafy trees whose canopies SPILL OVER the rim in heavy overhanging lips. The rock mass bulges OUT below the rim "
          "(overhangs) before tapering into a rough rooted underside of warm sandy-grey and ochre stratified rock with cracks, "
          "ledges and green moss. A thick CURTAIN of hanging roots and trailing vines and moss hangs from under the overhangs all "
          "round, many strands long, some reaching well below the island. Seen from the SIDE at eye level, only slightly from "
          "above, so the whole underside and the curtain are visible. ")
PROMPTS = {
    'mass': ("Paint ONE 1024x1024 image of a SINGLE big floating sky island like the large back-left one over the windmill in the "
             "attached mockup: a broad rounded rock mass about as wide as it is deep, its keel tapering to a blunt rooted point. " + COMMON + STYLE),
    'canopy': ("Paint ONE 1024x1024 image of a SINGLE floating sky island like the right-hand one over the windmill in the attached "
               "mockup: a wide island whose crown is a dense dome of bushy foliage and small trees overhanging every edge, its rock "
               "underside breaking into several hanging spurs of different lengths under a long root curtain. " + COMMON + STYLE),
    'falls': ("Paint ONE 1024x1024 image of a SINGLE floating sky island like the mid-distance ones beside the windmill isle in the "
              "attached mockup: a rounded rocky island with bushes on top and ONE slender white waterfall pouring off its rim and "
              "falling down past its side in a long ribbon of water and spray. " + COMMON + STYLE),
    'spire': ("Paint ONE 1024x1024 image of a SINGLE smaller, taller floating sky island like the right-hand one in the attached "
              "mockup: a tall rock that is deeper than it is wide, crowned with a tuft of bushy shrubs, a jagged tapering underside. " + COMMON + STYLE),
    'twin': ("Paint ONE 1024x1024 image of a SINGLE floating sky island made of TWO rounded rock lobes grown together side by side, "
             "like the overlapping cluster over the windmill in the attached mockup, one lobe higher than the other, both crowned "
             "with bushes and small trees spilling over. " + COMMON + STYLE),
    'shelf': ("Paint ONE 1024x1024 image of a SINGLE floating sky island like the small distant ones in the attached mockup: a "
              "compact rounded island with a few small dark pines and bushes on its top and a short thick root curtain. " + COMMON + STYLE),
}
TASK = " ... TASK FOR CODEX: generate exactly ONE image with your built-in image_gen tool. One generation only. Then stop; do not create or modify any file."


def one(name):
    out = os.path.join(HERE, f'ref-{name}.png')
    if os.path.exists(out): return name, 'cached'
    logp = os.path.join(HERE, f'{name}.log')
    for _ in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '-i', REFS[name]], stdin=subprocess.PIPE, stdout=log, stderr=log)
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
        if got: shutil.copy(got, out); return name, 'ok'
    return name, 'failed'


if __name__ == '__main__':
    names = sys.argv[1:] or list(PROMPTS)
    with ThreadPoolExecutor(len(names)) as ex:
        for n, st in ex.map(one, names): print(n, st, flush=True)
