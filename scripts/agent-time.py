#!/usr/bin/env python3
"""The build-speed audit numbers on demand (BUILD-SPEED 1.4 A3, E491). Read-only.

    python3 scripts/agent-time.py [--hours N]      (default 24)

Prints, for the window: agent tool-hours by category for Claude and Codex (from their transcripts), the poll share
(Codex wait/sleep calls, Claude pause/poll commands), the push-gate medians (.git/push-gate-steps.jsonl), the push
loop (.git/push-timings.jsonl), the build-slot queue (~/.wildshard-heavy-lanes/build-day.log) and the commit mix
(git log). Every wave's Verify in docs/plans/BUILD-SPEED.md is one run of this script.
"""
import argparse
import datetime as dt
import glob
import json
import os
import re
import statistics
import subprocess
import time
from collections import Counter, defaultdict

RULES = [
    ('heavy-lane', r'heavy-lane\.py'), ('sim-lane', r'sim-lane\.sh'), ('browser-lane', r'browser-lane\.sh'),
    ('build-mirror', r'build-mirror\.mjs'), ('push', r'push-main\.sh|git push'), ('quiet', r'quiet-cli|\.git/quiet'),
    ('serve-build', r'serve-build\.sh'), ('proof-run', r'proof-run\.sh'),
    ('pause/poll', r'(^|[;&|]\s*)sleep\s+\d|\bwait\b|until .*; do'),
    ('git commit', r'git commit'), ('git other', r'\bgit\b'), ('vitest', r'vitest|pnpm test'),
    ('types/lint', r'\btsc\b|pnpm types|oxlint|pnpm lint'), ('build', r'pnpm build|vite build'),
    ('browser', r'playwright|agent-browser|chromium'), ('herdr', r'\bherdr\b'), ('node script', r'\bnode (scripts/|tmp/)'),
    ('python', r'python3?'), ('read', r'^\s*(cat|ls|grep|rg|head|tail|sed -n|wc|find|jq|stat|du|df)\b'),
]


def category(command):
    for name, pattern in RULES:
        if re.search(pattern, command, re.M):
            return name
    return 'other'


def parse_time(value):
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00'))


def claude(cut, root):
    hours = defaultdict(float)
    counts = Counter()
    turns = cache_read = 0
    for path in glob.glob(root + '/**/*.jsonl', recursive=True):
        if dt.datetime.fromtimestamp(os.path.getmtime(path), dt.timezone.utc) < cut:
            continue
        pending = {}
        with open(path, errors='replace') as handle:
            for line in handle:
                try:
                    record = json.loads(line)
                except ValueError:
                    continue
                stamp = record.get('timestamp')
                if not stamp:
                    continue
                at = parse_time(stamp)
                if at < cut:
                    continue
                message = record.get('message') or {}
                content = message.get('content') if isinstance(message.get('content'), list) else []
                if record.get('type') == 'assistant':
                    turns += 1
                    cache_read += (message.get('usage') or {}).get('cache_read_input_tokens', 0) or 0
                    for item in content:
                        if item.get('type') == 'tool_use':
                            name = item.get('name')
                            if name == 'Bash':
                                name = 'Bash:' + category((item.get('input') or {}).get('command', ''))
                            pending[item.get('id')] = (name, at)
                            counts[name] += 1
                elif record.get('type') == 'user':
                    for item in content:
                        if item.get('type') == 'tool_result' and item.get('tool_use_id') in pending:
                            name, started = pending.pop(item['tool_use_id'])
                            seconds = (at - started).total_seconds()
                            if 0 <= seconds <= 7200:
                                hours[name] += seconds / 3600
    return hours, counts, turns, cache_read


def codex(cut, root):
    hours = defaultdict(float)
    counts = Counter()
    compactions = sessions = 0
    for path in glob.glob(root + '/2026/*/*/*.jsonl'):
        if dt.datetime.fromtimestamp(os.path.getmtime(path), dt.timezone.utc) < cut:
            continue
        sessions += 1
        pending = {}
        with open(path, errors='replace') as handle:
            for line in handle:
                try:
                    record = json.loads(line)
                except ValueError:
                    continue
                stamp = record.get('timestamp')
                if not stamp:
                    continue
                at = parse_time(stamp)
                if at < cut:
                    continue
                kind = record.get('type')
                payload = record.get('payload') or {}
                if kind == 'compacted':
                    compactions += 1
                if kind != 'response_item':
                    continue
                item_type = payload.get('type')
                if item_type == 'custom_tool_call' and payload.get('name') == 'exec':
                    command = payload.get('input') or ''
                    name = 'exec:' + category(command if isinstance(command, str) else json.dumps(command))
                    pending[payload.get('call_id')] = (name, at)
                    counts[name] += 1
                elif item_type == 'function_call':
                    name = 'fn:' + str(payload.get('name'))
                    pending[payload.get('call_id')] = (name, at)
                    counts[name] += 1
                elif item_type in ('custom_tool_call_output', 'function_call_output'):
                    call = payload.get('call_id')
                    if call in pending:
                        name, started = pending.pop(call)
                        seconds = (at - started).total_seconds()
                        if 0 <= seconds <= 7200:
                            hours[name] += seconds / 3600
    return hours, counts, sessions, compactions


def rows(path, since):
    out = []
    try:
        with open(path) as handle:
            for line in handle:
                try:
                    record = json.loads(line)
                except ValueError:
                    continue
                if (record.get('at') or record.get('startedAt') or 0) >= since:
                    out.append(record)
    except OSError:
        pass
    return out


def quantiles(values):
    if not values:
        return 'n=0'
    values = sorted(values)
    return 'n=%d med=%.0f p90=%.0f max=%.0f' % (len(values), statistics.median(values), values[int(len(values) * 0.9)], values[-1])


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--hours', type=float, default=24)
    args = parser.parse_args()
    cut = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=args.hours)
    since = time.time() - args.hours * 3600
    repo = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip()
    print('window: last %.0f h, to %s' % (args.hours, dt.datetime.now().strftime('%Y-%m-%d %H:%M')))

    claude_root = os.path.expanduser('~/.claude/projects/' + repo.replace('/', '-'))
    hours, counts, turns, cache_read = claude(cut, claude_root)
    total = sum(hours.values())
    poll = sum(v for k, v in hours.items() if k.startswith('Bash:pause/poll'))
    print('\nClaude: %d assistant turns, %.2fB cache-read tokens, %.1f tool-hours, poll share %.0f%%' % (
        turns, cache_read / 1e9, total, 100 * poll / total if total else 0))
    for name, value in sorted(hours.items(), key=lambda pair: -pair[1])[:10]:
        print('  %-32s %6.2f h  n=%d' % (name, value, counts[name]))

    hours, counts, sessions, compactions = codex(cut, os.path.expanduser('~/.codex/sessions'))
    total = sum(hours.values())
    poll = sum(v for k, v in hours.items() if k in ('fn:wait', 'fn:sleep', 'fn:wait_agent') or k == 'exec:pause/poll')
    print('\nCodex: %d sessions, %d compactions, %.1f tool-hours, poll share %.0f%%' % (
        sessions, compactions, total, 100 * poll / total if total else 0))
    for name, value in sorted(hours.items(), key=lambda pair: -pair[1])[:10]:
        print('  %-32s %6.2f h  n=%d' % (name, value, counts[name]))

    gates = rows(os.path.join(repo, '.git', 'push-gate-steps.jsonl'), since)
    print('\npush gate: %d runs, %d red; total s %s' % (len(gates), sum(1 for g in gates if not g.get('passed')),
                                                        quantiles([g.get('total', 0) for g in gates])))
    for step in ('gen', 'vitest', 'test-products', 'build', 'oxlint'):
        print('  %-14s %s' % (step, quantiles([g[step] for g in gates if isinstance(g.get(step), (int, float))])))
    pushes = rows(os.path.join(repo, '.git', 'push-timings.jsonl'), since)
    print('pushes: %d, red %d; seconds %s; commits per push %s' % (
        len(pushes), sum(1 for p in pushes if p.get('rc') not in (0, None)),
        quantiles([float(p.get('push') or 0) for p in pushes]), quantiles([int(p.get('ahead') or 0) for p in pushes])))
    builds = rows(os.path.expanduser('~/.wildshard-heavy-lanes/build-day.log'), since)
    print('build slots: queue s %s; build s %s' % (quantiles([b.get('queueSeconds', 0) for b in builds]),
                                                    quantiles([b.get('buildSeconds', 0) for b in builds])))

    log = subprocess.check_output(['git', 'log', '--since=%.0f hours ago' % args.hours, '--format=%h%x00%s%x00%b%x01'],
                                  cwd=repo, text=True)
    commits = [entry for entry in log.split('\x01') if entry.strip()]
    kinds = Counter(re.sub(r'\(.*', '', entry.split('\x00')[1].split(':')[0]) for entry in commits)
    agents = Counter((re.search(r'Assisted-by: *([^:\n]+):', entry) or [None, 'human'])[1] for entry in commits)
    print('\ncommits: %d  by kind %s  by agent %s' % (len(commits), dict(kinds.most_common(6)), dict(agents)))
    print('load now: %s' % ' '.join('%.0f' % value for value in os.getloadavg()))


if __name__ == '__main__':
    main()
