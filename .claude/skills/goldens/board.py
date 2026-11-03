#!/usr/bin/env python3
"""Golden rerun board (docs/process/GOLDENS.md, .claude/skills/goldens/SKILL.md).

A shard (24 cameras, art/legacy-goldens/compare/cameras24.json):
  python3 .claude/skills/goldens/board.py --shard <slug> --now <capture.mjs --out dir> --out <dir> \
      [--label "NOW <build id>"] [--cams 1,5,9] [--red 11,12]
  NOW frames: <now>/<slug>/<nn>-<camera>-shardfile.png (capture.mjs --cameras=… writes them). Columns: LEGACY golden |
  SHARDFILE golden | NOW. SSIM is NOW against the SHARDFILE golden.
An open plot (8 views, art/open-plots/golden-2026-11-03/<plot>/cameras.json):
  python3 .claude/skills/goldens/board.py --plot <plot> --now <dir> --out <dir> [...]
  NOW frames: <now>/<plot>/<n>-<view>.png|.jpg. Columns: GOLDEN | NOW.

Writes <out>/<id>.jpg (one big labelled row per camera: read every one) and <out>/board-<slug>.jpg (every camera on one
labelled board, <= 500 KB; --red burns a red frame and RED onto those cameras). Prints SSIM per camera: a guide only,
clouds, rain, crowds and the hands' sway move; the verdict is by eye.

Promote (an approved look change only, never silently; the commit names the ruling):
  python3 .claude/skills/goldens/board.py --shard <slug> --now <dir> --promote 11,12 --source "<sha10> G1234"
  rewrites art/shardfile-goldens/<slug>/24/<nn>-<camera>.jpg from NOW: 540 px wide, 22 px label strip, JPEG q72.
"""
import argparse, io, json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'art', 'legacy-goldens', 'compare'))
from compare import ssim  # noqa: E402  (luma SSIM at 402 x 681, the G859 page's measure)

SET = os.path.join(ROOT, 'art', 'legacy-goldens', 'compare', 'cameras24.json')
PLOTS = os.path.join(ROOT, 'art', 'open-plots', 'golden-2026-11-03')
STRIP = 22  # the SHARDFILE goldens carry a 22 px label strip on top
RED, INK, BG = (230, 40, 40), (240, 240, 240), (16, 20, 26)


def font(size):
    for p in ('/System/Library/Fonts/Menlo.ttc', '/System/Library/Fonts/SFNSMono.ttf'):
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


def find(base, names):
    for name in names:
        p = os.path.join(base, name)
        if os.path.exists(p): return Image.open(p).convert('RGB')
    return None


def fit(img, w): return img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)


def labelled(img, text, color, w, f):
    out = Image.new('RGB', (w, img.height + f.size + 8), BG)
    out.paste(img, (0, f.size + 8)); ImageDraw.Draw(out).text((4, 3), text, fill=color, font=f)
    return out


def row(cells, title, w, red, f):
    h = max(c.height for c in cells)
    out = Image.new('RGB', (len(cells) * (w + 2) + 2, h + f.size + 10), RED if red else BG)
    for i, c in enumerate(cells): out.paste(c, (2 + i * (w + 2), f.size + 10))
    ImageDraw.Draw(out).text((4, 4), title, fill=INK, font=f)
    return out


def cameras(a):
    """[(n, id, [(column label, golden image)], now image or None)]"""
    out = []
    if a.shard:
        for c in json.load(open(SET))['cameras'][a.shard]:
            cid = f'{c["n"]:02d}-{c["name"]}'
            legacy = Image.open(os.path.join(ROOT, 'art', 'legacy-goldens', a.shard, '24', f'{cid}.jpg')).convert('RGB')
            golden = Image.open(os.path.join(ROOT, 'art', 'shardfile-goldens', a.shard, '24', f'{cid}.jpg')).convert('RGB')
            golden = golden.crop((0, STRIP, golden.width, golden.height))
            now = find(os.path.join(a.now, a.shard), (f'{cid}-shardfile.png', f'{cid}.png', f'{cid}.jpg'))
            out.append((c['n'], cid, [('LEGACY golden', legacy), ('SHARDFILE golden', golden)], now))
    else:
        for v in json.load(open(os.path.join(PLOTS, a.plot, 'cameras.json')))['views']:
            vid = f'{v["n"]}-{v["name"]}'
            golden = Image.open(os.path.join(PLOTS, a.plot, f'{vid}.jpg')).convert('RGB')
            now = find(os.path.join(a.now, a.plot), (f'{vid}.png', f'{vid}.jpg'))
            out.append((v['n'], vid, [('GOLDEN 2026-11-03', golden)], now))
    return out


def promote(a, cams):
    if not a.shard or not a.source: raise SystemExit('--promote needs --shard and --source "<sha10> <ruling>"')
    for n, cid, _, now in cams:
        if n not in a.promote: continue
        if now is None: raise SystemExit(f'no NOW frame for {cid}')
        img, f = fit(now, 540), font(12)
        out = Image.new('RGB', (540, img.height + STRIP), (0, 0, 0)); out.paste(img, (0, STRIP))
        ImageDraw.Draw(out).text((6, 3), f'SHARDFILE golden · {a.shard} · {cid} · {a.source}', fill=(255, 255, 255), font=f)
        path = os.path.join(ROOT, 'art', 'shardfile-goldens', a.shard, '24', f'{cid}.jpg')
        out.save(path, 'JPEG', quality=72); print('promoted', os.path.relpath(path, ROOT))


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True); g.add_argument('--shard'); g.add_argument('--plot')
    ap.add_argument('--now', required=True); ap.add_argument('--out', default='')
    ap.add_argument('--label', default='NOW'); ap.add_argument('--cams', default=''); ap.add_argument('--red', default='')
    ap.add_argument('--promote', default=''); ap.add_argument('--source', default='')
    a = ap.parse_args()
    nums = lambda s: {int(x) for x in s.split(',') if x}
    only, red, a.promote = nums(a.cams), nums(a.red), nums(a.promote)
    slug = a.shard or a.plot
    cams = [c for c in cameras(a) if not only or c[0] in only]
    if a.promote: return promote(a, cams)
    if not a.out: raise SystemExit('--out is required')
    os.makedirs(a.out, exist_ok=True)
    big, small, missing = [], [], []
    for n, cid, goldens, now in cams:
        if now is None: missing.append(cid); continue
        s = ssim(goldens[-1][1], now); is_red = n in red
        print(f'{cid:28s} {s:.3f}' + ('  RED' if is_red else ''))
        for w, size, sink, title in ((360, 13, big, f'{slug} {cid}  SSIM vs golden {s:.2f}'), (120, 9, small, f'{cid} {s:.2f}')):
            f = font(size)
            cells = [labelled(fit(img, w), label, INK, w, f) for label, img in goldens]
            cells.append(labelled(fit(now, w), a.label, RED if is_red else INK, w, f))
            sink.append(row(cells, title + (' RED' if is_red else ''), w, is_red, f))
        big[-1].save(os.path.join(a.out, f'{cid}.jpg'), quality=82)
    if missing: print('MISSING NOW frames:', ', '.join(missing))
    if not small: raise SystemExit('no frames to board')
    cols = 4; tw, th = small[0].width, max(t.height for t in small)
    f = font(16); head = f.size + 14
    board = Image.new('RGB', (cols * (tw + 4) + 4, head + -(-len(small) // cols) * (th + 4) + 4), BG)
    columns = ' . '.join([label for label, _ in cams[0][2]] + [a.label])
    ImageDraw.Draw(board).text((6, 6), f'GOLDEN RERUN {slug} | {columns}' + (f' | RED: {",".join(map(str, sorted(red)))}' if red else ' | no RED'), fill=INK, font=f)
    for i, t in enumerate(small): board.paste(t, (4 + (i % cols) * (tw + 4), head + (i // cols) * (th + 4)))
    for q in (80, 72, 64, 56, 48, 40):
        buf = io.BytesIO(); board.save(buf, 'JPEG', quality=q)
        if buf.tell() <= 500_000: break
    path = os.path.join(a.out, f'board-{slug}.jpg'); open(path, 'wb').write(buf.getvalue())
    print(f'{path} {buf.tell() // 1000} KB, {len(small)} cameras')


if __name__ == '__main__':
    main()
