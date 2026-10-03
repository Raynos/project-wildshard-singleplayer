"""Sky Reach top-10 row 2 (E407): the mockups' trees, one tree each on white, in parallel (then BiRefNet, Hunyuan3D-2).

  python3 gen.py [names...]      # -> ref-<name>.png here

The game's firs are identical cone cards; the mockups' conifers are natural, of varied height and lean, and bushy
broadleaf trees spill over the island edges.
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
A = os.path.join(REPO, 'art/far-reach/round-11-review/mockup-A-spawn-look.jpg')
C = os.path.join(REPO, 'art/far-reach/round-18-council-mockups/mockup-C-hands-fan-painterly.jpg')
D = os.path.join(REPO, 'art/far-reach/round-11-review/mockup-D-crown-arena.jpg')
REFS = {'pine-tall': A, 'pine-wide': C, 'pine-young': D, 'oak': A, 'bush': A}
STYLE = ("Painterly-stylized game-asset concept matching the trees in the attached mockup (Genshin Impact / Studio Ghibli finish): "
         "soft visible brush work, rich foliage detail in clumped layers, clean readable silhouette. Soft EVEN warm studio light from "
         "the front-left, gentle shading. The WHOLE tree fully in frame with a margin all round, standing on nothing (no ground, no "
         "grass, no pot), on a PURE WHITE background (#FFFFFF), nothing else: no sky, no scenery, no text, no watermark. Seen from "
         "the side at eye level.")
PROMPTS = {
    'pine-tall': ("Paint ONE 1024x1024 image of a SINGLE tall natural conifer like the pines beside the windmill in the attached "
                  "mockup: a slightly irregular spire of dark green needle tiers, the tiers drooping and uneven, a little lean, a "
                  "short brown trunk visible at the base. " + STYLE),
    'pine-wide': ("Paint ONE 1024x1024 image of a SINGLE broad, mature conifer like the ones on the windmill isle in the attached "
                  "mockup: wide layered branches in heavy clumps, warm sunlit tips on the upper tiers, darker inside, a thick trunk. " + STYLE),
    'pine-young': ("Paint ONE 1024x1024 image of a SINGLE small young pine like the ones at the arena's rim in the attached mockup: "
                   "a compact, slightly lopsided cone of dense dark-green needles on a short trunk. " + STYLE),
    'oak': ("Paint ONE 1024x1024 image of a SINGLE small broadleaf tree like the leafy trees crowning the floating islands in the "
            "attached mockup: a twisted short trunk and a rounded, lumpy canopy of bright green leaf clumps with gold-lit tops. " + STYLE),
    'bush': ("Paint ONE 1024x1024 image of a SINGLE dense round shrub like the bushes spilling over the island edges in the attached "
             "mockup: a lumpy mound of small green leaves and a few trailing tendrils, wider than it is tall. " + STYLE),
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
