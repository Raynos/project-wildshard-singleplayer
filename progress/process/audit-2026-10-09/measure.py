#!/usr/bin/env python3
"""Fleet audit numbers for a time window, so the 2026-10-09 baseline can be re-measured after the cuts.

    python3 progress/process/audit-2026-10-09/measure.py [--hours 12] [--ci]

Read-only: git log / reflog, ~/.claude/projects/<repo>/**/*.jsonl, ~/.codex/sessions/**/*.jsonl, and `gh run list` with --ci.
"""
import argparse, collections, datetime, glob, json, os, re, statistics as st, subprocess, time

ap = argparse.ArgumentParser()
ap.add_argument('--hours', type=float, default=12)
ap.add_argument('--ci', action='store_true')
a = ap.parse_args()
cut = time.time() - a.hours * 3600
since = f'{int(a.hours * 60)} minutes ago'
ts = lambda s: datetime.datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
med = lambda v: round(st.median(v), 1) if v else 0
pct = lambda v, p: round(sorted(v)[int(len(v) * p)], 1) if v else 0

# ── commits ──
out = subprocess.run(['git', 'log', f'--since={since}', '--format=@@%H|%at|%s', '--name-only'], capture_output=True, text=True).stdout
commits, cur = [], None
for line in out.splitlines():
    if line.startswith('@@'):
        h, t, s = line[2:].split('|', 2); cur = dict(h=h, t=int(t), s=s, files=[]); commits.append(cur)
    elif line.strip() and cur: cur['files'].append(line.strip())
def kind(c):
    s, areas = c['s'].lower(), {f.split('/')[0] for f in c['files']}
    if 'regenerate committed outputs' in s: return 'regen'
    if areas and areas <= {'docs', 'project'}: return 'plan/doc only'
    if areas and areas <= {'progress', 'docs', 'test', 'art', 'budgets', 'project'} and not any(f.startswith('test/') and not f.startswith('test/parity/baselines/') for f in c['files']): return 'receipt only'
    if 'rebake' in s: return 'rebake'
    return 'code/other'
k = collections.Counter(kind(c) for c in commits)
print(f'commits {len(commits)} ({len(commits) / a.hours:.1f}/h):', dict(k))
print('  touch docs/plans/SHARD-PLATFORM.md:', sum('docs/plans/SHARD-PLATFORM.md' in c['files'] for c in commits),
      '| handoff-file versions:', sum(f.startswith('progress/shard-platform/handoffs/') for c in commits for f in c['files']))
body = subprocess.run(['git', 'log', f'--since={since}', '--format=%B'], capture_output=True, text=True).stdout
print('  "Plan-State: unchanged" trailers:', body.count('Plan-State: unchanged'), '| Generated-Increase trailers:', body.count('Generated-Increase'))

# ── push path: origin/main updates and commit → origin latency ──
ev = []
for l in subprocess.run(['git', 'reflog', 'show', '--date=unix', 'refs/remotes/origin/main'], capture_output=True, text=True).stdout.splitlines():
    m = re.match(r'(\w+) refs/remotes/origin/main@\{(\d+)\}', l)
    if m and int(m.group(2)) >= cut: ev.append((int(m.group(2)), m.group(1)))
ev.sort(); lat = []
for c in commits:
    for t, h in ev:
        if t >= c['t'] and subprocess.run(['git', 'merge-base', '--is-ancestor', c['h'], h]).returncode == 0: lat.append((t - c['t']) / 60); break
gaps = [(b[0] - a_[0]) / 60 for a_, b in zip(ev, ev[1:])]
print(f'pushes {len(ev)} | push interval median {med(gaps)} min | commit→origin median {med(lat)} min, p90 {pct(lat, .9)} min')

# ── Claude transcripts (coordinator + subagents) ──
D = os.path.expanduser('~/.claude/projects/-Users-raynos-projects-games-wildshard-singleplayer')
B = [('poll/wait', r'\bsleep\b|until |while '), ('full suite', r'heavy-lane\.py full-test|vitest run(\s*$|\s*[|>)&;2])'),
     ('vitest', r'vitest'), ('proofs', r'parity|physics-baseline|boot-smoke|soak|frame-floor|sim-lane|webkit'),
     ('export/land', r'git archive|commit-tree|update-ref|GIT_INDEX_FILE|generated-files\.mjs|link-node-modules'),
     ('push/gate', r'push-main|vercel-tree-gate'), ('build/serve', r'vite build|serve-build|pnpm build'),
     ('plan/handoff', r'SHARD-PLATFORM\.md|handoffs/'), ('commit', r'git (-c \S+ )*commit'), ('git read', r'git '), ('herdr', r'herdr')]
n, d, spans = collections.Counter(), collections.Counter(), []
for f in glob.glob(D + '/**/*.jsonl', recursive=True):
    if os.path.getmtime(f) < cut: continue
    pend, first, last = {}, None, None
    for line in open(f, errors='ignore'):
        try: o = json.loads(line)
        except ValueError: continue
        if not o.get('timestamp') or ts(o['timestamp']) < cut: continue
        t = ts(o['timestamp']); first = first or t; last = t
        c = (o.get('message') or {}).get('content')
        if not isinstance(c, list): continue
        for b in c:
            if b.get('type') == 'tool_use' and b['name'] == 'Bash': pend[b['id']] = (t, b['input'].get('command', ''))
            elif b.get('type') == 'tool_result' and b.get('tool_use_id') in pend:
                t0, cmd = pend.pop(b['tool_use_id'])
                key = next((name for name, rx in B if re.search(rx, cmd)), 'other'); n[key] += 1; d[key] += t - t0
    if first: spans.append(last - first)
print(f'claude: {len(spans)} transcripts, {sum(spans) / 3600:.1f} agent-h; Bash hours by kind:')
print('  ' + ' · '.join(f'{x} {d[x] / 3600:.1f} h ({n[x]})' for x, _ in d.most_common()))

# ── Codex sessions ──
acq, fin, sleep_s, cspan = collections.defaultdict(list), collections.defaultdict(list), 0, 0
for f in glob.glob(os.path.expanduser('~/.codex/sessions/**/*.jsonl'), recursive=True):
    if os.path.getmtime(f) < cut: continue
    seen, first, last = set(), None, None
    for line in open(f, errors='ignore'):
        if '"response_item"' not in line: continue
        try: o = json.loads(line)
        except ValueError: continue
        t = ts(o['timestamp'])
        if t < cut: continue
        first = first or t; last = t; p = o['payload']
        if p.get('type') == 'function_call' and p.get('name') == 'sleep':
            try: sleep_s += json.loads(p['arguments']).get('duration_ms', 0) / 1000
            except ValueError: pass
        if p.get('type') != 'custom_tool_call_output': continue
        txt = ''.join(x.get('text', '') for x in p.get('output', []) if isinstance(x, dict)).replace('\\n', '\n')
        for r, s in re.findall(r'heavy-lane: acquired ([a-z-]+) after ([0-9.]+) ?s', txt):
            if (r, s) not in seen: seen.add((r, s)); acq[r].append(float(s))
        for r, s in re.findall(r'heavy-lane: finished ([a-z-]+) in ([0-9.]+) ?s', txt):
            if ('f', r, s) not in seen: seen.add(('f', r, s)); fin[r].append(float(s))
    if first: cspan += last - first
print(f'codex: {cspan / 3600:.1f} agent-h, explicit sleep {sleep_s / 3600:.1f} h')
for r in sorted(set(acq) | set(fin)):
    print(f'  heavy-lane {r}: {len(fin[r])} runs, median {med(fin[r])} s, {sum(fin[r]) / 3600:.1f} h | queue waits {len(acq[r])}, median {med(acq[r])} s, {sum(acq[r]) / 3600:.1f} h')

# ── sim-lane reaper ──
sim = sum(1 for l in open(os.path.expanduser('~/.sim-lane/reap.log'), errors='ignore')
          if l[:19] >= datetime.datetime.fromtimestamp(cut).strftime('%Y-%m-%d %H:%M:%S') and 'quit Simulator.app' in l)
print(f'sim-lane: {sim} "quit Simulator.app (nothing booted)" reaps')

# ── CI ──
if a.ci:
    runs = json.loads(subprocess.run(['gh', 'run', 'list', '--limit', '500', '--json', 'workflowName,conclusion,status,createdAt,startedAt,updatedAt'], capture_output=True, text=True).stdout)
    c = collections.Counter((r['workflowName'], r['conclusion'] or r['status']) for r in runs if ts(r['createdAt']) >= cut)
    print('ci runs:', ', '.join(f'{w} {o} {v}' for (w, o), v in sorted(c.items())))
