#!/usr/bin/env python3
"""SF57 leak5: the per-circuit table of a drive.mjs result (heap, GL counts, orphans, stray owner reads, bar scopes).

  python3 table.py <result.json> [label]
"""
import json, sys

r = json.load(open(sys.argv[1]))
label = sys.argv[2] if len(sys.argv) > 2 else r.get('version', {}).get('build', '?')
print(f'{label}: {r.get("version", {}).get("build", "?")}, errors {len(r.get("errors", []))}, failure {"yes" if r.get("failure") else "no"}')
print('| pose | heap MB | Δ MB | GL geometries / textures / programs | orphans live / collected | unowned | stray reads | BossBar / EliteBar / Elites |')
print('| --- | ---: | ---: | --- | --- | ---: | ---: | --- |')
prev = None
for h in r['heap']:
    g = h['gpu']; m = g['memory']; o = g.get('orphans') or {}; s = g.get('scopes') or {}
    bars = ' / '.join(str((s.get(k) or {}).get('n', 0)) for k in ('ui.BossBar', 'ui.EliteBar', 'Elites'))
    d = '' if prev is None else f'{h["usedMB"] - prev:+.1f}'
    print(f'| c{h["cycle"]} | {h["usedMB"]:.1f} | {d} | {m["geometries"]} / {m["textures"]} / {m["programs"]} | {o.get("live")} / {o.get("collected")} | {len(g.get("unowned", []))} | {(h.get("owners") or {}).get("strayReads")} | {bars} |')
    prev = h['usedMB']
