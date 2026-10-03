"""Signal Dunes' held glove-and-whip reference (E399): codex image_gen, the gauntlet glove on white, for Hunyuan3D-2.

  OUT=<dir> LOGDIR=<dir> python3 gen.py [names...]   # -> <OUT>/ref-<name>.png (then JPEG here); Hunyuan3D-2 makes the model

  glove   council mockup D's hand (round-9-review/D-hands-whip.jpg, its crop passed with -i): a worn dark-brown stitched
          leather glove with a long flared gauntlet cuff, the fist round a bullwhip handle, the plaited whip coiled in loops
          held up beside the fist, its tail hanging below; the arm cut off ~25 cm past the cuff; the mockup's angle
  glove2  the same, a second roll
  glove3  the same, the camera a little more behind the hand (more of the back of the hand and the cuff)
Picked: glove3 -> ref-glove.jpg (the flared cuff with a stitched rim reads best); glove2 -> ref-glove-b.jpg, glove -> ref-glove-c.jpg.
Model: BiRefNet cutout -> Hunyuan3D-2 turbo shape (60k f) + 2048 paint (no unpainted islands this time) -> hdpost.sh ratio 0.25
-> public/assets/sunscar-dunes/models/glove-hd2/glove-hd2.glb (15k tris, 1024 WebP, meshopt). Stills: still.jpg (mockup angle), still-side.jpg.
The PNG is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('OUT', HERE)
CROP = os.environ.get('CROP', os.path.join(HERE, '../round-9-review/D-hands-whip.jpg'))
STYLE = ("Realistic game-asset concept render (a modern console adventure game's first-person weapon prop sheet): the same worn "
         "leather look as the attached reference, clean readable shapes, rich surface detail. Soft EVEN studio light from the front, "
         "gentle shading, NO cast shadow, no rim light, no dramatic dark lighting: every part clearly lit and readable. The whole "
         "object fully in frame with a margin on every side, on a PURE WHITE background (#FFFFFF), nothing else in the image: no "
         "body, no shoulder, no scenery, no ground, no UI, no text, no watermark.")
SUBJECT = ("ONE single object: the RIGHT hand and lower forearm from the attached reference crop, shown alone. The hand wears a WORN "
           "DARK-BROWN LEATHER GLOVE, creased and scuffed, with clearly VISIBLE STITCHED SEAMS running along the back of the hand and "
           "along each finger. Over the wrist a LONG LEATHER GAUNTLET CUFF covers the wrist and the lower forearm, FLARING wider toward "
           "its open end, with a STITCHED border along its edge. The forearm inside the cuff ends in a clean flat cut about 25 cm past the "
           "cuff's edge (a plain round cut end of the same brown leather sleeve; NO bare arm, no shirt, no elbow, nothing beyond). The "
           "hand is a FIRM FIST gripping the short handle of a BULLWHIP: anatomically correct, exactly four fingers curled round the "
           "handle and one thumb wrapped over them. The whip is a tight DARK-BROWN HERRINGBONE-PLAITED leather braid: it is COILED into "
           "TWO OR THREE upright oval LOOPS, about as tall as the hand is long, held UP above and to the LEFT of the fist, and the whip's "
           "TAIL HANGS straight DOWN below the fist. ")
VIEW = ("Seen from the SAME angle as the attached reference crop: a three-quarter view onto the BACK of the hand, the knuckles toward "
        "the upper left, the cuff and forearm running down and away to the LOWER RIGHT, the coiled loops at the upper left. ")
PROMPTS = {
    'glove': "Paint ONE 1024x1024 image of " + SUBJECT + VIEW + STYLE,
    'glove2': "Paint ONE 1024x1024 image of " + SUBJECT + VIEW + STYLE,
    'glove3': "Paint ONE 1024x1024 image of " + SUBJECT + VIEW + "The camera a little further behind the hand, so the stitched back "
              "of the hand and the whole cuff face the viewer. " + STYLE,
}
TASK = " ... TASK FOR CODEX: generate exactly ONE image with your built-in image_gen tool, using the attached image as the reference. One generation only. Then stop; do not create or modify any file."


def one(name):
    out = os.path.join(OUT, f'ref-{name}.png')
    if os.path.exists(out): return name, 'cached'
    logp = os.path.join(os.environ.get('LOGDIR', OUT), f'{name}.log')
    for _ in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', OUT, '-i', CROP],
                             stdin=subprocess.PIPE, stdout=log, stderr=log)
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
