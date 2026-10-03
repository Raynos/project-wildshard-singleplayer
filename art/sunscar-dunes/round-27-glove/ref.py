"""ref.py: the glove's reference for image-to-3D (round 27), from the mockups' hands, with codex image_gen (one image per
run, both runs in parallel). The runner copies the PNG the moment it lands (AGENTS.md, Mockups) and kills that codex.
usage: python3 ref.py"""
import glob, os, re, subprocess, threading, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PROMPT = ("The attached image is a crop of a game screenshot: a first-person right hand in a worn dark-brown leather glove "
          "gripping a short plaited leather whip handle, seen from behind and above the hand. Make a clean product-style "
          "reference of THAT glove for a 3D modeller: exactly ONE leather-gloved right fist, in the SAME pose and from the "
          "SAME view as the crop: the BACK of the hand and the knuckles toward the viewer, the four fingers wrapped round "
          "the short plaited handle (only their backs and the knuckle row showing), the thumb over them, the handle's top "
          "end showing above the fist and its bottom end below, and a flared leather gauntlet cuff running toward the lower "
          "right with a stitched seam at the wrist. Worn, scuffed, creased leather with stitched seams along the back of "
          "the hand. The whole glove and cuff in frame, nothing cut off. NO whip coil, NO cord, NO arm, NO sleeve, NO "
          "HUD, NO buttons, NO text: the glove alone, lit softly, on a plain pure white background, photographic detail.")


def run(name, src):
    out = os.path.join(HERE, f'{name}.png')
    if os.path.exists(out):
        return
    logp = os.path.join(HERE, f'{name}.log')
    full = PROMPT + (" ... TASK FOR CODEX: generate exactly ONE 1024x1024 square image with your built-in image_gen tool, "
                     "using the attached image as described. One generation only. Then stop; do not create or modify any file.")
    for attempt in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '--add-dir',
                              os.path.expanduser('~/.codex/generated_images'), '-i', os.path.join(HERE, src)],
                             stdin=subprocess.PIPE, stdout=log, stderr=log)
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
            Image.open(got).convert('RGB').save(out)
            return
        print(name, 'attempt', attempt, 'failed', flush=True)


if __name__ == '__main__':
    ts = [threading.Thread(target=run, args=a) for a in (('ref-D', 'mockup-D-hand.jpg'), ('ref-duskfire', 'mockup-duskfire-hand.jpg'))]
    for t in ts: t.start()
    for t in ts: t.join()
    print('refs done')
