#!/usr/bin/env python3
"""SF67 loading audit infographic: time-to-playable per shard, split into phases, long tasks marked.

  python3 progress/loading/audit-2026-10-08/infographic.py   (reads summary.json, writes infographic.jpg)"""
import json, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(HERE, 'summary.json')))
BG, INK, MUTED, GRID = '#0f141b', '#e8edf2', '#93a1b0', '#263241'
COLORS = {'modules': '#5b6b7d', 'admission': '#b07cd8', 'engine world': '#3f8fd2', 'shard world': '#e8a33d',
          'creatures, weapons, HUD': '#4fb39a', 'shaders, first frame': '#d8d257', 'audio, finish': '#d96a8a'}
LABEL = {'modules': 'App modules', 'admission': 'Shardfile admission', 'engine world': 'Engine world (renderer … buildings)',
         'shard world': "Shard's world build (Props step)", 'creatures, weapons, HUD': 'Creatures, weapons, HUD, title art',
         'shaders, first frame': 'Shaders + first frame', 'audio, finish': 'Audio + finish (probe, HUD start)'}
LANES = [('chromium-4x', 'Desktop Chromium · iPhone 16 Pro emulation · 4× CPU (phone proxy)'),
         ('simulator-safari', 'iOS Simulator Safari (Mac CPU, WebKit)'),
         ('chromium-1x', 'Desktop Chromium · iPhone 16 Pro emulation · 1× CPU')]
ORDER = ['Driftwood', 'Nalati', 'Template', 'Pine Hollow']

W, H = 12, 21.5
fig = plt.figure(figsize=(W, H), dpi=100, facecolor=BG)
fig.text(0.04, 0.975, 'Wildshard loading audit', color=INK, fontsize=26, weight='bold', va='top')
fig.text(0.04, 0.957, 'SF67 / E461 · SHARD SELECT → playable · build 46d6962 · 2026-10-08', color=MUTED, fontsize=13, va='top')

ax = fig.add_axes([0.235, 0.405, 0.725, 0.52], facecolor=BG)
rows = []
for lane, title in LANES:
    rows.append(('title', title))
    for shard in ORDER:
        for r in S['runs']:
            if r['lane'] == lane and r['shard'] == shard:
                rows.append(('run', r))
y = 0
yt, ylab = [], []
XMAX = 13000
for kind, item in rows:
    if kind == 'title':
        y += 0.55
        ax.text(-0.255 * XMAX, y, item, color=INK, fontsize=11.5, weight='bold', va='center', ha='left', clip_on=False)
        y += 0.75
        continue
    r = item
    for name, start, dur in r['phases']:
        ax.add_patch(Rectangle((start, y - 0.32), dur, 0.5, color=COLORS[name], lw=0))
    end = r['playMs'] if r['playMs'] else (r['phases'][-1][1] + r['phases'][-1][2] if r['phases'] else 0)
    if r['status'] != 'ok':
        ax.add_patch(Rectangle((end, y - 0.32), XMAX * 0.012, 0.5, color='#ff4d4d', lw=0))
        if end > 0.72 * XMAX: ax.text(end - XMAX * 0.01, y - 0.07, 'blocked at Shaders (known P0)', color='#0f141b', fontsize=9, va='center', ha='right', weight='bold')
        else: ax.text(end + XMAX * 0.02, y - 0.07, 'blocked at Shaders (known P0)', color='#ff8080', fontsize=9, va='center')
    else:
        ax.text(end + XMAX * 0.01, y - 0.07, f"{end / 1000:.1f} s", color=INK, fontsize=10, va='center')
    for t, d in r['long']:
        if d >= 100:
            ax.add_patch(Rectangle((t, y + 0.22), d, 0.2, color='#ff4d4d', lw=0))
    yt.append(y - 0.07)
    ylab.append(f"{r['shard']} · {r['cache']}")
    y += 0.78
ax.set_xlim(0, XMAX)
ax.set_ylim(y, 0)
ax.set_yticks(yt)
ax.set_yticklabels(ylab, color=INK, fontsize=10)
ax.tick_params(axis='x', colors=MUTED, labelsize=10)
ax.set_xticks(range(0, XMAX + 1, 1000))
ax.set_xticklabels([f'{s} s' for s in range(0, XMAX // 1000 + 1)])
for s in range(0, XMAX + 1, 1000):
    ax.axvline(s, color=GRID, lw=0.6, zorder=0)
for sp in ax.spines.values():
    sp.set_visible(False)
ax.tick_params(axis='y', length=0)

# legend
lx, ly = 0.04, 0.392
for i, (k, c) in enumerate(COLORS.items()):
    col, row = i % 2, i // 2
    fx, fy = lx + col * 0.47, ly - row * 0.016
    fig.patches.append(Rectangle((fx, fy - 0.004), 0.018, 0.009, color=c, transform=fig.transFigure, figure=fig))
    fig.text(fx + 0.024, fy, LABEL[k], color=INK, fontsize=10.5, va='center')
fx, fy = lx + 0.47, ly - 3 * 0.016
fig.patches.append(Rectangle((fx, fy - 0.002), 0.018, 0.005, color='#ff4d4d', transform=fig.transFigure, figure=fig))
fig.text(fx + 0.024, fy, 'Main-thread task ≥ 100 ms (Simulator: frame gap ≥ 100 ms)', color=INK, fontsize=10.5, va='center')

# long tasks
top = []
for r in S['runs']:
    if r['lane'] == 'chromium-4x' and r['cache'] == 'cold':
        for t in r['tasks']:
            incl = ' '.join(t['incl'])
            owner = t['owner']
            if 'Minimap.ts' in incl: owner = 'first frame: minimap terrain from noise + probe fingerprint'
            elif 'KurganDungeon' in incl: owner = 'Kurgan dungeon + boss arena built, voxel AO'
            elif 'NomadCamp' in incl: owner = 'camps and painted kit: geometry, paint, voxel AO'
            top.append((t['ms'], r['shard'], 'ready' if t['step'] == 'audio' else t['step'], owner))
NAMES = {
    'probe.ts:171': 'debug probe fingerprint: JS SHA-256 of every shader',
    'coverTriangles': 'Blender island cover walk + procedural cove',
    'Physics.ts:43': 'rocks: geometry + Rapier colliders',
    'palm.ts:45': 'palms + ground cover generated',
    'shadowChunks.ts:74': 'shadow chunking: triangles sorted by cell',
    'budget.ts:34': 'shardfile memory preflight (worstContentCost)',
    'voxelAO.ts:62': 'voxel AO ray-marched per model',
    'granite.ts:11': 'outcrops: granite geometry + paint',
    'nalatiArms.ts:287': 'first-person arms built',
    'loft.ts:123': 'creature geometry lofted',
    'noise.ts:19': 'sky clouds from noise',
    'gpuLabels.ts:184': 'GPU-recovery snapshot on page hide',
    'shrine.ts:105': 'shrine model built + voxel AO',
    'hibiscusBush.ts:151': 'hibiscus bushes generated',
    'geometryKit.ts:140': 'dressing geometry + paint',
}
def nice(owner):
    if ' ' in owner and not owner.split(' ')[-1].startswith('src/'): return owner
    for k, v in NAMES.items():
        if k in owner:
            return v
    return owner.split(' ')[-1].replace('src/src/', '')
top.sort(reverse=True)
fig.text(0.04, 0.322, 'Longest main-thread tasks · 4× CPU, cold', color=INK, fontsize=15, weight='bold', va='top')
seen = 0
for i, (ms, shard, step, owner) in enumerate(top[:12]):
    yy = 0.300 - i * 0.0158
    fig.text(0.04, yy, f'{ms:>5} ms', color='#ff8080', fontsize=11, family='monospace', va='center')
    fig.text(0.135, yy, f'{shard} · {step}', color=MUTED, fontsize=10.5, va='center')
    fig.text(0.34, yy, nice(owner), color=INK, fontsize=10.5, va='center')

fig.text(0.04, 0.100, 'What to do (expected saving at 4× CPU)', color=INK, fontsize=15, weight='bold', va='top')
FIXES = [
    '1  Lazy probe fingerprint, harness only: −0.3 to −0.9 s, the ready-frame freeze goes',
    '2  Bake code-built models, AO, shadow index and minimap in wildshard build: −2.5 s Driftwood, −4 s Nalati',
    '3  Move the shardfile preflight to the build (cost per content hash): −0.2 to −0.8 s per load',
    '4  Progress from inside every step; fix the "Downloading" line while building',
    '5  GPU memory journal and draw labels in Developer only: −5 to −10 % of load JS',
]
for i, line in enumerate(FIXES):
    fig.text(0.04, 0.078 - i * 0.0158, line, color=INK, fontsize=11, va='center')

out_png = os.path.join(HERE, 'infographic.png')
fig.savefig(out_png, facecolor=BG)
Image.open(out_png).convert('RGB').save(os.path.join(HERE, 'infographic.jpg'), quality=86, optimize=True)
os.remove(out_png)
print('wrote infographic.jpg')
