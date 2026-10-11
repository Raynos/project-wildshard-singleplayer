#!/usr/bin/env python3
"""Read-only SF74 delivery census; no tests, exports or transcript scanning."""
import argparse
import datetime
import json
import math
from pathlib import Path
import re
import statistics
import subprocess
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--hours', type=float, default=12)
args = parser.parse_args()
if not math.isfinite(args.hours) or args.hours <= 0:
    parser.error('--hours must be finite and positive')
now = time.time()
cut = now - args.hours * 3600


def run(*command):
    return subprocess.check_output(command, text=True)


def summary(values):
    values = sorted(values)
    return {'count': len(values),
            'median': round(statistics.median(values), 2) if values else None,
            'p90': round(values[int(len(values) * .9)], 2) if values else None}


since = datetime.datetime.fromtimestamp(cut, datetime.timezone.utc).isoformat()
commits = [line.split('\t', 2) for line in
           run('git', 'log', '--since=' + since, '--format=%H\t%at\t%s').splitlines()]
remaining = {sha: int(stamp) for sha, stamp, _subject in commits}
events = []
# %at is the commit's time, not the time it reached origin. Use the reflog selector.
for line in run('git', 'reflog', 'show', '--date=unix', '--format=%H %gD',
                'refs/remotes/origin/main').splitlines():
    match = re.fullmatch(r'(\w+) refs/remotes/origin/main@\{(\d+)\}', line)
    if match and int(match[2]) >= cut:
        events.append((int(match[2]), match[1]))
latencies = []
for observed, sha in sorted(events):
    reachable = set(run('git', 'rev-list', sha).splitlines())
    for candidate, born in list(remaining.items()):
        if born <= observed and candidate in reachable:
            latencies.append((observed - born) / 60)
            del remaining[candidate]


def records(name):
    result = []
    for line in Path('.git/' + name + '.jsonl').read_text().splitlines():
        try:
            row = json.loads(line)
            if row.get('at', 0) >= cut:
                result.append(row)
        except ValueError:
            pass  # Ignore a concurrent torn append, never infer a green record.
    return result


gates, pushes = records('gate-timings'), records('push-timings')
regen = [sha for sha, _stamp, subject in commits
         if 'regenerate committed outputs' in subject.lower()
         or subject == 'chore(gen): refresh committed outputs']
runs = json.loads(run('gh', 'run', 'list', '--workflow', 'deploy', '--limit', '100',
                      '--json', 'createdAt,event,status,conclusion,databaseId,headSha'))
recent = [row for row in runs if datetime.datetime.fromisoformat(
          row['createdAt'].replace('Z', '+00:00')).timestamp() >= cut]
completed_push = [row for row in recent if row['event'] == 'push' and row['status'] == 'completed']
result = {
    'at': datetime.datetime.fromtimestamp(now, datetime.timezone.utc).isoformat(),
    'hours': args.hours, 'commits': len(commits), 'originUpdates': len(events),
    'reachedLatencyMinutes': summary(latencies), 'unreached': len(remaining),
    'oldestUnreachedMinutes': round((now - min(remaining.values())) / 60, 2) if remaining else None,
    'regenerationCommits': len(regen),
    'regenerationPercent': round(len(regen) / len(commits) * 100, 2) if commits else None,
    'gateWallSeconds': {mode: summary([row['wall'] for row in gates if row['mode'] == mode])
                        for mode in sorted({row['mode'] for row in gates})},
    'gateResults': {verdict: sum(row['ok'] is verdict for row in gates) for verdict in (True, False)},
    'regenerationSeconds': summary([row['regen'] for row in pushes]),
    'completedPushCI': {verdict: sum(row['conclusion'] == verdict for row in completed_push)
                        for verdict in sorted({row['conclusion'] for row in completed_push})},
    'releaseStarts': [{'id': row['databaseId'], 'at': row['createdAt'], 'result': row['conclusion']}
                      for row in recent if row['event'] in ('schedule', 'workflow_dispatch')],
    'ciWindowComplete': len(runs) < 100 or any(row not in recent for row in runs),
}
print(json.dumps(result, indent=2))
