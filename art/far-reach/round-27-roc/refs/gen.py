"""Sky Reach top-10 row 8 (E407): the hero Storm Roc from mockup D, one bird on white (then BiRefNet, Hunyuan3D-2).

  python3 gen.py [names...]      # -> ref-<name>.png here

The council (round 12): head-on the Roc does not read as an eagle (no head or beak, a flat bar of wings, grey lumps for
feet). The model's wings must lie level along its left-right axis (the shard's auto-rig splits them by x), facing front.
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
D = os.path.join(REPO, 'art/far-reach/round-11-review/mockup-D-crown-arena.jpg')
REFS = {'eagle': D, 'eagle-b': D}
BIRD = ("a SINGLE colossal storm eagle like the Storm Roc in the attached mockup: a proud WHITE head with a big hooked YELLOW "
        "beak and fierce eyes, a white-and-cream breast, wings of layered slate-grey and white feathers with dark primaries "
        "spread FULLY OUT to both sides, LEVEL and SYMMETRIC like a soaring eagle, a fanned grey-and-white tail, strong yellow legs "
        "with black TALONS held FORWARD under the breast. ")
STYLE = ("Painterly-stylized game-asset concept matching the mockup (Genshin Impact / Studio Ghibli finish), rich feather detail, "
         "soft EVEN warm studio light, the WHOLE bird in frame with a margin all round, on a PURE WHITE background (#FFFFFF), "
         "nothing else: no sky, no clouds, no text, no watermark.")
PROMPTS = {
    'eagle': "Paint ONE 1024x1024 image of " + BIRD + "Seen from the FRONT, slightly from below, the head facing the viewer. " + STYLE,
    'eagle-b': "Paint ONE 1024x1024 image of " + BIRD + "Seen in a three-quarter view from the front-left, slightly from below. " + STYLE,
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
