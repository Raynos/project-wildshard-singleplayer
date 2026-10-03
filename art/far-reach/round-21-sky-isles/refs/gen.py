"""Sky Reach's decorative floating islands (E392/E399): codex image_gen references, one island each on white, in parallel.

  python3 gen.py [names...]      # -> ref-<name>.png here (then JPEG); Hunyuan3D-2 turns each into a textured model

  cone    a classic floating island: a broad grassy top, the keel tapering to one point (mockup A's left cluster)
  spurs   a wider island whose underside hangs in several rock spurs and stalactites (mockup A's right cluster)
  crag    a smaller, taller island with a rocky outcrop on its top (proposal B's mid-distance isles)
No trees in the models: the shard's card firs stand on their tops (world/build.ts), as on the playable isles.
The PNG is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
MOCK_A = os.path.join(REPO, 'art/far-reach/round-11-review/mockup-A-spawn-look.jpg')
REFS = {'cone': MOCK_A, 'spurs': MOCK_A, 'crag': os.path.join(REPO, 'art/far-reach/round-1-proposals/B-sky-reach.jpg')}
STYLE = ("Painterly-stylized game-asset concept like the floating islands in the attached mockup (Genshin Impact / Studio Ghibli "
         "finish): soft visible brush work, rich surface detail, clean readable shapes. Soft EVEN warm studio light from the front-left, "
         "gentle shading, no strong rim light. The whole island fully in frame with a margin all round, on a PURE WHITE background "
         "(#FFFFFF), nothing else in the image: no sky, no clouds, no water, no ground, no scenery, no trees, no text, no watermark.")
COMMON = ("The top is a THICK lush carpet of green grass and moss with a few low round bushes and wild flowers, the turf spilling "
          "over the rim in soft overhanging lips all the way round. Below it the keel: warm sandy-grey and ochre rock with clear "
          "horizontal strata bands, cracks and ledges, patches of green moss. THICK hanging roots and long clumps of trailing moss "
          "hang from under the rim and from the keel, a few long ones reaching well below it. NO trees, no buildings, no waterfall. "
          "Seen from the SIDE at eye level, only very slightly from above, so the top shows as a thin green band and the whole "
          "underside is visible. ")
PROMPTS = {
    'cone': ("Paint ONE 1024x1024 image of a SINGLE floating sky island like the big ones over the windmill in the attached mockup: "
             "a broad flat almost round grassy top about one and a half times as wide as the island is deep, the rocky keel below it "
             "tapering like an upside-down cone to one rough point, its sides stepped by strata ledges. " + COMMON + STYLE),
    'spurs': ("Paint ONE 1024x1024 image of a SINGLE floating sky island like the right-hand one over the windmill in the attached "
              "mockup: a wide slightly oval grassy top about twice as wide as the island is deep, its underside breaking into four or "
              "five hanging rock spurs and stalactites of different lengths, the longest in the middle. " + COMMON + STYLE),
    'crag': ("Paint ONE 1024x1024 image of a SINGLE floating sky island like the mid-distance ones in the attached mockup: a smaller "
             "round grassy top with one low mossy rock outcrop rising at one side of it, the keel below a deep jagged wedge of "
             "stratified rock about as deep as the island is wide, tapering to a point a little off centre. " + COMMON + STYLE),
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
