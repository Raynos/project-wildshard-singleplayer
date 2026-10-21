#!/usr/bin/env python3
"""One launchd tick: live checks, safe prefix upload, lane notification. No history edits."""
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys
import time

LIVE = runpy.run_path(str(Path(__file__).with_name('live-prepush.py')))
git = LIVE['git']


def load(path, fallback):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, ValueError):
        return fallback


def lane(root, commits):
    common = Path(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir'))
    ledger = common / 'commit-lanes.jsonl'
    rows = {}
    for line in ledger.read_text().splitlines() if ledger.exists() else []:
        try:
            row = json.loads(line)
            rows[row['sha']] = row.get('lane') or row.get('pane')
        except (ValueError, KeyError):
            continue
    target = next((rows[sha] for sha in commits if rows.get(sha)), None)
    if target and not re.fullmatch(r'sp-[xo]\d+|w\w+:p\d+', target):
        target = None
    # Protected plan panes are never prompted, even via a stale pane record.
    if target and not target.startswith('sp-'):
        try:
            listed = json.loads(subprocess.check_output(['herdr', 'agent', 'list'], text=True, timeout=10))
            target = next((agent.get('name') for agent in listed['result']['agents']
                           if agent['pane_id'] == target), None)
        except (subprocess.SubprocessError, ValueError, KeyError):
            target = None
    return target if target and re.fullmatch(r'sp-[xo]\d+', target) else 'wildshard-new'


def ping(root, commits, message):
    return subprocess.run(['scripts/herdr-prompt.sh', lane(root, commits), message],
                          cwd=root, stdout=subprocess.DEVNULL, timeout=20).returncode == 0


def offender(root, base, tip, files):
    if not files:
        return None
    # Expand failed tests through actual imports before naming an owner.
    queried = subprocess.run(['node', 'scripts/push-inputs.mjs', *files], cwd=root,
                             capture_output=True, text=True, timeout=5)
    if queried.returncode:
        return None
    inputs = json.loads(queried.stdout)
    if not inputs or not LIVE['matches'](root, tip, inputs):
        return None
    commits = git(root, 'rev-list', '--reverse', '--first-parent', base + '..' + tip).splitlines()
    for sha in commits:
        touched = git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', sha).splitlines()
        if set(touched).intersection(inputs):
            return sha
    return None


def tick(root, checker=LIVE['check'], uploader=None, notify=ping):
    started = time.monotonic()
    deadline = started + LIVE['LIMIT']
    base = git(root, 'rev-parse', 'origin/main')
    tip = git(root, 'rev-parse', 'main')
    if base == tip:
        return {'status': 'idle', 'tip': tip}
    if git(root, 'merge-base', base, tip) != base:
        return {'status': 'diverged', 'tip': tip}
    common = Path(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir'))
    result = checker(root, base, tip, deadline)
    candidate = tip
    bad = None
    if not result['ok']:
        bad = offender(root, base, tip, result['files']) if result['phase'] != 'working-tree' else None
        candidate = git(root, 'rev-parse', bad + '^') if bad else base
        # The prefix must pass too, in the remaining original 45s budget.
        if candidate != base and not checker(root, base, candidate, deadline)['ok']:
            candidate = base
        state_file = common / 'push-red.json'
        fingerprint = hashlib.sha256(json.dumps([bad, result['phase'], result['files'], result['output']], sort_keys=True).encode()).hexdigest()
        state = load(state_file, {})
        count = state.get('count', 0) + 1 if state.get('fingerprint') == fingerprint else 1
        pinged = state.get('pinged', False) if count > 1 else False
        if not pinged and (bad or count >= 3):
            commits = [bad] if bad else git(root, 'rev-list', '--reverse', base + '..' + tip).splitlines()
            message = '[push-loop] ' + result['phase'] + ' red at ' + (bad or tip)[:10] + '; ' + \
                ('prefix checked; offending suffix stays local. ' if bad else 'same live refusal three times. ') + \
                'Log: tmp/push-loop/current.log. Fix forward and commit.'
            pinged = notify(root, commits, message)
        state_file.write_text(json.dumps({'fingerprint': fingerprint, 'count': count, 'pinged': pinged}))
    if candidate == base:
        return {'status': 'red', 'tip': tip, 'bad': bad, 'phase': result['phase'], 'output': result['output']}
    env = dict(os.environ, WS_LIVE_GATE_TIP=candidate, WS_LIVE_GATE_BASE=base)
    if uploader is None:
        def uploader(revision, environment):
            return subprocess.run(['git', 'push', '-q', 'origin', revision + ':refs/heads/main'], cwd=root, env=environment).returncode
    rc = uploader(candidate, env)
    return {'status': 'pushed' if rc == 0 else 'upload-red', 'tip': candidate, 'bad': bad,
            'gateSeconds': round(time.monotonic() - started, 2), 'output': result['output']}


def main():
    root = Path(git(Path.cwd(), 'rev-parse', '--show-toplevel'))
    folder = root / 'tmp/push-loop'
    folder.mkdir(parents=True, exist_ok=True)
    result = tick(root)
    (folder / 'current.log').write_text(result.pop('output', '') + '\n' + json.dumps(result) + '\n')
    common = Path(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir'))
    with (common / 'push.log').open('a') as log:
        log.write(time.strftime('%Y-%m-%dT%H:%M:%S%z ') + json.dumps(result) + '\n')
    print(json.dumps(result))
    return 0 if result['status'] in ('idle', 'pushed') else 1


if __name__ == '__main__':
    raise SystemExit(main())
