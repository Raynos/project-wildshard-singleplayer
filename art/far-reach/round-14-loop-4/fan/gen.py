"""The war fan's painted silk leaf (loop 4, E374): one codex image_gen texture, unrolled flat, mapped polar onto the fan.

  python3 gen.py        # -> leaf.png (1536x1024), then leaf.webp (shipped by hand: public/assets/far-reach/fan/leaf.webp)

u (left -> right) runs across the open fan from one guard to the other; v (bottom -> top) runs from the pivot's inner
edge out to the rim. Copies the PNG from ~/.codex/generated_images/<session id>/ as soon as it lands (AGENTS.md).
"""
import glob, os, re, subprocess, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
REF = os.path.join(REPO, 'art/far-reach/round-11-review/mockup-C-hands-fan.jpg')
PROMPT = ("Use the attached screenshot ONLY as a reference for the war fan's silk: its teal colour and its pale cloud-swirl motif. "
          "Paint ONE flat rectangular texture, 1536x1024 landscape, that is the fan's silk leaf UNROLLED into a straight strip, seen "
          "flat-on, filling the whole image edge to edge: rich teal silk (deep teal at the bottom edge, lighter sea-teal higher up) "
          "with a band of stylised Chinese auspicious clouds (xiangyun: cream and pale jade spiral cloud scrolls with fine outlines) "
          "running across the middle, a few smaller cloud scrolls above and below, faint silk sheen and woven texture, a thin "
          "gold-leaf border along the TOP edge and a thin bronze line along the bottom edge. Hand-painted, crisp, high detail. NO "
          "fan shape, NO ribs, NO folds, NO hands, NO background, NO perspective, NO text, NO watermark. The pattern must read "
          "evenly across the full width (the strip will be wrapped across the fan's nine panels).")


def main():
    out = os.path.join(HERE, 'leaf.png')
    logp = os.path.join(HERE, 'gen.log')
    full = PROMPT + " ... TASK FOR CODEX: generate exactly ONE image with your built-in image_gen tool. One generation only. Then stop; do not create or modify any file."
    for attempt in range(3):
        log = open(logp, 'a')
        p = subprocess.Popen(['codex', 'exec', '-s', 'workspace-write', '--skip-git-repo-check', '-C', HERE, '-i', REF],
                             stdin=subprocess.PIPE, stdout=log, stderr=log)
        p.stdin.write(full.encode()); p.stdin.close()
        sid, t0, got = None, time.time(), None
        while time.time() - t0 < 900:
            time.sleep(5)
            if sid is None:
                m = re.search(r'session id:\s*([0-9a-f-]+)', open(logp).read()); sid = m.group(1) if m else None
            if sid:
                pngs = glob.glob(os.path.expanduser(f'~/.codex/generated_images/{sid}/*.png'))
                if pngs:
                    time.sleep(3); got = pngs[0]; break
            if p.poll() is not None and sid is None:
                break
        if p.poll() is None:
            p.kill()
        if got:
            Image.open(got).convert('RGB').save(out); print('leaf.png'); return
        print('attempt', attempt, 'failed')
    raise SystemExit('no image')


if __name__ == '__main__':
    main()
