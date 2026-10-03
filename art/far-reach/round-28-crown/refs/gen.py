"""Sky Reach top-10 row 7 (E407): the crown arena as a carved set from mockup D: one object each on white (then BiRefNet,
Hunyuan3D-2). The dais keeps its code collider (layout DAIS); the stones keep theirs.

  python3 gen.py [names...]      # -> ref-<name>.png here
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
D = os.path.join(REPO, 'art/far-reach/round-11-review/mockup-D-crown-arena.jpg')
REFS = {'stone': D, 'stone-b': D, 'dais': D}
STYLE = ("Painterly-stylized game-asset concept matching the attached mockup (Genshin Impact / Studio Ghibli finish), rich stone "
         "detail, soft EVEN warm studio light, the WHOLE object in frame with a margin all round, on a PURE WHITE background "
         "(#FFFFFF), nothing else: no grass, no ground, no sky, no text, no watermark.")
PROMPTS = {
    'stone': ("Paint ONE 1024x1024 image of a SINGLE ancient standing stone like those ringing the arena in the attached mockup: a tall "
              "rough weathered grey menhir about three times as tall as it is wide, with lichen patches and moss at its foot, and one "
              "large SPIRAL wind rune CUT deep into its front face (a recessed carving, not raised). Seen from the front, at eye level. " + STYLE),
    'stone-b': ("Paint ONE 1024x1024 image of a SINGLE ancient standing stone like those ringing the arena in the attached mockup: a "
                "slightly leaning, cracked, irregular grey slab with a chipped top, pale lichen, and a SPIRAL rune with a short tail cut "
                "into its face. Seen from the front, at eye level. " + STYLE),
    'dais': ("Paint ONE 1024x1024 image of a SINGLE round carved stone dais like the one at the centre of the arena in the attached "
             "mockup: a wide low circular platform of fitted weathered grey stone slabs, a raised kerb of chipped blocks round its edge, "
             "one low step, and a large COMPASS ROSE inlaid in its top. Seen from the front and above at about 30 degrees, so the top "
             "and the edge both show. It is much wider than it is tall. " + STYLE),
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
