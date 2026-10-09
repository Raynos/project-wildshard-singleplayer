import json
SP = '/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/81cffee4-70d4-4229-8860-2e3743d9c0b8/scratchpad'
curve = json.load(open(f'{SP}/curve.json'))
W, H = 1080, 1540
L, R, T, B = 110, 40, 210, 520   # plot box margins (bottom leaves room for the notes)
pw, ph = W - L - R, H - T - B
XMAX, YMAX = 60, 100
X = lambda h: L + h / XMAX * pw
Y = lambda s: T + ph - s / YMAX * ph
style = {
    '_template': ('#1f6feb', 'Template 1 (550-line baseline)'),
    'sunscar-dunes': ('#c2410c', 'Signal Dunes'),
    'far-reach': ('#be185d', 'Sky Reach'),
    'pine-hollow': ('#4d7c0f', 'Pine Hollow'),
    'driftwood-isle': ('#a16207', 'Driftwood'),
    'nalati-grasslands': ('#b91c1c', 'Nalati'),
    'nine-dragon-stack': ('#6d28d9', 'Nine Dragon'),
}
o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">',
     f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
     '<text x="40" y="62" font-size="38" font-weight="bold" fill="#111">Public SDK share vs agent-hours spent on the port</text>',
     '<text x="40" y="104" font-size="25" fill="#444">Each shard re-measured with today\'s scripts/shard-platform.mjs at hourly / 3-hourly</text>',
     '<text x="40" y="136" font-size="25" fill="#444">commits since 2026-10-04; x = cumulative port agent-hours on that shard</text>',
     '<text x="40" y="168" font-size="25" fill="#444">(Codex + Claude session logs, active time, 15-min gap cap). Committed HEAD only.</text>']
for s in range(0, 101, 20):
    o.append(f'<line x1="{L}" y1="{Y(s)}" x2="{W-R}" y2="{Y(s)}" stroke="#e5e7eb" stroke-width="2"/>')
    o.append(f'<text x="{L-14}" y="{Y(s)+9}" font-size="24" text-anchor="end" fill="#555">{s} %</text>')
for h in range(0, XMAX + 1, 10):
    o.append(f'<line x1="{X(h)}" y1="{T}" x2="{X(h)}" y2="{T+ph}" stroke="#f1f5f9" stroke-width="2"/>')
    o.append(f'<text x="{X(h)}" y="{T+ph+34}" font-size="24" text-anchor="middle" fill="#555">{h} h</text>')
o.append(f'<line x1="{L}" y1="{Y(80)}" x2="{W-R}" y2="{Y(80)}" stroke="#111" stroke-width="3" stroke-dasharray="12 8"/>')
o.append(f'<text x="{W-R-8}" y="{Y(80)-10}" font-size="24" text-anchor="end" fill="#111" font-weight="bold">80 % target</text>')
o.append(f'<text x="{L+pw/2}" y="{T+ph+72}" font-size="26" text-anchor="middle" fill="#222">cumulative port agent-hours on the shard</text>')
labels = []
for slug, (col, name) in style.items():
    pts = curve[slug]
    xy = [(X(min(p[1], XMAX)), Y(p[3])) for p in pts]
    big = slug in ('pine-hollow', 'driftwood-isle', 'nalati-grasslands', 'nine-dragon-stack')
    o.append(f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in xy)}" fill="none" stroke="{col}" stroke-width="{3 if big else 6}" {"stroke-dasharray=\"4 6\"" if big else ""}/>')
    # first sample where the witness (headless + replay + ledger) passes: proofs >= 4 for Signal/Sky, mark it
    for p in pts:
        if slug in ('sunscar-dunes', 'far-reach') and p[4] >= 4:
            o.append(f'<circle cx="{X(p[1])}" cy="{Y(p[3])}" r="11" fill="#fff" stroke="{col}" stroke-width="5"/>')
            o.append(f'<text x="{X(p[1]) + (18 if slug=="far-reach" else -10)}" y="{Y(p[3]) - (22 if slug=="far-reach" else 40)}" font-size="22" text-anchor="{"start" if slug=="far-reach" else "middle"}" fill="{col}">witness passes ({p[1]:.0f} h)</text>')
            break
    last = pts[-1]
    if big:
        k = len([l for l in labels if l[4]])
        labels.append((T + ph * 0.42 + k * 36, X(29), col, f'- - {name}: {last[3]:.1f} % after {last[1]:.0f} h', True))
    else:
        labels.append((Y(last[3]), X(min(last[1], XMAX)), col, f'{name} {last[3]:.1f} %, {last[1]:.0f} h', False))
# end labels, de-overlapped
o.append(f'<text x="{X(29)}" y="{T+ph*0.42-40}" font-size="24" fill="#222">Big four, still flat (end points):</text>')
for y, x, col, text, big in labels:
    if big:
        o.append(f'<text x="{x}" y="{y}" font-size="24" font-weight="bold" fill="{col}">{text}</text>'); continue
    anchor = 'end' if x > W - 330 else 'start'
    dx = -12 if anchor == 'end' else 12
    o.append(f'<text x="{x+dx}" y="{y-10}" font-size="24" font-weight="bold" text-anchor="{anchor}" fill="{col}">{text}</text>')
notes = [
    'Template 1 (first samples fail before its SDK commit, 18 h in): 54 → 87 % by ~25 h',
    '  (a 550-line shard: files moved into generators/ + data/), then flat at 87–91 %',
    '  while ~30 h more went to its proofs and hardening.',
    'Signal Dunes: flat ~1 % for ~6 h while its witness was built (proofs 0 → 6 by 12 h),',
    '  then 1 → 19 % in ~6 h of offline bakes (G262), then slowing (19 → 21 % in the next 4 h).',
    'Sky Reach: flat 1.4 % for 16 h (witness to 5 of 6), then 1.4 → 9.7 % in ~2 h of bakes.',
    'Pine, Driftwood, Nalati, Nine Dragon (thin dashed): flat at 0.2–3 % after 10–23 h each;',
    '  their custom lines GREW +2.6–4.1k (renderer-free native runtimes for the witnesses).',
    'Shape: flat while the witness is built, a jump when static builders are baked, then a slower',
    '  tail (behaviour → data / AssemblyScript). Not linear, not a snowball.',
]
for i, n in enumerate(notes):
    o.append(f'<text x="40" y="{T+ph+130+i*40}" font-size="25" fill="#222">{n}</text>')
o.append('</svg>')
open(f'{SP}/share-vs-hours.svg', 'w').write('\n'.join(o))
