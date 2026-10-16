# Extends ../effort-recount-2026-10-09/curve.py + chart.py onto the G458 ruler: y = custom lines as a % of frozen legacy
# (today's source ruler at each sampled commit, history.mjs), x = cumulative port agent-hours on the shard (effort.py).
#   python3 chart.py <scratch dir> <out dir> <now iso>
# Reads <scratch>/history.json and <scratch>/series.json; writes <out>/curve.json and <scratch>/chart.svg.
import json, sys, datetime
SP, OUT, NOW = sys.argv[1], sys.argv[2], sys.argv[3]
ts = lambda iso: datetime.datetime.fromisoformat(iso.replace('Z', '+00:00')).timestamp()
now = ts(NOW)
hist = [r for r in json.load(open(f'{SP}/history.json')) if 'shards' in r]
missing = [r['t'] for r in json.load(open(f'{SP}/history.json')) if 'shards' not in r]
series = json.load(open(f'{SP}/series.json'))
legacy = {s: r['legacy'] for s, r in hist[-1]['shards'].items() if r['legacy']}
STYLE = {  # the six legacy shards; Template / Ink-Cel / Pastel are native (no legacy), a footnote
    'pine-hollow': ('#3f7d20', 'Pine Hollow', 20),
    'driftwood-isle': ('#b7791f', 'Driftwood', 20),
    'far-reach': ('#c026d3', 'Sky Reach', 10),
    'sunscar-dunes': ('#ea580c', 'Signal Dunes', 10),
    'nalati-grasslands': ('#dc2626', 'Nalati', 20),
    'nine-dragon-stack': ('#4f46e5', 'Nine Dragon', 20),
}
curve = {}
for slug in STYLE:
    pts = []
    for r in hist:
        row = r['shards'].get(slug)
        if not row: continue
        t = ts(r['t'])
        hours = sum(h for (ct, h, k) in series.get(slug, []) if ct <= t and k == 'port')
        pts.append([r['t'], r['sha'][:9], round(hours, 1), round(row['custom'] / legacy[slug] * 100, 1), row['custom']])
    curve[slug] = pts
json.dump({'legacy': legacy, 'missing': missing, 'points': curve}, open(f'{OUT}/curve.json', 'w'), indent=0)

EVENTS = [  # (UTC, symbol, label) from decisions.md / STATE commits
    ('2026-10-09T21:05:00Z', 'diamond', 'G285 bake lanes'),
    ('2026-10-14T04:19:00Z', 'triangle', 'W1 at 10 %, W2 starts'),
    ('2026-10-14T13:14:00Z', 'square', 'W1 closes (G420 grid check)'),
    ('2026-10-16T02:20:00Z', 'circle', 'G447 shardfile redesign; overnight stall'),
    ('2026-10-16T12:00:00Z', 'star', 'G451 rewire starts (12:00 UTC)'),
]
W, H = 1080, 1900
L, R, T, B = 112, 36, 250, 830
pw, ph = W - L - R, H - T - B
XMAX = max(max(p[2] for p in pts) for pts in curve.values())
XMAX = (int(XMAX / 20) + 1) * 20
YMAX = 110
X = lambda h: L + h / XMAX * pw
Y = lambda s: T + ph - min(s, YMAX) / YMAX * ph
o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="36" y="64" font-size="44" font-weight="bold" fill="#111">Custom code vs agent-hours</text>',
     '<text x="36" y="108" font-size="25" fill="#444">Each shard\'s custom lines as a % of its frozen legacy (lower is better),</text>',
     '<text x="36" y="140" font-size="25" fill="#444">re-measured with today\'s source ruler (G458, scripts/shard-platform.mjs) at</text>',
     f'<text x="36" y="172" font-size="25" fill="#444">{len(hist)} commits, 10-04 to {NOW[5:10]} {NOW[11:16]} UTC. x = cumulative port agent-hours</text>',
     '<text x="36" y="204" font-size="25" fill="#444">on the shard (Codex + Claude session logs, 15-min gap cap).</text>']
for s in range(0, YMAX + 1, 10):
    o.append(f'<line x1="{L}" y1="{Y(s)}" x2="{W-R}" y2="{Y(s)}" stroke="{"#e5e7eb" if s % 20 == 0 else "#f3f4f6"}" stroke-width="2"/>')
    if s % 20 == 0: o.append(f'<text x="{L-12}" y="{Y(s)+8}" font-size="23" text-anchor="end" fill="#555">{s} %</text>')
for h in range(0, XMAX + 1, 20):
    o.append(f'<line x1="{X(h)}" y1="{T}" x2="{X(h)}" y2="{T+ph}" stroke="#f3f4f6" stroke-width="2"/>')
    o.append(f'<text x="{X(h)}" y="{T+ph+32}" font-size="23" text-anchor="middle" fill="#555">{h} h</text>')
o.append(f'<text x="{L+pw/2}" y="{T+ph+68}" font-size="25" text-anchor="middle" fill="#222">cumulative port agent-hours on the shard</text>')
o.append(f'<text x="{L+10}" y="{T-12}" font-size="21" fill="#555">lines on the top edge are above 110 % (peaks: Sky 140 %, Pine 118 %)</text>')
for y, label, dash in [(100, '100 % = the legacy shard', '2 6'), (20, '20 % goal', '14 8'), (10, '10 % goal (Sky, Signal)', '6 6')]:
    o.append(f'<line x1="{L}" y1="{Y(y)}" x2="{W-R}" y2="{Y(y)}" stroke="#111" stroke-width="3" stroke-dasharray="{dash}"/>')
    o.append(f'<text x="{W-R-8}" y="{Y(y)-9}" font-size="22" text-anchor="end" fill="#111" font-weight="bold">{label}</text>')

def marker(kind, x, y, col, r=11):
    if kind == 'diamond': return f'<polygon points="{x},{y-r-3} {x+r+3},{y} {x},{y+r+3} {x-r-3},{y}" fill="#fff" stroke="{col}" stroke-width="4"/>'
    if kind == 'triangle': return f'<polygon points="{x},{y-r-3} {x+r+2},{y+r} {x-r-2},{y+r}" fill="#fff" stroke="{col}" stroke-width="4"/>'
    if kind == 'square': return f'<rect x="{x-r+1}" y="{y-r+1}" width="{2*r-2}" height="{2*r-2}" fill="#fff" stroke="{col}" stroke-width="4"/>'
    if kind == 'circle': return f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" stroke="{col}" stroke-width="4"/>'
    pts = []
    import math
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5; rr = r + 4 if i % 2 == 0 else (r + 4) * 0.45
        pts.append(f'{x + rr*math.cos(a):.1f},{y + rr*math.sin(a):.1f}')
    return f'<polygon points="{" ".join(pts)}" fill="{col}" stroke="{col}" stroke-width="2"/>'

cut = now - 12 * 3600
GAP = 30 * 3600
for slug, (col, name, goal) in STYLE.items():
    pts = curve[slug]
    segs = []
    for a, b in zip(pts, pts[1:]):
        ta, tb = ts(a[0]), ts(b[0])
        style = 'gap' if tb - ta > GAP else ('new' if ta >= cut - 1 else 'old')
        segs.append((style, a, b))
    for style, a, b in segs:
        x1, y1, x2, y2 = X(a[2]), Y(a[3]), X(b[2]), Y(b[3])
        if style == 'gap': attrs = f'stroke="{col}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="2 10"'
        elif style == 'old': attrs = f'stroke="{col}" stroke-width="4" stroke-dasharray="3 7" stroke-linecap="round"'
        else: attrs = f'stroke="{col}" stroke-width="7" stroke-linecap="round"'
        o.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" {attrs}/>')
    for iso, kind, _ in EVENTS:
        te = ts(iso)
        for a, b in zip(pts, pts[1:]):
            ta, tb = ts(a[0]), ts(b[0])
            if ta <= te <= tb and tb - ta <= GAP:
                f = (te - ta) / (tb - ta) if tb > ta else 0
                o.append(marker(kind, X(a[2] + f * (b[2] - a[2])), Y(a[3] + f * (b[3] - a[3])), col))
                break
    last = pts[-1]
    o.append(f'<circle cx="{X(last[2]):.1f}" cy="{Y(last[3]):.1f}" r="7" fill="{col}"/>')
# end labels on the right-hand side, de-overlapped, sorted by y
ends = sorted(((Y(curve[s][-1][3]), s) for s in STYLE), key=lambda e: e[0])
placed = []
for y, s in ends:
    y = max(y, (placed[-1] + 30) if placed else y)
    placed.append(y)
    col, name, goal = STYLE[s]; last = curve[s][-1]
    x = X(last[2])
    anchor = 'end' if x > W - 380 else 'start'
    o.append(f'<text x="{x + (-14 if anchor == "end" else 14):.1f}" y="{y + 30:.1f}" font-size="23" font-weight="bold" text-anchor="{anchor}" fill="{col}">{name} {last[3]:.1f} %</text>')
# legend
ly = T + ph + 112
o.append(f'<line x1="40" y1="{ly}" x2="110" y2="{ly}" stroke="#333" stroke-width="4" stroke-dasharray="3 7" stroke-linecap="round"/><text x="122" y="{ly+8}" font-size="23" fill="#222">older than 12 h</text>')
o.append(f'<line x1="330" y1="{ly}" x2="400" y2="{ly}" stroke="#333" stroke-width="7" stroke-linecap="round"/><text x="412" y="{ly+8}" font-size="23" fill="#222">last 12 h</text>')
o.append(f'<line x1="580" y1="{ly}" x2="650" y2="{ly}" stroke="#333" stroke-opacity="0.4" stroke-width="2" stroke-dasharray="2 10"/><text x="662" y="{ly+8}" font-size="23" fill="#222">no reading (10-10 18:00 – 10-13)</text>')
for i, (iso, kind, label) in enumerate(EVENTS):
    cx, cy = 40 + (i % 2) * 520, ly + 50 + (i // 2) * 40
    o.append(marker(kind, cx + 12, cy - 8, '#333', 9) + f'<text x="{cx+36}" y="{cy}" font-size="22" fill="#222">{label}</text>')
for i, (slug, (col, name, goal)) in enumerate(STYLE.items()):
    cx, cy = 40 + (i % 3) * 345, ly + 180 + (i // 3) * 36
    o.append(f'<rect x="{cx}" y="{cy-16}" width="28" height="14" fill="{col}"/><text x="{cx+38}" y="{cy}" font-size="23" fill="#222">{name} (goal {goal} %)</text>')
NOTES = [  # the readout, from the printed points below (re-check them when re-running)
    ('b', 'What moved'),
    ('', 'Before the bakes every line rose: witnesses and native runtimes added code'),
    ('', '  (Pine 86 → 118 %, Sky 76 → 140 % by 10-10). G285 cut Nine 104 → 73 % overnight.'),
    ('', 'W1: Signal 109 → 46 % and Sky 137 → 94 % in ~40 and ~60 port hours; neither hit 10 %.'),
    ('', 'W2 since 10-14 04:19 UTC: Pine 114 → 88 %, Driftwood 112 → 81 % on ~75 port hours each.'),
    ('', 'Flat runs: the 10-14/15 pause (nothing landed), and the 10-16 03:00–12:00 UTC stall'),
    ('', '  while the G447 shardfile redesign held the lanes. Nalati never came down (104 %).'),
    ('', 'Last 12 h: Sky −2.6, Signal −0.1, Pine +0.1, Driftwood 0.0, Nalati and Nine flat.'),
    ('b', 'Why Pine and Driftwood rose today'),
    ('', 'Since 13:00 UTC Pine 85.6 → 87.9 % and Driftwood 78.7 → 80.9 %: the rewire adds readers'),
    ('', '  of the built output to runtime/ while their data/ TypeScript still counts on this source'),
    ('', '  ruler. Those lines go when P4 moves the ruler to out/&lt;slug&gt;/runtime (not landed yet).'),
    ('', 'Template, Ink-Cel and Pastel are native (no legacy to compare against), not drawn.'),
]
for i, (kind, text) in enumerate(NOTES):
    o.append(f'<text x="36" y="{H - 470 + i * 35}" font-size="{25 if kind else 23}" {"font-weight=\"bold\"" if kind else ""} fill="#222">{text}</text>')
o.append('</svg>')
open(f'{SP}/chart.svg', 'w').write('\n'.join(o))
for slug in STYLE:
    p = curve[slug]
    def at(iso):
        best = None
        for q in p:
            if ts(q[0]) <= ts(iso): best = q
        return best
    print(slug, 'start', p[0][3], 'at 10-14 04:19', (at('2026-10-14T04:19:00Z') or [0,0,0,0])[3], '12h ago', (at(datetime.datetime.fromtimestamp(cut, datetime.UTC).strftime('%Y-%m-%dT%H:%M:%SZ')) or [0,0,0,0])[3], 'now', p[-1][3], 'h', p[-1][2])
