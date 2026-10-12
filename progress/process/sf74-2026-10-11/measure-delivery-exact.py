#!/usr/bin/env python3
"""Read only exact first-parent deliveries from recorded origin push events."""
import argparse
import datetime
import json
import math
import re
import statistics
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--hours', type=float, default=12)
parser.add_argument('--at', help='Timezone-aware ISO-8601 end of the window')
parser.add_argument('--head', default='HEAD', help='Committed first-parent chain')
args = parser.parse_args()
if not math.isfinite(args.hours) or args.hours <= 0:
    parser.error('--hours must be finite and positive')
try:
    end = datetime.datetime.fromisoformat(args.at.replace('Z', '+00:00')) if args.at else datetime.datetime.now(datetime.timezone.utc)
except ValueError:
    parser.error('--at must be ISO-8601')
if end.tzinfo is None:
    parser.error('--at must include a timezone')
end = end.astimezone(datetime.timezone.utc)
cut = end.timestamp() - args.hours * 3600


def git(*args):
    return subprocess.check_output(['git', *args], text=True).rstrip(chr(10))


def summary(values):
    values = sorted(values)
    return {'count': len(values),
            'median_seconds': statistics.median(values) if values else None,
            'p90_seconds': values[math.ceil(.9 * len(values)) - 1] if values else None,
            'max_seconds': max(values) if values else None}


head = git('rev-parse', '--verify', args.head + '^{commit}')
fmt = '%H%x09%ct%x09%s%x09%(trailers:key=Generated-Source,valueonly=true,separator=,)'
chain = [line.split(chr(9), 3) for line in git('log', '--first-parent', '--format=' + fmt, head).splitlines()]
positions = {row[0]: index for index, row in enumerate(chain)}
commits = [(sha, int(born), bool(trailer) or 'regenerate committed outputs' in subject.lower()
            or subject == 'chore(gen): refresh committed outputs')
           for sha, born, subject, trailer in chain if cut <= int(born) <= end.timestamp()]
events = []
unmapped = 0
for line in git('reflog', 'show', '--date=unix', '--format=%H %gD %gs', 'refs/remotes/origin/main').splitlines():
    match = re.fullmatch(r'([0-9a-f]{40}) refs/remotes/origin/main@[{]([0-9]+)[}] update by push', line)
    if not match or not cut <= int(match[2]) <= end.timestamp():
        continue
    sha, stamp = match[1], int(match[2])
    if sha not in positions:
        unmapped += 1
    else:
        events.append((stamp, positions[sha]))
events.sort()
latencies, source_latencies, unreached, negative = [], [], [], []
for sha, born, regen in commits:
    arrivals = [stamp for stamp, position in events if position <= positions[sha]]
    arrival = next((stamp for stamp in arrivals if stamp >= born), None)
    if any(stamp < born for stamp in arrivals):
        negative.append(sha)
    if arrival is None:
        unreached.append(sha)
    else:
        latencies.append(arrival - born)
        if not regen:
            source_latencies.append(arrival - born)
regen_count = sum(regen for _, _, regen in commits)
result = {'at': end.isoformat(), 'cutoff': datetime.datetime.fromtimestamp(cut, datetime.timezone.utc).isoformat(),
          'head': head, 'hours': args.hours, 'first_parent_commits': len(commits),
          'regen_commits': regen_count, 'regen_percent': round(100 * regen_count / len(commits), 2) if commits else None,
          'push_updates': len(events) + unmapped, 'all_delivered': summary(latencies),
          'source_delivered': summary(source_latencies), 'unreached': len(unreached),
          'negative_clock_anomalies': negative, 'unmapped_recent_pushes': unmapped,
          'method': 'Committer epochs; earliest recorded update-by-push of a current first-parent descendant. Percentile nearest rank. Full audit and CI/day production targets not measured.'}
print(json.dumps(result, indent=2))
