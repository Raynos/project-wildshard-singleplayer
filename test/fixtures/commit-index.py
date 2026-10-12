"""Reproduce a stale private-index commit against actual concurrent landings."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

guard = Path(sys.argv[1]).resolve()
env = dict(os.environ)
for key in subprocess.check_output(['git', 'rev-parse', '--local-env-vars'],
                                   text=True).splitlines():
    env.pop(key, None)
env.pop('WS_COMMIT_INTENT', None)

with tempfile.TemporaryDirectory(prefix='commit-index-fixture-') as directory:
    root = Path(directory)

    def git(*args, active=env, check=True):
        return subprocess.run(['git', *args], cwd=root, env=active,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              text=True, check=check)

    def blob(text):
        return subprocess.check_output(['git', 'hash-object', '-w', '--stdin'],
                                       cwd=root, env=env, text=True, input=text).strip()

    def put(active, path, text):
        git('update-index', '--add', '--cacheinfo', '100644', blob(text), path,
            active=active)

    def private(name, base):
        active = dict(env, GIT_INDEX_FILE=str(root / name))
        git('read-tree', base, active=active)
        return active

    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Fixture')
    git('config', 'user.email', 'fixture@example.invalid')
    (root / 'foreign.txt').write_text('old\n')
    git('add', 'foreign.txt')
    git('commit', '-qm', 'base')
    base = git('rev-parse', 'HEAD').stdout.strip()
    lane_a = private('a.index', base)
    put(lane_a, 'own.txt', 'lane A\n')
    lane_b = private('b.index', base)
    put(lane_b, 'foreign.txt', 'lane B\n')
    put(lane_b, 'new foreign.txt', 'new lane B\n')
    git('commit', '-qm', 'concurrent B', active=lane_b)
    landed = git('rev-parse', 'HEAD').stdout.strip()
    hooks = root / 'hooks'
    hooks.mkdir()
    for name in ('pre-commit', 'commit-msg'):
        hook = hooks / name
        hook.write_text(f'#!/bin/sh\nexec python3 "{guard}"\n')
        hook.chmod(0o755)
    git('config', 'core.hooksPath', str(hooks))
    refused = git('commit', '-qm', 'stale A', active=lane_a, check=False)
    assert refused.returncode != 0, refused
    assert 'foreign.txt' in refused.stderr and 'new foreign.txt' in refused.stderr
    assert git('rev-parse', 'HEAD').stdout.strip() == landed
    assert git('show', 'HEAD:foreign.txt').stdout == 'lane B\n'
    assert git('show', 'HEAD:new foreign.txt').stdout == 'new lane B\n'

    fresh = private('fresh.index', landed)
    put(fresh, 'own.txt', 'lane A\n')
    git('commit', '-qm', 'fresh A', active=fresh)
    assert git('show', 'HEAD:foreign.txt').stdout == 'lane B\n'
    assert git('show', 'HEAD:new foreign.txt').stdout == 'new lane B\n'
    current = git('rev-parse', 'HEAD').stdout.strip()

    rollback = private('rollback.index', current)
    put(rollback, 'foreign.txt', 'old\n')
    rollback['WS_COMMIT_INTENT'] = json.dumps({'base': current, 'paths': ['foreign.txt']})
    git('commit', '-qm', 'explicit rollback', active=rollback)
    current = git('rev-parse', 'HEAD').stdout.strip()
    assert git('show', 'HEAD:new foreign.txt').stdout == 'new lane B\n'

    mixed = private('mixed.index', current)
    put(mixed, 'own.txt', 'next A\n')
    put(mixed, ':foreign name.txt', 'unrelated fresh bytes\n')
    mixed['WS_COMMIT_INTENT'] = json.dumps({'base': current, 'paths': ['own.txt']})
    refused = git('commit', '-qm', 'foreign intent', active=mixed, check=False)
    assert refused.returncode != 0 and 'outside declared' in refused.stderr

    stale_intent = private('stale-intent.index', current)
    put(stale_intent, 'own.txt', 'next A\n')
    stale_intent['WS_COMMIT_INTENT'] = json.dumps({'base': current, 'paths': ['own.txt']})
    next_lane = private('next.index', current)
    put(next_lane, 'new foreign.txt', 'next B\n')
    git('commit', '-qm', 'next B', active=next_lane)
    refused = git('commit', '-qm', 'stale declared A', active=stale_intent, check=False)
    assert refused.returncode != 0 and 'parent moved' in refused.stderr

    # Detect HEAD movement between the two real hooks as well.
    current = git('rev-parse', 'HEAD').stdout.strip()
    delayed = private('delayed.index', current)
    put(delayed, 'own.txt', 'next A\n')
    delayed['WS_COMMIT_INTENT'] = json.dumps({'base': current, 'paths': ['own.txt']})
    tip = private('tip.index', current)
    put(tip, 'new foreign.txt', 'third B\n')
    tree = git('write-tree', active=tip).stdout.strip()
    commit = git('commit-tree', tree, '-p', current, '-m', 'third B').stdout.strip()
    (hooks / 'pre-commit').write_text(f'#!/bin/sh\npython3 "{guard}" || exit $?\ngit update-ref refs/heads/main {commit} {current}\n')
    refused = git('commit', '-qm', 'moved during hook', active=delayed, check=False)
    assert refused.returncode != 0 and 'parent moved' in refused.stderr
    assert git('rev-parse', 'HEAD').stdout.strip() == commit
    print(json.dumps({'race': 'refused', 'fresh': 'passed', 'rollback': 'scoped',
                      'foreign_intent': 'refused', 'moved_parent': 'refused',
                      'between_hooks': 'refused'}))
