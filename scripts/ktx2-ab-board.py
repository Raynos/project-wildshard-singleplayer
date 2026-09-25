"""ktx2-ab-board.py — the E157 A/B board from scripts/ktx2-ab.mjs's captures: per shard, per pose, the images (IMG) beside
the KTX2 textures (KTX2) on the iPhone portrait frame, then a 1:1 close-up of each (native pixels, where a block
artifact would show), with SSIM / PSNR of the pair and of the run-to-run floor (IMG vs a second IMG load: wind, animals
and the weapon's sway differ between two loads, so KTX2 is judged against that floor, not against zero).

  uv run --with scikit-image --with pillow python scripts/ktx2-ab-board.py <captures dir> <out prefix> [--json <file>]

Writes <out prefix>-<shard>.jpg (JPEG, ≤ 500 KB for progress/) and prints / saves the numbers.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from skimage.metrics import peak_signal_noise_ratio, structural_similarity

SHARDS = {
    'pine-hollow': ['hollow', 'ground', 'stones', 'bark'],
    'nalati-grasslands': ['spawn', 'ground', 'turn'],
    'driftwood-isle': ['spawn', 'sand', 'turn'],
}
# close-up per pose: (x, y, size) in native pixels of the 1170×2532 frame — the ground / rock / bark the pose is about
CROP = {
    'hollow': (380, 1250, 420), 'ground': (380, 700, 420), 'stones': (440, 1150, 420), 'bark': (820, 700, 420),
    'spawn': (380, 1500, 420), 'sand': (380, 800, 420), 'turn': (380, 1400, 420),
}


def load(p):
    return np.asarray(Image.open(p).convert('RGB'))


def metrics(a, b):
    return (float(structural_similarity(a, b, channel_axis=2, data_range=255)), float(peak_signal_noise_ratio(a, b, data_range=255)))


def font(size):
    for f in ('/System/Library/Fonts/Menlo.ttc', '/System/Library/Fonts/Monaco.ttf'):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    src, prefix = Path(sys.argv[1]), sys.argv[2]
    out_json = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
    rows_all = []
    for shard, poses in SHARDS.items():
        W_FULL, W_CROP, PAD, HEAD = 300, 260, 10, 40
        rows = []
        for pose in poses:
            f = {m: src / f'{shard}-{pose}-{m}.png' for m in ('img', 'img2', 'ktx2')}
            if not all(p.exists() for p in f.values()):
                continue
            img, img2, ktx = (load(f[m]) for m in ('img', 'img2', 'ktx2'))
            x, y, s = CROP[pose]
            ci, ck, ci2 = img[y:y + s, x:x + s], ktx[y:y + s, x:x + s], img2[y:y + s, x:x + s]
            r = {'shard': shard, 'pose': pose}
            r['ssim'], r['psnr'] = metrics(img, ktx)
            r['floor_ssim'], r['floor_psnr'] = metrics(img, img2)
            r['crop_ssim'], r['crop_psnr'] = metrics(ci, ck)
            r['crop_floor_ssim'], r['crop_floor_psnr'] = metrics(ci, ci2)
            rows.append((r, img, ktx, ci, ck))
            rows_all.append(r)
            print(f"{shard:18} {pose:7} frame SSIM {r['ssim']:.4f} (floor {r['floor_ssim']:.4f}) PSNR {r['psnr']:.2f} (floor {r['floor_psnr']:.2f}) · close-up SSIM {r['crop_ssim']:.4f} (floor {r['crop_floor_ssim']:.4f}) PSNR {r['crop_psnr']:.2f} (floor {r['crop_floor_psnr']:.2f})")
        if not rows:
            continue
        h_full = round(W_FULL * rows[0][1].shape[0] / rows[0][1].shape[1])
        row_h = HEAD + max(h_full, W_CROP * 2 + PAD) + PAD
        W = PAD + (W_FULL + PAD) * 2 + (W_CROP + PAD) * 2
        board = Image.new('RGB', (W, 70 + row_h * len(rows)), (13, 27, 38))
        d = ImageDraw.Draw(board)
        d.text((PAD, 14), f'E157 · {shard} · iPhone portrait (390x844 @3, phone tier) · left IMG (WebP / JPEG), right KTX2 (UASTC → ASTC 4x4)', fill=(143, 227, 255), font=font(18))
        d.text((PAD, 40), 'close-ups: 1:1 native pixels of the boxed region · floor = IMG vs a second IMG load (wind / animals / sway)', fill=(180, 200, 210), font=font(14))
        for i, (r, img, ktx, ci, ck) in enumerate(rows):
            y0 = 70 + i * row_h
            d.text((PAD, y0 + 8), f"{r['pose']}: frame SSIM {r['ssim']:.3f} / PSNR {r['psnr']:.1f} dB (floor {r['floor_ssim']:.3f} / {r['floor_psnr']:.1f}) · close-up SSIM {r['crop_ssim']:.3f} / {r['crop_psnr']:.1f} dB (floor {r['crop_floor_ssim']:.3f} / {r['crop_floor_psnr']:.1f})", fill=(230, 240, 245), font=font(15))
            x, y, s = CROP[r['pose']]
            k = W_FULL / img.shape[1]
            for j, (full, label) in enumerate(((img, 'IMG'), (ktx, 'KTX2'))):
                im = Image.fromarray(full).resize((W_FULL, h_full), Image.LANCZOS)
                ImageDraw.Draw(im).rectangle([x * k, y * k, (x + s) * k, (y + s) * k], outline=(255, 210, 60), width=2)
                bx = PAD + j * (W_FULL + PAD)
                board.paste(im, (bx, y0 + HEAD))
                d.text((bx + 6, y0 + HEAD + 6), label, fill=(255, 255, 255), font=font(16))
            for j, (crop, label) in enumerate(((ci, 'IMG 1:1'), (ck, 'KTX2 1:1'))):
                im = Image.fromarray(crop).resize((W_CROP, W_CROP), Image.NEAREST if s <= W_CROP else Image.LANCZOS)
                bx = PAD + 2 * (W_FULL + PAD) + j * (W_CROP + PAD)
                board.paste(im, (bx, y0 + HEAD))
                d.text((bx + 6, y0 + HEAD + 6), label, fill=(255, 255, 255), font=font(14))
            # the two close-ups again, 2x (nearest): the texels themselves
            zi = Image.fromarray(ci[: s // 2, : s // 2]).resize((W_CROP, W_CROP), Image.NEAREST)
            zk = Image.fromarray(ck[: s // 2, : s // 2]).resize((W_CROP, W_CROP), Image.NEAREST)
            board.paste(zi, (PAD + 2 * (W_FULL + PAD), y0 + HEAD + W_CROP + PAD))
            board.paste(zk, (PAD + 2 * (W_FULL + PAD) + W_CROP + PAD, y0 + HEAD + W_CROP + PAD))
            d.text((PAD + 2 * (W_FULL + PAD) + 6, y0 + HEAD + W_CROP + PAD + 6), 'IMG 2x', fill=(255, 255, 255), font=font(14))
            d.text((PAD + 2 * (W_FULL + PAD) + W_CROP + PAD + 6, y0 + HEAD + W_CROP + PAD + 6), 'KTX2 2x', fill=(255, 255, 255), font=font(14))
        out = f'{prefix}-{shard}.jpg'
        q = 88
        while True:
            board.save(out, 'JPEG', quality=q, optimize=True)
            if Path(out).stat().st_size <= 490_000 or q <= 60:
                break
            q -= 4
        print(f'  → {out} ({Path(out).stat().st_size // 1024} KB, q{q})')
    if out_json:
        Path(out_json).write_text(json.dumps(rows_all, indent=1) + '\n')


main()
