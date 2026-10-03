"""Signal Dunes' pack horse reference (E399): codex image_gen, the horse on white, for Hunyuan3D-2.

  python3 gen.py [names...]      # -> ref-<name>.png here (then JPEG); Hunyuan3D-2 turns it into the textured horse

  horse   council mockup B's tethered horse (round-9-review/B-quest-logbook.jpg): a dusty bay desert pack horse,
          standing, side three-quarter, a faded red saddle blanket and a rope halter, the head slightly lowered
  horse2  the same, a second roll
The PNG is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = ("Stylized-realistic game-asset concept render (a modern console adventure game's prop sheet): clean readable shapes, "
         "natural proportions, matte surfaces, rich but simple surface detail. Soft EVEN studio light from the front, gentle "
         "shading, NO cast shadow, no rim light. The whole animal fully in frame with a margin on every side, all four hooves "
         "visible, on a PURE WHITE background (#FFFFFF), nothing else in the image: no ground plane, no shadow, no scenery, no "
         "rider, no text, no watermark.")
SUBJECT = ("ONE dusty BAY desert PACK HORSE (a sturdy medium horse: reddish-brown coat dulled with sand dust, black mane, black "
           "tail and black lower legs), STANDING calmly with all four legs straight and planted, its body seen in a THREE-QUARTER "
           "SIDE VIEW (the horse's left side and a little of its front toward the viewer), the head facing LEFT of the image and "
           "SLIGHTLY LOWERED. Anatomically correct: exactly four legs, correct joints and hooves, two ears. On its back a FADED "
           "RED woven SADDLE BLANKET with a simple pale stripe border, held by a plain leather girth strap; on its head a simple "
           "tan ROPE HALTER with a short loose lead rope hanging down. No saddle, no bags, no rider. ")
PROMPTS = {
    'horse': "Paint ONE 1024x1024 image of " + SUBJECT + STYLE,
    'horse2': "Paint ONE 1024x1024 image of " + SUBJECT + "The camera at the horse's shoulder height. " + STYLE,
}
TASK = " ... TASK FOR CODEX: generate exactly ONE image with your built-in image_gen tool. One generation only. Then stop; do not create or modify any file."


def one(name):
    out = os.path.join(HERE, f'ref-{name}.png')
    if os.path.exists(out): return name, 'cached'
    logp = os.path.join(os.environ.get('LOGDIR', HERE), f'{name}.log')
    for _ in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE], stdin=subprocess.PIPE, stdout=log, stderr=log)
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
