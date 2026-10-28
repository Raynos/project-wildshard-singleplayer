#!/usr/bin/env python3
"""Shardfile vs Legacy Golden (G859): frames, HUD-masked SSIM and the review page.

  python3 art/legacy-goldens/compare/compare.py frames --raw tmp/golden-compare/raw --run <date>-<sha10>
      the capture's PNGs -> art/legacy-goldens/compare/<run>/<shard>/<n>-<camera>-shardfile.jpg (each <= 120 KB),
      then prints the SSIM table.
  python3 art/legacy-goldens/compare/compare.py page --run <date>-<sha10> --out <page.html> [--captured "<time>"]
      builds the page from the goldens, the run's frames and verdicts.json (the by-eye calls; edit it every run).

SSIM is luma SSIM (Gaussian 11 px, sigma 1.5) averaged over the pixels outside the HUD mask below. Clouds, rain, crowds
and creatures move between visits, so it is a guide; the verdict is by eye.
"""
import argparse, base64, io, json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GOLDENS = os.path.dirname(HERE)
CAMERAS = json.load(open(os.path.join(GOLDENS, '..', 'legacy-vs-shardfile', 'round-1-2026-10-28', 'cameras.json')))['pairedCameras']
NAMES = {'nine-dragon-stack': 'Nine Dragon Stack', 'pine-hollow': 'Pine Hollow', 'driftwood-isle': 'Driftwood Isle',
         'far-reach': 'Far Reach', 'nalati-grasslands': 'Nalati Grasslands', 'sunscar-dunes': 'Sunscar Dunes'}
ORDER = list(NAMES)
# HUD boxes in the 402 x 681 CSS-px frame: pause / coins / minimap, quest pill, HOVER, DODGE / JUMP, MOVE / ATTACK / LOOK
HUD = [(0, 0, 402, 96), (268, 0, 402, 128), (148, 126, 392, 160), (0, 280, 44, 344), (256, 500, 402, 574), (0, 528, 170, 681),
       (0, 574, 402, 681)]


def cams(slug):
    return [f'{i + 1}-{c["name"]}' for i, c in enumerate(CAMERAS[slug])]


def luma(img):
    a = np.asarray(img.convert('RGB'), dtype=np.float64)
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def blur(a):
    x = np.arange(-5, 6); k = np.exp(-x * x / (2 * 1.5 ** 2)); k /= k.sum()
    p = np.pad(a, 5, mode='reflect')
    rows = sum(k[i] * p[i:i + a.shape[0], :] for i in range(11))
    return sum(k[i] * rows[:, i:i + a.shape[1]] for i in range(11))


def ssim(a_img, b_img):
    size = (402, 681)
    a, b = luma(a_img.resize(size)), luma(b_img.resize(size))
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ma, mb = blur(a), blur(b)
    va, vb, cov = blur(a * a) - ma * ma, blur(b * b) - mb * mb, blur(a * b) - ma * mb
    m = ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2))
    keep = np.ones(m.shape, bool)
    for x0, y0, x1, y1 in HUD: keep[y0:y1, x0:x1] = False
    return float(m[keep].mean())


def golden(slug, cam): return os.path.join(GOLDENS, slug, f'{cam}.jpg')
def frame(run, slug, cam): return os.path.join(HERE, run, slug, f'{cam}-shardfile.jpg')


def cmd_frames(args):
    for slug in ORDER:
        os.makedirs(os.path.join(HERE, args.run, slug), exist_ok=True)
        for cam in cams(slug):
            img = Image.open(os.path.join(args.raw, slug, f'{cam}-shardfile.png')).convert('RGB')
            for q in (88, 84, 80, 76, 72, 68):
                buf = io.BytesIO(); img.save(buf, 'JPEG', quality=q, optimize=True)
                if buf.tell() <= 120_000: break
            open(frame(args.run, slug, cam), 'wb').write(buf.getvalue())
        print(slug, ' / '.join(f'{ssim(Image.open(golden(slug, c)), Image.open(frame(args.run, slug, c))):.2f}' for c in cams(slug)))


def data_uri(path, width=402, q=78):
    img = Image.open(path).convert('RGB')
    if img.width != width: img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, 'JPEG', quality=q, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def esc(s): return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def cmd_page(args):
    verdicts = json.load(open(os.path.join(HERE, 'verdicts.json')))
    sha = args.run.split('-')[-1]
    shards, total_great, total, ssims = [], 0, 0, []
    for slug in ORDER:
        pairs = []
        for cam in cams(slug):
            s = ssim(Image.open(golden(slug, cam)), Image.open(frame(args.run, slug, cam)))
            v = verdicts['pairs'].get(f'{slug}/{cam}', {})
            great = v.get('verdict', 'great' if s >= 0.85 else 'needs') == 'great'
            pairs.append({'cam': cam, 'ssim': s, 'great': great, 'note': v.get('note', '' if great else 'Not reviewed yet'),
                          'row': v.get('row', ''), 'before': data_uri(golden(slug, cam)), 'after': data_uri(frame(args.run, slug, cam))})
            ssims.append(s)
        g = sum(p['great'] for p in pairs); total_great += g; total += len(pairs)
        shards.append((slug, pairs, g))
    stale = verdicts.get('judged') != args.run
    html = render(shards, total_great, total, float(np.mean(ssims)), sha, args.captured, verdicts, stale)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    open(args.out, 'w').write(html)
    print(f'{args.out}: {len(html) / 1e6:.2f} MB, {total_great}/{total} great')


def pair_html(slug, p, sha):
    cam = p['cam'].split('-', 1)
    row = f'<span class="row">{esc(p["row"])}</span>' if p['row'] else ''
    note = f'<p class="note">{row}{esc(p["note"])}</p>' if p['note'] or row else ''
    return f'''<figure class="pair {'ok' if p['great'] else 'bad'}" id="{slug}-{esc(p['cam'])}">
<figcaption><span class="cam"><b>{esc(cam[0])}</b> {esc(cam[1])}</span><span class="ssim">SSIM {p['ssim']:.2f}</span></figcaption>
<div class="frames"><div><img src="{p['before']}" alt="LEGACY golden, {esc(slug)} camera {esc(p['cam'])}" loading="lazy"><span>LEGACY golden</span></div>
<div><img src="{p['after']}" alt="SHARDFILE at {esc(sha)}, {esc(slug)} camera {esc(p['cam'])}" loading="lazy"><span>SHARDFILE @{esc(sha[:10])}</span></div></div>
{note}</figure>'''


def render(shards, great, total, mean, sha, captured, verdicts, stale):
    tally = ''.join(f'''<a class="tally" href="#{slug}"><span class="nm">{NAMES[slug]}</span><span class="bar">{''.join(f'<i class="{"g" if p["great"] else "n"}"></i>' for p in pairs)}</span><span class="ct"><b>{g}</b> great · <b>{len(pairs) - g}</b> needs work</span></a>''' for slug, pairs, g in shards)
    body = []
    for slug, pairs, g in shards:
        bad = [p for p in pairs if not p['great']]; ok = [p for p in pairs if p['great']]
        mean_s = np.mean([p['ssim'] for p in pairs])
        accepted = verdicts.get('accepted', {}).get(slug, '')
        sec = f'<section class="shard" id="{slug}"><header><h2>{NAMES[slug]}</h2><p class="score"><b>{g}/{len(pairs)}</b> great · mean SSIM {mean_s:.2f}</p></header>'
        if accepted: sec += f'<p class="accepted">Accepted changes: {esc(accepted)}</p>'
        if bad: sec += '<h3 class="h-bad">Needs work</h3><div class="grid">' + ''.join(pair_html(slug, p, sha) for p in bad) + '</div>'
        if ok: sec += '<h3 class="h-ok">Great</h3><div class="grid">' + ''.join(pair_html(slug, p, sha) for p in ok) + '</div>'
        body.append(sec + '</section>')
    warn = '<p class="stale">The by-eye verdicts were judged on an earlier run; pairs without a verdict fall back to SSIM ≥ 0.85.</p>' if stale else ''
    return f'''<title>Shardfile vs Legacy Golden</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;700&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Layout: a contact sheet. Summary strip first, then one band per shard: Needs work pairs, then Great pairs. */
:root {{
  --bg: #eef1f4; --panel: #ffffff; --ink: #18222c; --muted: #5b6875; --line: #d3dae1;
  --accent: #1f6f8b; --good: #2f7d4f; --bad: #b4572a; --goodbg: #e3f1e8; --badbg: #f8e9e0;
  --display: "Barlow Semi Condensed", "Arial Narrow", system-ui, sans-serif;
  --body: "Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #10161c; --panel: #18212a; --ink: #e4eaf0; --muted: #94a2b0; --line: #2a3642;
  --accent: #5fb4d2; --good: #6cc28e; --bad: #e8925f; --goodbg: #17302a; --badbg: #3a2519; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #10161c; --panel: #18212a; --ink: #e4eaf0; --muted: #94a2b0; --line: #2a3642;
  --accent: #5fb4d2; --good: #6cc28e; --bad: #e8925f; --goodbg: #17302a; --badbg: #3a2519; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); margin: 0; overflow-x: hidden; }}
.wrap {{ max-width: 1180px; margin: 0 auto; padding-block: 20px 56px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 28px; }}
h1, h2, h3 {{ font-family: var(--display); text-wrap: balance; margin: 0; }}
h1 {{ font-size: 30px; font-weight: 700; letter-spacing: 0.01em; }}
.meta {{ font: 12px/1.6 var(--mono); color: var(--muted); margin: 6px 0 0; overflow-wrap: anywhere; }}
.meta b {{ color: var(--ink); font-weight: 600; }}
.overall {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; margin-top: 14px; }}
.overall .big {{ font: 700 44px/1 var(--display); color: var(--accent); font-variant-numeric: tabular-nums; }}
.overall span {{ color: var(--muted); }}
.tallies {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }}
.tally {{ display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: center; padding: 10px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; color: inherit; text-decoration: none; }}
.tally:focus-visible, .tally:hover {{ border-color: var(--accent); outline: none; }}
.tally .nm {{ font: 600 16px var(--display); }}
.tally .bar {{ display: flex; gap: 3px; }}
.tally .bar i {{ width: 14px; height: 14px; border-radius: 3px; }}
.tally .bar i.g {{ background: var(--good); }} .tally .bar i.n {{ background: var(--bad); }}
.tally .ct {{ grid-column: 1 / -1; font: 12px var(--mono); color: var(--muted); }}
.tally .ct b {{ color: var(--ink); }}
.stale {{ margin: 0; padding: 8px 12px; border-left: 3px solid var(--bad); background: var(--badbg); }}
.shard {{ display: grid; gap: 12px; padding-top: 18px; border-top: 2px solid var(--line); scroll-margin-top: 12px; }}
.shard header {{ display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 16px; }}
h2 {{ font-size: 26px; font-weight: 700; }}
.score {{ margin: 0; font: 13px var(--mono); color: var(--muted); }}
.score b {{ color: var(--ink); font-size: 15px; }}
.accepted {{ margin: 0; color: var(--muted); font-size: 14px; max-width: 70ch; }}
h3 {{ font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }}
.h-bad {{ color: var(--bad); }} .h-ok {{ color: var(--good); }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }}
@media (max-width: 400px) {{ .grid {{ grid-template-columns: 1fr; }} }}
.pair {{ margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px; display: grid; gap: 8px; min-width: 0; }}
.pair.bad {{ border-color: color-mix(in srgb, var(--bad) 45%, var(--line)); }}
figcaption {{ display: flex; justify-content: space-between; gap: 8px; font: 13px var(--mono); }}
.cam b {{ display: inline-block; min-width: 1.6em; text-align: center; background: var(--ink); color: var(--panel); border-radius: 3px; margin-right: 4px; }}
.ssim {{ font-variant-numeric: tabular-nums; color: var(--muted); }}
.frames {{ display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }}
.frames div {{ display: grid; gap: 3px; min-width: 0; }}
.frames img {{ width: 100%; max-width: 100%; height: auto; aspect-ratio: 402 / 681; display: block; border-radius: 3px; background: var(--line); }}
.frames span {{ font: 11px var(--mono); color: var(--muted); letter-spacing: 0.03em; }}
.note {{ margin: 0; font-size: 14px; }}
.bad .note {{ background: var(--badbg); padding: 6px 8px; border-radius: 4px; }}
.row {{ font: 600 12px var(--mono); color: var(--panel); background: var(--bad); border-radius: 3px; padding: 1px 5px; margin-right: 6px; }}
.ok .row {{ background: var(--good); }}
footer {{ color: var(--muted); font-size: 13px; max-width: 75ch; }}
</style>
<div class="wrap">
<header>
<h1>Shardfile vs Legacy Golden</h1>
<p class="meta">SHARDFILE build <b>{esc(sha)}</b> · captured {esc(captured)} · LEGACY goldens from 033398c5c6 (art/legacy-goldens, G843)</p>
<p class="meta">Chromium, iPhone 16 Pro portrait, phone tier, render scale 2×, seed 357, midday / clear. SSIM is luma with the HUD masked; the verdict is by eye.</p>
<div class="overall"><span class="big">{great}/{total}</span><span>pairs great · mean SSIM {mean:.2f}</span></div>
</header>
{warn}
<nav class="tallies" aria-label="Per shard">{tally}</nav>
{''.join(body)}
<footer>When Jake says this wave is good, the 24 SHARDFILE frames of that run become the new goldens in art/shardfile-goldens/ (G859). Clouds, rain, crowds and creatures move between visits, so SSIM is a guide, not a parity claim.</footer>
</div>
'''


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    f = sub.add_parser('frames'); f.add_argument('--raw', required=True); f.add_argument('--run', required=True)
    p = sub.add_parser('page'); p.add_argument('--run', required=True); p.add_argument('--out', required=True); p.add_argument('--captured', default='')
    a = ap.parse_args()
    cmd_frames(a) if a.cmd == 'frames' else cmd_page(a)
