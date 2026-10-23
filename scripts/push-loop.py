#!/usr/bin/env python3
"""One temporary push tick: live checks, safe prefix upload, lane notification. No history edits."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys
import tempfile
import time

LIVE = runpy.run_path(str(Path(__file__).with_name('live-prepush.py')))
SOURCE = runpy.run_path(str(Path(__file__).with_name('push-source.py')))
RECENT = runpy.run_path(str(Path(__file__).with_name('recent-ci-tests.py')))
git = LIVE['git']


def deferred_blobs(root, base, tip, name):
    common = Path(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir'))
    pending = load(common / name, {})
    files = []
    for path in LIVE['changed'](root, base, tip):
        if path not in pending:
            continue
        blob = subprocess.run(['git', 'rev-parse', '--verify', tip + ':' + path], cwd=root,
                              text=True, capture_output=True)
        if blob.returncode == 0 and blob.stdout.strip() in pending[path]:
            files.append(path)
    return files


def deferred_types(root, base, tip):
    return deferred_blobs(root, base, tip, 'push-deferred-types.json')


def deferred_policy(root, base, tip):
    return deferred_blobs(root, base, tip, 'push-deferred-policy.json')


def check_binary_json(root, base, tip, deadline):
    """Exact Git blobs before source preparation; no working assets or generated cache."""
    script = subprocess.run(['git', 'show', tip + ':scripts/no-binary-json.mjs'], cwd=root,
                            capture_output=True, text=True, timeout=10)
    if script.returncode != 0:
        # Historical prefixes before the rule existed have nothing to run.
        policy = subprocess.run(['git', 'log', '--format=%H', base + '..' + tip,
                                 '--', 'lint/no-binary-json.json'], cwd=root,
                                capture_output=True, text=True, timeout=10)
        previous = subprocess.run(['git', 'cat-file', '-e', base + ':lint/no-binary-json.json'],
                                  cwd=root, capture_output=True, timeout=10)
        if policy.returncode != 0 or policy.stdout.strip() or previous.returncode == 0:
            return {'ok': False, 'phase': 'binary-json', 'files': ['scripts/no-binary-json.mjs'],
                    'output': 'BINARY-JSON scripts/no-binary-json.mjs: candidate checker missing'}
        return {'ok': True, 'output': ''}
    (root / 'tmp').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root / 'tmp', prefix='push-binary-') as owned:
        checker = Path(owned) / 'no-binary-json.mjs'
        checker.write_text(script.stdout)
        rc, output = LIVE['run'](['node', str(checker), '--range', base, tip], root, deadline)
    if rc == 124 and 'BINARY-JSON ' not in output:
        return {'ok': True, 'output': output + '\nBinary JSON check reached the local budget; defer to full CI.\n'}
    if rc != 0:
        paths = sorted(set(re.findall(r'^BINARY-JSON ([^\n:]+):', output, re.M)))
        return {'ok': False, 'phase': 'binary-json', 'files': paths, 'output': output}
    return {'ok': True, 'output': output}


def check_committed(root, base, tip, deadline):
    binary = check_binary_json(root, base, tip, deadline)
    if not binary['ok']:
        return binary
    recent, recent_note = RECENT['refresh'](root, min(deadline,time.monotonic()+5))
    policy = deferred_policy(root, base, tip)
    preparation_started = time.monotonic()
    try:
        # The local check budget is soft; exact source preparation must finish.
        with SOURCE['committed_source'](root, tip, git(root, 'rev-parse', 'main'), float('inf')) as (tree, tools):
            if time.monotonic() >= deadline:
                return {'ok': True, 'phase': 'preparation-deferred', 'files': [], 'types': 'ci-budget',
                        'output': binary['output'] + 'Exact committed source preparation completed in %.2f seconds. '
                                  'Local check budget exhausted; deleted-path/inventory guards, related tests '
                                  'and remaining typed checks defer to full CI.' % (time.monotonic() - preparation_started)
                                  + (' Deferred pre-commit policy checks remain queued: ' + ', '.join(policy) if policy else '')}
            inputs = json.loads((tree / '.push-types.json').read_text())
            available = inputs['available']
            deferred = deferred_types(root, base, tip)
            deleted = git(root, 'diff', '--name-only', '--diff-filter=D', '--no-renames', base, tip).splitlines()
            result = LIVE['check'](tree, base, tip, deadline, files=LIVE['changed'](root, base, tip),
                                   runner=LIVE['run'],
                                   tools=tools, types_available=available,
                                   tests_available=inputs.get('testsAvailable', available),
                                   test_revision=inputs.get('testRevision'), deleted=deleted, typed_files=deferred, recent_tests=recent,
                                   policy_checks=bool(policy))
            if deferred:
                if not available:
                    result['types'] = 'ci-cache-miss'
                if not available:
                    result['output'] += '\nDeferred typed checks lack verified generated inputs; full CI owns: ' + ', '.join(deferred)
            if not result['ok'] and result['files']:
                rc, output = LIVE['run'](['node', str(tools / 'push-inputs.mjs'), *result['files']], tree, deadline)
                result['inputs'] = json.loads(output) if rc == 0 else []
            result['output'] = binary['output'] + recent_note + '\n' + result['output']
            return result
    except (TimeoutError, subprocess.TimeoutExpired):
        return {'ok': False, 'phase': 'preparation', 'files': [], 'output': 'Committed check exceeded 45 seconds'}


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


def offender(root, base, tip, files, deadline):
    left = deadline - time.monotonic()
    if not files or left <= 0:
        return None
    # The checker expanded dependencies in the committed source snapshot.
    inputs = files
    if not inputs:
        return None
    commits = git(root, 'rev-list', '--reverse', '--first-parent', base + '..' + tip).splitlines()
    for sha in commits:
        if time.monotonic() >= deadline:
            return None
        touched = git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', sha).splitlines()
        if set(touched).intersection(inputs):
            return sha
    return None


def refusal_signature(output):
    plain = LIVE['ANSI'].sub('', output)
    plain = re.sub(r'(?:push-source-|live-prepush-)[A-Za-z0-9_-]+', '<source-snapshot>', plain)
    return re.sub(r'\d+(?:\.\d+)?(?:ms|s)\b', '<time>', plain)


QUIET = runpy.run_path(str(Path(__file__).with_name('sim-quiet.py')))


def quiet_active(path, now=None):
    """G670: only the live official Simulator reader can defer pushes."""
    return QUIET['quiet_marker_active'](path, now)


def tick(root, checker=check_committed, uploader=None, notify=ping):
    common = Path(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir'))
    if quiet_active(common / 'quiet'):
        return {'status': 'quiet', 'tip': git(root, 'rev-parse', 'main')}
    started = time.monotonic()
    # Reaping the snapshot is part of the 45-second ceiling too.
    deadline = started + LIVE['LIMIT'] - 2
    pending_notice = None

    def finish(result):
        # Lane notification is outside the check budget and never delays upload.
        if pending_notice is not None:
            # The recipient may open this file as soon as Herdr delivers.
            folder = root / 'tmp/push-loop'
            folder.mkdir(parents=True, exist_ok=True)
            detail = {key: value for key, value in result.items() if key != 'output'}
            (folder / 'current.log').write_text(result.get('output', '') + '\n' + json.dumps(detail) + '\n')
            path, state, commits, message = pending_notice
            if notify(root, commits, message):
                state['pinged'] = True
                path.write_text(json.dumps(state))
        return result

    base = git(root, 'rev-parse', 'origin/main')
    tip = git(root, 'rev-parse', 'main')
    if base == tip:
        return {'status': 'idle', 'tip': tip}
    if git(root, 'merge-base', base, tip) != base:
        return {'status': 'diverged', 'tip': tip}
    result = checker(root, base, tip, deadline)
    candidate = tip
    bad = None
    if not result['ok']:
        bad = offender(root, base, tip, result.get('inputs', result['files']), deadline)
        candidate = git(root, 'rev-parse', bad + '^') if bad else base
        # The prefix must pass too, in the remaining original 45s budget.
        if candidate != base and not checker(root, base, candidate, deadline)['ok']:
            candidate = base
        state_file = common / 'push-red.json'
        signature = refusal_signature(result['output'])
        fingerprint = hashlib.sha256(json.dumps([bad, result['phase'], result['files'], signature], sort_keys=True).encode()).hexdigest()
        state = load(state_file, {})
        count = state.get('count', 0) + 1 if state.get('fingerprint') == fingerprint else 1
        pinged = state.get('pinged', False) if count > 1 else False
        if not pinged and (bad or count >= 3):
            commits = [bad] if bad else git(root, 'rev-list', '--reverse', base + '..' + tip).splitlines()
            message = '[push-loop] ' + result['phase'] + ' red at ' + (bad or tip)[:10] + '; ' + \
                ('prefix checked; offending suffix stays local. ' if bad else 'same live refusal three times. ') + \
                'Log: tmp/push-loop/current.log. Fix forward and commit.'
            pending_notice = (state_file, {'fingerprint': fingerprint, 'count': count, 'pinged': False}, commits, message)
        state_file.write_text(json.dumps({'fingerprint': fingerprint, 'count': count, 'pinged': pinged}))
    if candidate == base:
        return finish({'status': 'red', 'tip': tip, 'bad': bad, 'phase': result['phase'],
                       'types': result.get('types', 'unavailable'),
                       'gateSeconds': round(time.monotonic() - started, 2), 'output': result['output']})
    env = dict(os.environ, WS_LIVE_GATE_TIP=candidate, WS_LIVE_GATE_BASE=base)
    if uploader is None:
        def uploader(revision, environment):
            return subprocess.run(['git', 'push', '-q', 'origin', revision + ':refs/heads/main'], cwd=root, env=environment).returncode
    gate_seconds = round(time.monotonic() - started, 2)
    rc = uploader(candidate, env)
    return finish({'status': 'pushed' if rc == 0 else 'upload-red', 'tip': candidate, 'bad': bad,
                   'types': result.get('types', 'unavailable'),
                   'gateSeconds': gate_seconds, 'output': result['output']})


def main():
    root = Path(git(Path.cwd(), 'rev-parse', '--show-toplevel'))
    if len(sys.argv) == 3 and sys.argv[1] == '--check':
        tip = git(root, 'rev-parse', sys.argv[2])
        result = check_committed(root, git(root, 'merge-base', 'origin/main', tip), tip, time.monotonic() + LIVE['LIMIT'] - 2)
        print(json.dumps(result))
        return 0 if result['ok'] else 1
    folder = root / 'tmp/push-loop'
    folder.mkdir(parents=True, exist_ok=True)
    common = Path(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir'))
    # The quiet owner takes this lock only while publishing its marker, after an active tick drains.
    # Once published, later ticks defer without holding a push lock through the sample.
    with (common / 'push-loop.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'status': 'busy'}))
            return 0
        result = tick(root)
    (folder / 'current.log').write_text(result.pop('output', '') + '\n' + json.dumps(result) + '\n')
    with (common / 'push.log').open('a') as log:
        log.write(time.strftime('%Y-%m-%dT%H:%M:%S%z ') + json.dumps(result) + '\n')
    print(json.dumps(result))
    return 0 if result['status'] in ('idle', 'pushed', 'quiet') else 1


if __name__ == '__main__':
    raise SystemExit(main())
