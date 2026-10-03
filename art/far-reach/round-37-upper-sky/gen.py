"""Sky Reach E410 #2 (C's upper sky): repaint the panorama's upper band over the hero views with lit cumulus.

  python3 gen.py <crop.jpg> <out dir> [n]     # n parallel takes (default 3) -> <out dir>/take-<i>.png

Every hero view (A, B, C, proposal B) faces heading 0-5 deg; C pitches up and its upper third shows the panorama's top
band (12-37 deg up), painted as a flat mauve cap, where mockups C and A have big sunlit golden-hour cumulus. The crop is
headings -48..+48 deg of art/far-reach/round-17-mockup-loop/panorama-warm.jpg (the shipped strip's source), rows 0-983,
scaled to 1536 x 1024. codex image_gen edits it with mockup C's and A's upper skies as references; merge.py feathers the
upper band of the chosen take back into the source and prep.py ships it.
"""
import glob, os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../..'))
crop, out = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
N = int(sys.argv[3]) if len(sys.argv) > 3 else 3
REF_C = os.path.join(out, 'ref-C.jpg')
REF_A = os.path.join(out, 'ref-A.jpg')
PROMPT = (
    "The FIRST attached image is a wide strip of a painted golden-hour sky panorama for a stylized painterly game "
    "(Genshin Impact / Studio Ghibli finish). The horizon is near the bottom third; the low sun glows at the lower middle. "
    "EDIT IT: repaint ONLY the UPPER 40 % of the image (everything above the level a little over the sun) into a sky full "
    "of BIG, VOLUMETRIC, SUNLIT CUMULUS cloud masses like the upper skies of the SECOND and THIRD attached images: heaped "
    "billowing cumulus with peach-gold sunlit crowns and edges, soft lavender-mauve shaded bellies, a few patches of soft "
    "blue sky between them, painterly brush work, the same warm palette and light direction as the rest of the strip (the "
    "sun is low, ahead, at the lower middle, so the clouds' lit sides face down and toward the centre). Make the cloud "
    "masses large and readable, several layers deep. Keep the LOWER 60 % EXACTLY as it is: the horizon, the sun, its glow "
    "and the cloud sea must not change. Blend the new upper sky softly into the unchanged lower part. The left and right "
    "edges continue into more sky (it is a crop of a 360 degree panorama), so do not frame or vignette them. "
    "No text, no border, no watermark, no islands, no birds, no objects: sky and clouds only. Keep the image size and "
    "aspect exactly (1536 x 1024).")
TASK = (" ... TASK FOR CODEX: use your built-in image_gen tool to EDIT the first attached image as described, exactly ONE "
        "generation. Then stop; do not create or modify any file.")


def one(i):
    dst = os.path.join(out, f'take-{i}.png')
    if os.path.exists(dst): return i, 'cached'
    logp = os.path.join(out, f'take-{i}.log')
    for _ in range(2):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', out,
                              '-i', crop, '-i', REF_C, '-i', REF_A], stdin=subprocess.PIPE, stdout=log, stderr=log)
        p.stdin.write((PROMPT + TASK).encode()); p.stdin.close()
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
        if got: shutil.copy(got, dst); return i, 'ok'
    return i, 'failed'


if __name__ == '__main__':
    with ThreadPoolExecutor(N) as ex:
        for i, st in ex.map(one, range(N)): print('take', i, st, flush=True)
