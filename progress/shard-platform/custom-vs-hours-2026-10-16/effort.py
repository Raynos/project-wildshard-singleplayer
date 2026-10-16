# Extends ../effort-recount-2026-10-09/effort.py. Agent-hours per commit: each session file is one lane; its active time
# (gaps between log events capped at CAP, 15 min) between its previous commit and this one is this commit's cost; the
# tail after its last commit goes to its last commit. A commit belongs to the session that mentions it first, no earlier
# than 5 min before the commit time (sessions.py). Writes series.json: per shard, (commit time, hours, port|other).
#   python3 effort.py <scratch dir> [cap minutes]
import json, sys, bisect, collections
SP = sys.argv[1]
CAP = float(sys.argv[2]) * 60 if len(sys.argv) > 2 else 15 * 60
sessions = json.load(open(f'{SP}/sessions.json'))
commits = json.load(open(f'{SP}/commits.json'))
full = {c['sha']: c for c in commits}
owner = {}
for i, s in enumerate(sessions):
    for sha, t in s['commits'].items():
        c = full.get(sha)
        if c is None or t < c['t'] - 300: continue
        if sha not in owner or t < owner[sha][1]: owner[sha] = (i, t)
cost = collections.Counter()
total_active = 0.0
for i, s in enumerate(sessions):
    st = s['stamps']
    act = [0.0]
    for a, b in zip(st, st[1:]):
        act.append(act[-1] + min(b - a, CAP))
    total_active += act[-1]
    mine = sorted((t, sha) for sha, (j, t) in owner.items() if j == i)
    prev = 0.0
    for k, (t, sha) in enumerate(mine):
        idx = bisect.bisect_right(st, t) - 1
        upto = act[max(idx, 0)] if k < len(mine) - 1 else act[-1]
        cost[sha] += max(upto - prev, 0); prev = upto
buckets = collections.defaultdict(collections.Counter)
series = collections.defaultdict(list)
for sha, h in cost.items():
    c = full[sha]; h /= 3600
    if not c['shards']:
        buckets['shared-systems' if c['port'] else 'other']['port' if c['port'] else 'other'] += h; continue
    for s in c['shards']:
        kind = 'port' if c['port'] else 'other'
        buckets[s][kind] += h / len(c['shards'])
        series[s].append((c['t'], h / len(c['shards']), kind))
print(f'cap {CAP/60:.0f} min; sessions {len(sessions)}; active lane-hours {total_active/3600:.0f}; commits costed {len(cost)} of {len(commits)}')
for k in sorted(buckets, key=lambda k: -sum(buckets[k].values())):
    b = buckets[k]; print(f'  {k:20s} port {b["port"]:7.1f} h  other {b["other"]:7.1f} h')
json.dump({k: sorted(v) for k, v in series.items()}, open(f'{SP}/series.json', 'w'))
json.dump({k: dict(v) for k, v in buckets.items()}, open(f'{SP}/buckets.json', 'w'))
