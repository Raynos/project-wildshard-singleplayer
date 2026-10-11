#!/usr/bin/env python3
"""Read-only W14/W21 census; prints aggregates, never transcript content.

python3 progress/process/sf74-2026-10-11/measure-waits.py --hours 4
Use --hours 6 for the index-lock collision window. Only this repository's
Claude directory and Codex sessions with matching session metadata qualify.
Tool IDs deduplicate copied transcript records. A paired sleep's elapsed time
is measured separately from its requested duration; neither proves waste.
"""
import argparse
import collections
import datetime
import json
from pathlib import Path
import re
import time

parser = argparse.ArgumentParser()
parser.add_argument('--hours', type=float, default=4)
args = parser.parse_args()
end = time.time()
start = end - args.hours * 3600
repo = str(Path(__file__).resolve().parents[3])
home = Path.home()

def timestamp(record):
    try:
        return datetime.datetime.fromisoformat(record['timestamp'].replace('Z', '+00:00')).timestamp()
    except (KeyError, ValueError, TypeError):
        return None

def records(path):
    with path.open(errors='replace') as handle:
        for line in handle:
            try:
                yield json.loads(line)
            except ValueError:
                continue

def text(value):
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
            if isinstance(decoded, (dict, list)):
                return text(decoded)
        except ValueError:
            pass
        return value
    if isinstance(value, list):
        return '\n'.join(text(item) for item in value)
    if isinstance(value, dict):
        return '\n'.join(text(value[key]) for key in ('text', 'content', 'output') if key in value)
    return ''

lock_pattern = re.compile(r"^fatal: Unable to create[^\n]*index\.lock[^\n]*exists", re.I | re.M)
poll_pattern = re.compile(r'\bsleep\b|\buntil\s|\bwhile\s')
counts = collections.Counter()
seconds = collections.Counter()
calls = {}
outputs = set()
spans = {}

def call(provider, session, ident, at, name, argument):
    key = (provider, ident)
    if key in calls:
        return
    calls[key] = (session, at, name, argument)
    if start <= at <= end:
        counts[provider + '_calls'] += 1

def result(provider, ident, at, value):
    key = (provider, ident)
    if key in outputs or not start <= at <= end:
        return
    outputs.add(key)
    counts[provider + '_outputs'] += 1
    output = text(value)
    if lock_pattern.search(output):
        counts[provider + '_index_lock_error_outputs'] += 1
    if key not in calls:
        counts[provider + '_unpaired_outputs'] += 1
        return
    session, beginning, name, argument = calls[key]
    elapsed = max(0, at - max(start, beginning))
    if name.split('.')[-1] == 'sleep':
        counts[provider + '_sleep_calls'] += 1
        seconds[provider + '_sleep_elapsed'] += elapsed
        try:
            requested = json.loads(argument) if isinstance(argument, str) else argument
            seconds[provider + '_sleep_requested'] += requested.get('duration_ms', 0) / 1000
        except (ValueError, TypeError, AttributeError):
            counts[provider + '_unreadable_sleep_arguments'] += 1
    elif name == 'Bash' and poll_pattern.search(argument.get('command', '')):
        counts['claude_poll_candidate_calls'] += 1
        seconds['claude_poll_candidate_elapsed'] += elapsed

providers = [('codex', home / '.codex/sessions'),
             ('claude', home / '.claude/projects/-Users-raynos-projects-games-wildshard-singleplayer')]
for provider, directory in providers:
    for path in directory.rglob('*.jsonl'):
        if path.stat().st_mtime < start:
            continue
        if provider == 'codex':
            metadata = next((o.get('payload', {}) for o in records(path) if o.get('type') == 'session_meta'), {})
            if metadata.get('cwd') != repo:
                counts['codex_foreign_sessions_excluded'] += 1
                continue
        first = last = None
        for record in records(path):
            at = timestamp(record)
            if at is None or at > end:
                continue
            if at >= start:
                first = min(first, at) if first is not None else at
                last = max(last, at) if last is not None else at
            if provider == 'codex':
                payload = record.get('payload', {})
                if record.get('type') != 'response_item':
                    continue
                kind = payload.get('type')
                if kind in ('function_call', 'custom_tool_call'):
                    call(provider, str(path), payload.get('call_id'), at, payload.get('name', ''), payload.get('arguments', payload.get('input', '')))
                elif kind in ('function_call_output', 'custom_tool_call_output'):
                    result(provider, payload.get('call_id'), at, payload.get('output', ''))
            else:
                content = record.get('message', {}).get('content', [])
                if not isinstance(content, list):
                    continue
                for block in content:
                    if not isinstance(block, dict):
                        continue
                    if block.get('type') == 'tool_use':
                        call(provider, str(path), block.get('id'), at, block.get('name', ''), block.get('input', {}))
                    elif block.get('type') == 'tool_result':
                        result(provider, block.get('tool_use_id'), at, block.get('content', ''))
        if first is not None:
            spans[(provider, str(path))] = max(0, last - first)
            counts[provider + '_repository_transcripts'] += 1
for provider in ('codex', 'claude'):
    seconds[provider + '_transcript_span'] = sum(value for (kind, _), value in spans.items() if kind == provider)
print(json.dumps({'at': datetime.datetime.fromtimestamp(end, datetime.timezone.utc).isoformat(),
                  'hours': args.hours, 'counts': dict(counts),
                  'seconds': {key: round(value, 3) for key, value in seconds.items()},
                  'limitations': ['Transcript spans can overlap or include copied history.',
                                  'Sleep and poll command time includes authorized standing watches; no waste classification.',
                                  'Bash poll candidates match a regex that can include mentions inside commands; no shell execution inference.',
                                  'Index-lock errors count tool-result records, not measured lock hold time.',
                                  'No raw transcript content is emitted.']}, indent=2))
