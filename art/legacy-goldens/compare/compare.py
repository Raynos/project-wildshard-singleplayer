#!/usr/bin/env python3
"""Shardfile vs Legacy Golden (G859): 24 cameras per shard, the goldens, the run's frames, SSIM and the review page.

  python3 art/legacy-goldens/compare/compare.py eyes --raw <legacy raw dir> [...]
      writes the LEGACY run's resolved eyes into cameras24.json, so SHARDFILE renders the same cameras.
  python3 art/legacy-goldens/compare/compare.py goldens --raw <legacy raw dir> [...]
      the LEGACY PNGs -> art/legacy-goldens/<shard>/24/<nn>-<camera>.jpg (540 px wide, quality ~70; one-time, G859).
  python3 art/legacy-goldens/compare/compare.py frames --raw <shardfile raw dir> [...] --run <date>-<sha10>
      the SHARDFILE PNGs -> tmp/golden-compare-144/<run>/<shard>/<nn>-<camera>.jpg (never committed), then the SSIM table.
  python3 art/legacy-goldens/compare/compare.py page --run <date>-<sha10> --out <page.html> [--captured "<time>"]
      builds the page from the goldens, the run's frames and verdicts.json (the by-eye calls; edit it every run).
      Each side is one 540 px WebP shown as a thumbnail that opens full width in place on tap: separate 300 px
      thumbnails plus full-size frames for 288 images do not fit the ~12 MB page.

The frames are the canvas alone (capture.mjs --cameras), so no HUD is drawn and none is masked: the first-person hands
stay in the score. SSIM is luma SSIM (Gaussian 11 px, sigma 1.5) at 402 x 681. Clouds, rain, crowds, creatures and the
hands' idle sway move between visits, so it is a guide; the verdict is by eye.
"""
import argparse, base64, glob, io, json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
GOLDENS = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(GOLDENS))
SET = os.path.join(HERE, 'cameras24.json')
RUNS = os.path.join(ROOT, 'tmp', 'golden-compare-144')
NAMES = {'nine-dragon-stack': 'Nine Dragon Stack', 'pine-hollow': 'Pine Hollow', 'driftwood-isle': 'Driftwood Isle',
         'far-reach': 'Far Reach', 'nalati-grasslands': 'Nalati Grasslands', 'sunscar-dunes': 'Sunscar Dunes'}
ORDER = list(NAMES)
KINDS = {'co6': 'CO6 camera', 'poi': 'Point of interest', 'grid': 'Coverage', 'aerial': 'Aerial', 'hands': 'Hands'}


def cameras(): return json.load(open(SET))['cameras']
def cam_id(c): return f'{c["n"]:02d}-{c["name"]}'
def golden(slug, c): return os.path.join(GOLDENS, slug, '24', f'{cam_id(c)}.jpg')
def frame(run, slug, c): return os.path.join(RUNS, run, slug, f'{cam_id(c)}.jpg')


def raw_png(dirs, slug, c, mode):
    for d in reversed(dirs):  # a later raw dir (a recapture of some cameras) wins, as in receipts()
        p = os.path.join(d, slug, f'{cam_id(c)}-{mode}.png')
        if os.path.exists(p): return p
    raise FileNotFoundError(f'{slug} {cam_id(c)} {mode}')


def receipts(dirs):
    out = {}
    for d in dirs:
        for p in glob.glob(os.path.join(d, 'receipts-*.json')):
            r = json.load(open(p))
            for pose in r['poses']: out[(r['slug'], pose['n'])] = pose
    return out


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
    a, b = luma(a_img.resize(size, Image.BILINEAR)), luma(b_img.resize(size, Image.BILINEAR))
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ma, mb = blur(a), blur(b)
    va, vb, cov = blur(a * a) - ma * ma, blur(b * b) - mb * mb, blur(a * b) - ma * mb
    m = ((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2))
    return float(m.mean())


def jpeg(img, width, qualities, cap):
    img = img.convert('RGB')
    if img.width != width: img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    for q in qualities:
        buf = io.BytesIO(); img.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
        if buf.tell() <= cap: break
    return buf.getvalue()


def cmd_eyes(args):
    data = json.load(open(SET)); got = receipts(args.raw); n = 0
    for slug, cams in data['cameras'].items():
        for c in cams:
            if 'eye' in c: continue
            pose = got.get((slug, c['n']))
            if pose is None: raise SystemExit(f'no LEGACY receipt for {slug} {cam_id(c)}')
            c['eye'] = [round(v, 3) for v in pose['eye']]; n += 1
    json.dump(data, open(SET, 'w'), indent=1); open(SET, 'a').write('\n')
    print(f'{n} eyes written')


def cmd_goldens(args):
    total = 0
    for slug, cams in cameras().items():
        os.makedirs(os.path.join(GOLDENS, slug, '24'), exist_ok=True)
        for c in cams:
            b = jpeg(Image.open(raw_png(args.raw, slug, c, "legacy")), 540, (70, 66, 62, 58, 54, 50, 46, 42), 42_000)
            open(golden(slug, c), 'wb').write(b); total += len(b)
    print(f'goldens: {total / 1e6:.2f} MB')


def cmd_frames(args):
    for slug in ORDER:
        cams = cameras()[slug]
        os.makedirs(os.path.join(RUNS, args.run, slug), exist_ok=True)
        for c in cams:
            open(frame(args.run, slug, c), 'wb').write(jpeg(Image.open(raw_png(args.raw, slug, c, 'shardfile')), 540, (75,), 1e9))
        print(slug, ' '.join(f'{ssim(Image.open(golden(slug, c)), Image.open(frame(args.run, slug, c))):.2f}' for c in cams))


def uri(data, kind='jpeg'): return f'data:image/{kind};base64,' + base64.b64encode(data).decode()


def full(path, q):
    img = Image.open(path).convert('RGB')
    if img.width != 540: img = img.resize((540, round(img.height * 540 / img.width)), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf, 'WEBP', quality=q, method=6)
    return uri(buf.getvalue(), 'webp')


def esc(s): return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def cmd_page(args):
    verdicts = json.load(open(os.path.join(HERE, 'verdicts.json')))
    sha = args.run.split('-')[-1]
    shards, great_all, total = [], 0, 0
    for slug in ORDER:
        pairs = []
        for c in cameras()[slug]:
            g, f = golden(slug, c), frame(args.run, slug, c)
            s = ssim(Image.open(g), Image.open(f))
            v = verdicts['pairs'].get(f'{slug}/{cam_id(c)}', {})
            great = v.get('verdict', 'great' if s >= 0.85 else 'needs') == 'great'
            pairs.append({'c': c, 'ssim': s, 'great': great, 'note': v.get('note', '' if great else 'Not reviewed yet'), 'row': v.get('row', ''),
                          'b': full(g, args.q), 'a': full(f, args.q)})
        g = sum(p['great'] for p in pairs); great_all += g; total += len(pairs)
        shards.append((slug, pairs, g))
    html = render(shards, great_all, total, sha, args.captured, verdicts, verdicts.get('judged') != args.run)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    open(args.out, 'w').write(html)
    print(f'{args.out}: {len(html) / 1e6:.2f} MB, {great_all}/{total} great')


def pair_html(slug, p, sha):
    c = p['c']
    row = f'<span class="row">{esc(p["row"])}</span>' if p['row'] else ''
    note = f'<p class="note">{row}{esc(p["note"])}</p>' if p['note'] or row else ''
    return f'''<figure class="pair {'ok' if p['great'] else 'bad'}" id="{slug}-{esc(cam_id(c))}">
<figcaption><span class="cam"><b>{c['n']}</b> {esc(c['name'])}</span><span class="ssim">SSIM {p['ssim']:.2f}</span></figcaption>
<p class="poi"><span class="kind">{esc(KINDS.get(c.get('kind', ''), ''))}</span> {esc(c.get('poi', ''))}</p>
<button class="frames" type="button" aria-expanded="false" aria-label="Show {esc(slug)} camera {c['n']} full size">
<span class="f"><img src="{p['b']}" alt="LEGACY golden, {esc(slug)} camera {esc(cam_id(c))}"><span>LEGACY golden</span></span>
<span class="f"><img src="{p['a']}" alt="SHARDFILE at {esc(sha)}, {esc(slug)} camera {esc(cam_id(c))}"><span>SHARDFILE @{esc(sha[:10])}</span></span>
</button>
{note}</figure>'''


def render(shards, great, total, sha, captured, verdicts, stale):
    tally = ''.join(f'''<a class="tally" href="#{slug}"><span class="nm">{NAMES[slug]}</span><span class="ct"><b>{g}</b> great · <b>{len(pairs) - g}</b> needs work</span><span class="bar">{''.join(f'<i class="{"g" if p["great"] else "n"}"></i>' for p in pairs)}</span></a>''' for slug, pairs, g in shards)
    body = []
    for slug, pairs, g in shards:
        bad = [p for p in pairs if not p['great']]; ok = [p for p in pairs if p['great']]
        accepted = verdicts.get('accepted', {}).get(slug, '')
        sec = f'<section class="shard" id="{slug}"><header><h2>{NAMES[slug]}</h2><p class="score"><b>{g}/{len(pairs)}</b> great · <b>{len(bad)}</b> needs work · mean SSIM {np.mean([p["ssim"] for p in pairs]):.2f}</p></header>'
        if accepted: sec += f'<p class="accepted">Accepted changes (count as Great): {esc(accepted)}</p>'
        if bad: sec += f'<h3 class="h-bad">Needs work · {len(bad)}</h3><div class="grid">' + ''.join(pair_html(slug, p, sha) for p in bad) + '</div>'
        if ok: sec += f'<h3 class="h-ok">Great · {len(ok)}</h3><div class="grid">' + ''.join(pair_html(slug, p, sha) for p in ok) + '</div>'
        body.append(sec + '</section>')
    warn = '<p class="stale">The by-eye verdicts were judged on an earlier run; pairs without a verdict fall back to SSIM ≥ 0.85.</p>' if stale else ''
    return f'''<title>Shardfile vs Legacy Golden</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;700&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* A contact sheet: the per-shard tally first, then one band per shard, Needs work pairs before Great. Tap a pair to see it full size. */
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
html, body {{ overflow-x: hidden; }}
body {{ background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); margin: 0; }}
.wrap {{ max-width: 1240px; margin: 0 auto; padding-block: max(20px, env(safe-area-inset-top, 0px)) max(56px, env(safe-area-inset-bottom, 0px)); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 28px; min-width: 0; }}
h1, h2, h3 {{ font-family: var(--display); text-wrap: balance; margin: 0; }}
h1 {{ font-size: 30px; font-weight: 700; letter-spacing: 0.01em; }}
.meta {{ font: 12px/1.6 var(--mono); color: var(--muted); margin: 6px 0 0; overflow-wrap: anywhere; }}
.meta b {{ color: var(--ink); font-weight: 600; }}
.overall {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; margin-top: 14px; }}
.overall .big {{ font: 700 44px/1 var(--display); color: var(--accent); font-variant-numeric: tabular-nums; }}
.overall span {{ color: var(--muted); }}
.tallies {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 8px; }}
.tally {{ display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center; padding: 10px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; color: inherit; text-decoration: none; min-width: 0; }}
.tally:focus-visible, .tally:hover {{ border-color: var(--accent); outline: none; }}
.tally .nm {{ font: 600 16px var(--display); }}
.tally .ct {{ font: 12px var(--mono); color: var(--muted); text-align: right; }}
.tally .ct b {{ color: var(--ink); }}
.tally .bar {{ grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 3px; }}
.tally .bar i {{ width: 10px; height: 10px; border-radius: 2px; }}
.tally .bar i.g {{ background: var(--good); }} .tally .bar i.n {{ background: var(--bad); }}
.stale {{ margin: 0; padding: 8px 12px; border-left: 3px solid var(--bad); background: var(--badbg); }}
.shard {{ display: grid; gap: 12px; padding-top: 18px; border-top: 2px solid var(--line); scroll-margin-top: 12px; min-width: 0; }}
.shard header {{ display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 16px; }}
h2 {{ font-size: 26px; font-weight: 700; }}
.score {{ margin: 0; font: 13px var(--mono); color: var(--muted); }}
.score b {{ color: var(--ink); font-size: 15px; }}
.accepted {{ margin: 0; color: var(--muted); font-size: 14px; max-width: 75ch; }}
h3 {{ font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }}
.h-bad {{ color: var(--bad); }} .h-ok {{ color: var(--good); }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 12px; min-width: 0; }}
.pair {{ margin: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px; display: grid; gap: 6px; min-width: 0; align-content: start; }}
.pair.bad {{ border-color: color-mix(in srgb, var(--bad) 45%, var(--line)); }}
.pair.open {{ grid-column: 1 / -1; }}
figcaption {{ display: flex; justify-content: space-between; gap: 8px; font: 13px var(--mono); min-width: 0; }}
.cam {{ overflow-wrap: anywhere; }}
.cam b {{ display: inline-block; min-width: 1.8em; text-align: center; background: var(--ink); color: var(--panel); border-radius: 3px; margin-right: 4px; }}
.ssim {{ font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; }}
.poi {{ margin: 0; font-size: 13px; color: var(--muted); }}
.kind {{ font: 600 11px var(--mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); margin-right: 4px; }}
.frames {{ all: unset; cursor: zoom-in; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; min-width: 0; border-radius: 4px; }}
.frames:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
.open .frames {{ cursor: zoom-out; }}
.f {{ display: grid; gap: 3px; min-width: 0; }}
.f img {{ width: 100%; max-width: 100%; height: auto; aspect-ratio: 804 / 1362; display: block; border-radius: 3px; background: var(--line); }}
.open .f img {{ max-width: 540px; justify-self: center; }}
.f span {{ font: 11px var(--mono); color: var(--muted); letter-spacing: 0.03em; }}
.note {{ margin: 0; font-size: 14px; }}
.bad .note {{ background: var(--badbg); padding: 6px 8px; border-radius: 4px; }}
.row {{ font: 600 12px var(--mono); color: var(--panel); background: var(--bad); border-radius: 3px; padding: 1px 5px; margin-right: 6px; }}
.ok .row {{ background: var(--good); }}
footer {{ color: var(--muted); font-size: 13px; max-width: 75ch; }}
</style>
<div class="wrap">
<header>
<h1>Shardfile vs Legacy Golden</h1>
<p class="meta">SHARDFILE build <b>{esc(sha)}</b> · captured <b>{esc(captured)}</b> · LEGACY goldens captured at the same build through the LEGACY button (art/legacy-goldens/&lt;shard&gt;/24, G859)</p>
<p class="meta">24 cameras per shard: the 4 CO6 cameras, then points of interest, coverage across the 500 m cell, 2 aerials and 2 hands close-ups. Chromium, iPhone 16 Pro portrait, phone tier, render scale 2×, seed 357, midday / clear. Frames are the canvas alone (no HUD). SSIM is luma; the verdict is by eye. Tap a pair to open it full size.</p>
<div class="overall"><span class="big">{great}/{total}</span><span>pairs great · {total - great} need work</span></div>
</header>
{warn}
<nav class="tallies" aria-label="Per shard">{tally}</nav>
{''.join(body)}
<footer>When Jake says this wave is good, the SHARDFILE frames of that run become the new goldens in art/shardfile-goldens/ (G859). Clouds, rain, crowds, creatures and the hands' idle sway move between visits, so SSIM is a guide, not a parity claim.</footer>
</div>
<script>
document.addEventListener('click', (e) => {{
  const b = e.target.closest('.frames'); if (!b) return;
  const fig = b.closest('.pair'), open = !fig.classList.contains('open');
  fig.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
  if (open) fig.scrollIntoView({{ block: 'nearest' }});
}});
</script>
'''


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    for name in ('eyes', 'goldens'): sub.add_parser(name).add_argument('--raw', required=True, nargs='+')
    f = sub.add_parser('frames'); f.add_argument('--raw', required=True, nargs='+'); f.add_argument('--run', required=True)
    p = sub.add_parser('page'); p.add_argument('--run', required=True); p.add_argument('--out', required=True); p.add_argument('--captured', default='')
    p.add_argument('--q', type=int, default=38, help='WebP quality of the embedded 540 px frames')
    a = ap.parse_args()
    {'eyes': cmd_eyes, 'goldens': cmd_goldens, 'frames': cmd_frames, 'page': cmd_page}[a.cmd](a)
