#!/usr/bin/env python3
"""SF67 loading audit: fold the scratch captures into summary.json (phases per run, long tasks / rAF gaps).

  python3 progress/loading/audit-2026-10-08/summarize.py <cap4 dir> <cap1 dir> <sim dir>

cap4 = capture.mjs at 4x CPU with traces + analyze.mjs output (an-cold.json, an.json); cap1 = capture.mjs at 1x
(untraced); sim = sim.mjs runs. Phase boundaries come from the loading screen's data-step log."""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
cap4, cap1, sim = sys.argv[1:4]
GROUPS = [  # (phase, first step of the phase)
    ('modules', None), ('admission', 'admission.descriptor'), ('engine world', 'renderer'),
    ('shard world', 'props'), ('creatures, weapons, HUD', 'animals'), ('shaders, first frame', 'shaders'), ('audio, finish', 'audio'),
]
SHARDS = [('driftwood-isle', 'Driftwood'), ('nalati-grasslands', 'Nalati'), ('_template', 'Template'), ('pine-hollow', 'Pine Hollow')]


def phases(steps, play):
    first = {}
    for t, s in steps:
        if s.startswith('LOADEL'):
            continue
        k = s.split(' | ')[0]
        first.setdefault(k, t)
    marks = [(name, 0 if key is None else first.get(key)) for name, key in GROUPS]
    marks = [(n, t) for n, t in marks if t is not None]
    out = []
    for i, (n, t) in enumerate(marks):
        end = marks[i + 1][1] if i + 1 < len(marks) else (play if play else max(x[0] for x in steps))
        out.append([n, t, max(0, end - t)])
    return out


def load(path):
    with open(path) as f:
        return json.load(f)


runs = []
an = {r['base']: r for r in load(os.path.join(cap4, 'an.json'))}
for r in load(os.path.join(cap4, 'an-cold.json')):
    an[r['base']] = r
for slug, name in SHARDS:
    for cache in ('cold', 'warm'):
        base = f'{slug}-{cache}'
        for lane, d, cpu in (('chromium-4x', cap4, 4), ('chromium-1x', cap1, 1)):
            p = os.path.join(d, base + '.json')
            if not os.path.exists(p):
                continue
            rec = load(p)
            play = rec.get('playMs')
            longs = [[t, dur] for t, dur in rec['long'] if dur >= 50 and (play is None or t <= play + 300)]
            tasks = []
            if lane == 'chromium-4x' and base in an:
                for t in an[base]['longTasks']:
                    owner = t['appLeaf'][0][0] if t['appLeaf'] else (t['self'][0][0] if t['self'] else '?')
                    tasks.append({'at': t['atMs'], 'ms': t['durMs'], 'step': t['step'], 'owner': owner,
                                  'leaf': [x[0] for x in t['appLeaf'][:3]], 'incl': [x[0] for x in t['inclApp'][:12]]})
            runs.append({'lane': lane, 'shard': name, 'slug': slug, 'cache': cache, 'cpu': cpu, 'status': 'ok' if play else 'blocked',
                         'playMs': play, 'readyMs': rec.get('readyMs'), 'phases': phases(rec['steps'], play),
                         'long': longs, 'tasks': tasks, 'programs': rec.get('programs'),
                         'lastStep': [s for s in rec['steps'] if not s[1].startswith('LOADEL')][-1]})
    for run_name, label in (('a', 'first'), ('b', 'second')):
        p = os.path.join(sim, f'{slug}-{run_name}.sim.json')
        if not os.path.exists(p):
            continue
        rec = load(p)
        ready = rec.get('ready') or None
        play = rec.get('playAt') if ready else None
        gaps = [[t, g] for t, g in rec.get('gaps') or [] if play is None or t <= play + 300]
        runs.append({'lane': 'simulator-safari', 'shard': name, 'slug': slug, 'cache': label, 'cpu': 1, 'status': 'ok' if play else 'blocked',
                     'playMs': play, 'readyMs': ready, 'phases': phases(rec['steps'], play), 'long': gaps, 'tasks': [],
                     'programs': rec.get('programs'), 'lastStep': rec['steps'][-1] if rec.get('steps') else None})

with open(os.path.join(sim, 'agg.json')) as f:
    agg = json.load(f)
summary = {'build': '46d6962-muzq309n', 'runs': runs,
           'simulatorProfile': [{'file': a['file'], 'samples': a['samples'], 'firstApp': a['firstApp'][:12]} for a in agg]}
with open(os.path.join(HERE, 'summary.json'), 'w') as f:
    json.dump(summary, f, indent=1)
for r in runs:
    print(f"{r['lane']:17} {r['shard']:12} {r['cache']:6} play={r['playMs']} " + ' '.join(f"{n}={d}" for n, _, d in r['phases']))
