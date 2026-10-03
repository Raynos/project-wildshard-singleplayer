"""ref.py: the caravan camp's references for image-to-3D (the original top-10's row 7), from mockup B's crops, with codex
image_gen (one image per run, all runs in parallel). The runner copies the PNG the moment it lands (AGENTS.md, Mockups)
and kills that codex.
usage: python3 ref.py [names...]      # -> ref-<name>.png here (then JPEG)

  wagon   src-wagon.jpg: the covered wagon, three-quarter from behind, torn canvas over bare hoops, planked tailboard,
          spoked wheels, the lantern hook (no lantern: the game's lantern is its own light)
  crates  src-cargo.jpg: two weathered planked crates, one stacked on the other
  sacks   src-cargo.jpg: a cluster of three burlap sacks and a rolled bedroll
"""
import glob, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = (" Make a clean product-style reference for a 3D modeller: the object ALONE, whole and fully in frame with a margin on "
         "every side, nothing cut off, soft even studio light from the front, no cast shadow, on a plain PURE WHITE background "
         "(#FFFFFF): no ground, no sand, no sky, no scenery, no HUD, no text, no watermark. Stylized-realistic game asset, "
         "rich readable surface detail, matte weathered materials.")
PROMPTS = {
    'wagon': ("The attached image is a crop of a game screenshot: an old abandoned covered wagon in the desert, seen from behind. "
              "Make a reference of THAT wagon, seen in a THREE-QUARTER view from behind and to its left, slightly from above: "
              "a wooden wagon bed with a tall PLANKED TAILBOARD at the back (horizontal weathered boards), FOUR big wooden "
              "SPOKED WHEELS with iron tyres (the rear pair larger), five bent wooden HOOPS over the bed, and a pale beige "
              "CANVAS cover over the front hoops that is TORN and ragged, hanging in shreds at the back so the two rear hoops "
              "stand bare, a short wooden tongue at the front. Sun-bleached grey-brown wood, dusty.", 'src-wagon.jpg'),
    'crates': ("The attached image is a crop of a game screenshot of desert cargo. Make a reference of TWO weathered wooden "
               "SHIPPING CRATES: a larger crate on the ground with a smaller crate stacked on top, slightly offset and turned; "
               "each made of horizontal planks with corner battens and nail heads, sun-bleached tan-grey wood, seen in a "
               "three-quarter view from slightly above.", 'src-cargo.jpg'),
    'sacks': ("The attached image is a crop of a game screenshot of desert cargo. Make a reference of a small pile of "
              "THREE slumped BURLAP GRAIN SACKS tied at the neck, leaning together, with ONE rolled canvas BEDROLL tied with "
              "two straps lying in front of them; coarse woven tan burlap, dusty; seen in a three-quarter view from slightly "
              "above.", 'src-cargo.jpg'),
}
TASK = (" ... TASK FOR CODEX: generate exactly ONE 1024x1024 square image with your built-in image_gen tool, using the "
        "attached image as described. One generation only. Then stop; do not create or modify any file.")


def one(name):
    out = os.path.join(HERE, f'ref-{name}.png')
    if os.path.exists(out): return name, 'cached'
    text, src = PROMPTS[name]
    logp = os.path.join(os.environ.get('LOGDIR', HERE), f'{name}.log')
    for _ in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '--add-dir',
                              os.path.expanduser('~/.codex/generated_images'), '-i', os.path.join(HERE, src)],
                             stdin=subprocess.PIPE, stdout=log, stderr=log)
        p.stdin.write((text + STYLE + TASK).encode()); p.stdin.close()
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
        if got:
            import shutil; shutil.copy(got, out); return name, 'ok'
    return name, 'failed'


if __name__ == '__main__':
    names = sys.argv[1:] or list(PROMPTS)
    with ThreadPoolExecutor(len(names)) as ex:
        for n, st in ex.map(one, names): print(n, st, flush=True)
