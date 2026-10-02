"""The four hero scenes' 3x3 targets (E392; docs/design/LOOK-LOOP.md Step 3): codex image_gen EDITS each capture toward
the mockups' look, keeping the camera, the layout and every silhouette.

  python3 targets.py <captures dir> [--only=H1-1-front,...] [--jobs=6]   # -> targets/<id>.jpg (780x1688)

Each capture is padded to 2:3 with the HUD's navy (codex's portrait frame), edited, then cropped back, so a target lines
up with its capture. References: Jake's pick (round-1-proposals/B-sky-reach.jpg) for H1-H3, mockup D for H4. The PNG
is copied from ~/.codex/generated_images/<session id>/ the moment it lands (AGENTS.md, Mockups).
"""
import glob, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../..'))
OUT = os.path.join(HERE, 'targets'); WORK = os.path.join(HERE, 'work')
REF = {'H1': 'art/far-reach/round-1-proposals/B-sky-reach.jpg', 'H2': 'art/far-reach/round-1-proposals/B-sky-reach.jpg',
       'H3': 'art/far-reach/round-1-proposals/B-sky-reach.jpg', 'H4': 'art/far-reach/round-11-review/mockup-D-crown-arena.jpg'}
NAVY = (14, 22, 30)

COMMON = ("The FIRST attached image is an in-game screenshot of 'Sky Reach', a first-person phone game: floating sky islands above "
          "a sea of clouds at golden hour (it is padded left and right with flat dark navy bars: keep those bars exactly as they are). "
          "The SECOND attached image is the art-direction mockup the game must look like. EDIT the first image so it looks like a "
          "finished frame of the mockup's world, as a real in-game screenshot: keep EXACTLY the camera, the horizon line, the position, "
          "size and silhouette of every island, bridge, building, tree, stone and creature, and any HUD panels, buttons and text exactly "
          "as they are. Change only the finish: craggy grey-brown rock island undersides with green moss streaks, hanging roots and vines "
          "and thin waterfalls; lush long green grass with golden tips, white and yellow daisies and mossy grey boulders on the island "
          "tops; weathered grey-brown wood; whitewashed stone for the windmill; a sunlit volumetric cumulus cloud sea with gold rims and "
          "lavender shadows; warm low golden sunlight with long soft shadows and glowing rims; painterly-stylized like the mockup "
          "(Ghibli / Genshin), rich detail. You may add small details on existing surfaces (flowers, rocks, roots, vines, small "
          "waterfalls), never new large objects, never move anything. No new text, no watermark, no border.")
TASK = (" ... TASK FOR CODEX: use your built-in image_gen tool to produce exactly ONE edited 1024x1536 portrait image. One generation "
        "only. Then stop; do not create or modify any file.")


def pad(src, dst):
    im = Image.open(src).convert('RGB'); w, h = im.size; W = round(h * 2 / 3)
    out = Image.new('RGB', (W, h), NAVY); out.paste(im, ((W - w) // 2, 0)); out.save(dst, quality=90)
    return w, h


def unpad(png, dst, w, h):
    im = Image.open(png).convert('RGB'); W = round(h * 2 / 3)
    im = im.resize((W, h), Image.LANCZOS); l = (W - w) // 2
    im.crop((l, 0, l + w, h)).save(dst, quality=84)


def one(cap):
    sid = os.path.basename(cap)[:-4]; dst = os.path.join(OUT, f'{sid}.jpg')
    if os.path.exists(dst): return sid, 'cached'
    padded = os.path.join(WORK, f'{sid}.in.jpg'); w, h = pad(cap, padded)
    logp = os.path.join(WORK, f'{sid}.log')
    for attempt in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', WORK, '-i', padded, '-i', os.path.join(REPO, REF[sid[:2]])],
                             stdin=subprocess.PIPE, stdout=log, stderr=log)
        p.stdin.write((COMMON + TASK).encode()); p.stdin.close()
        session, t0, got = None, time.time(), None
        while time.time() - t0 < 900:
            time.sleep(5)
            if session is None:
                m = re.search(r'session id:\s*([0-9a-f-]+)', open(logp).read()); session = m.group(1) if m else None
            if session:
                pngs = glob.glob(os.path.expanduser(f'~/.codex/generated_images/{session}/*.png'))
                if pngs: time.sleep(3); got = pngs[0]; break
            if p.poll() is not None and session is None: break
        if p.poll() is None: p.kill()
        if got:
            unpad(got, dst, w, h); return sid, 'ok'
    return sid, 'failed'


def main():
    caps = sys.argv[1]
    only = next((a[7:].split(',') for a in sys.argv[2:] if a.startswith('--only=')), None)
    jobs = int(next((a[7:] for a in sys.argv[2:] if a.startswith('--jobs=')), '6'))
    os.makedirs(OUT, exist_ok=True); os.makedirs(WORK, exist_ok=True)
    files = sorted(f for f in glob.glob(os.path.join(caps, 'H[1-4]-*.jpg')) if only is None or os.path.basename(f)[:-4] in only)
    with ThreadPoolExecutor(jobs) as ex:
        for sid, status in ex.map(one, files): print(sid, status, flush=True)


if __name__ == '__main__':
    main()
