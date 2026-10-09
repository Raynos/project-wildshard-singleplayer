# Agent-hours per commit: each session file is one lane; its active time (gaps between log events capped at CAP) between
# its previous commit and this one is this commit's cost; the tail after its last commit goes to its last commit.
import json, re, sys, bisect, collections
SP = '/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/81cffee4-70d4-4229-8860-2e3743d9c0b8/scratchpad'
CAP = float(sys.argv[1]) * 60 if len(sys.argv) > 1 else 15 * 60
sessions = json.load(open(f'{SP}/sessions.json'))
commits = json.load(open(f'{SP}/commits.json'))
full = {c['sha']: c for c in commits}
def resolve(short):
    hits = [s for s in full if s.startswith(short)]
    return hits[0] if len(hits) == 1 else None
# a sha seen in several logs belongs to the earliest
owner = {}
for i, s in enumerate(sessions):
    for short, t in s['commits'].items():
        sha = resolve(short)
        if sha and (sha not in owner or t < owner[sha][1]): owner[sha] = (i, t)
bysub = {}
for c in commits:
    if c['subj'].startswith('SHARD-PLATFORM '): bysub.setdefault(c['subj'][15:55], []).append(c)
sub_owner = {}
for i, s in enumerate(sessions):
    for key, t in s.get('subs', {}).items():
        for c in bysub.get(key, []):
            if t <= c['t'] + 180 and (c['sha'] not in sub_owner or t < sub_owner[c['sha']][1]): sub_owner[c['sha']] = (i, t)
for sha, (i, t) in sub_owner.items():
    c = full[sha]
    # the commit lands at its commit time in the author's timeline
    if sha not in owner: owner[sha] = (i, float(c['t']))
cost = collections.Counter()
total_active = attributed_active = 0.0
fleet = collections.Counter()  # active seconds per 1 h wall bucket (fleet concurrency)
for i, s in enumerate(sessions):
    st = s['stamps']
    act = [0.0]
    for a, b in zip(st, st[1:]):
        g = min(b - a, CAP); act.append(act[-1] + g); fleet[int(a // 3600)] += g
    total_active += act[-1]
    mine = sorted((t, sha) for sha, (j, t) in owner.items() if j == i)
    if not mine: continue
    prev = 0.0
    for k, (t, sha) in enumerate(mine):
        idx = bisect.bisect_right(st, t) - 1
        upto = act[max(idx, 0)] if k < len(mine) - 1 else act[-1]
        cost[sha] += max(upto - prev, 0); prev = upto
    attributed_active += act[-1]
M1 = re.compile(r'SHARD-PLATFORM (?:SF[0-9]|SF1[0-6]|SF8)[a-z]?\b')
buckets = collections.defaultdict(lambda: collections.Counter())
series = collections.defaultdict(list)  # per shard: (time, port hours)
for sha, h in cost.items():
    c = full[sha]; h /= 3600
    shards = c['shards'] or (['_template'] if M1.search(c['subj']) else [])
    if not shards:
        key = 'shared-systems' if c['port'] else ('platform-other' if c['platform'] else 'non-plan')
        buckets[key]['port' if c['port'] else 'other'] += h; continue
    for s in shards:
        kind = 'port' if (c['port'] or (s == '_template' and M1.search(c['subj']))) else 'other'
        buckets[s][kind] += h / len(shards)
        series[s].append((c['t'], h / len(shards), kind))
print(f'cap {CAP/60:.0f} min; sessions {len(sessions)}; active lane-hours {total_active/3600:.0f}; in sessions that committed {attributed_active/3600:.0f}; commits costed {len(cost)} of {len(commits)}')
for k in sorted(buckets, key=lambda k: -sum(buckets[k].values())):
    b = buckets[k]; print(f'  {k:20s} port {b["port"]:7.1f} h  other {b["other"]:7.1f} h')
# fleet concurrency: mean active lanes per wall hour over hours with any activity
hrs = sorted(fleet); print('mean concurrent active lanes (active hours only):', round(sum(fleet.values()) / 3600 / max(len(hrs), 1), 1), 'over', len(hrs), 'h')
json.dump({k: sorted(v) for k, v in series.items()}, open(f'{SP}/series.json', 'w'))
json.dump({k: dict(v) for k, v in buckets.items()}, open(f'{SP}/buckets.json', 'w'))
rows = collections.Counter()
for sha, h in cost.items():
    m = re.match(r'SHARD-PLATFORM (SF\d+[a-z]?(?:-[gp])?)', full[sha]['subj'])
    if m: rows[m.group(1)] += h / 3600
print('per row h:', ', '.join(f'{k} {v:.1f}' for k, v in sorted(rows.items(), key=lambda kv: -kv[1])[:45]))
