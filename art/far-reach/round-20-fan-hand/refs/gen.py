"""Sky Reach's fan-hand reference (E392/E399): codex image_gen, the gloved hand on white, for Hunyuan3D-2.

  python3 gen.py [names...]      # -> ref-<name>.png here (then JPEG); Hunyuan3D-2 turns it into the textured hand

  hand   mockup C's fan hand (round-18-council-mockups): a fingerless brown leather glove closed round the fan's grip stub,
         a tooled bracer with bronze studs, a wrapped linen sleeve; side three-quarter, the forearm level
  hand2  the same from a little more in front (the knuckles and the thumb over the fingers)
The PNG is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
MOCK = os.path.join(REPO, 'art/far-reach/round-18-council-mockups/mockup-C-hands-fan-painterly.jpg')
STYLE = ("Painterly-stylized game-asset concept like the attached mockup (Genshin Impact / Studio Ghibli finish): soft visible brush "
         "work, rich surface detail, clean readable shapes. Soft EVEN studio light from the front-left, gentle shading, no cast shadow, "
         "no strong rim light. The whole object fully in frame with a margin, on a PURE WHITE background (#FFFFFF), nothing else in "
         "the image: no ground, no body, no scenery, no text, no watermark.")
SUBJECT = ("a SINGLE disembodied RIGHT forearm and hand, the first-person weapon hand from the lower right of the attached "
           "mockup: the hand closed in a firm fist round a short straight vertical handle (a 12 cm dark-wood fan grip wrapped in dark "
           "cord, a bronze pivot cap on top, its ends sticking out above and below the fist; NO fan, only the handle). The hand wears a "
           "FINGERLESS dark-brown LEATHER GLOVE with visible stitching, the bare skin of the fingertips curled over the handle, the "
           "thumb laid over the index and middle fingers. Over the wrist a thick TOOLED brown leather BRACER with an embossed swirl "
           "pattern, two rows of small bronze studs and leather lacing. Behind the bracer the forearm is in a loose cream-white LINEN "
           "SLEEVE wrapped and bound with thin brown leather cords, ending in a clean flat cut a little below the elbow. The forearm is "
           "straight and LEVEL, running from the fist at the LEFT of the image to the cut sleeve at the RIGHT, ")
PROMPTS = {
    'hand': "Paint ONE 1024x1024 image of " + SUBJECT + "seen from the thumb side in a three-quarter view slightly from above. " + STYLE,
    'hand2': "Paint ONE 1024x1024 image of " + SUBJECT + "seen from the front three-quarter (the knuckles and the thumb toward the viewer), slightly from above. " + STYLE,
}
TASK = " ... TASK FOR CODEX: generate exactly ONE image with your built-in image_gen tool. One generation only. Then stop; do not create or modify any file."


def one(name):
    out = os.path.join(HERE, f'ref-{name}.png')
    if os.path.exists(out): return name, 'cached'
    logp = os.path.join(HERE, f'{name}.log')
    for _ in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '-i', MOCK], stdin=subprocess.PIPE, stdout=log, stderr=log)
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
