"""Checks release the shared lease; only relevant concurrent changes refuse."""
import fcntl
import json
import os
from pathlib import Path
import select
import signal
import shutil
import subprocess
import sys
import tempfile

source = Path(sys.argv[1]).resolve()
wrapper_text = sys.stdin.read() if len(sys.argv) > 2 and sys.argv[2] == '-' else None
wrapper = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else source / 'scripts/commit.sh'
env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
with tempfile.TemporaryDirectory(dir=source / 'tmp', prefix='commit-snapshot-') as directory:
    root = Path(directory)
    def git(*args, **kwargs):
        return subprocess.check_output(['git', *args], cwd=root, env=env, text=True, **kwargs).strip()
    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Fixture')
    git('config', 'user.email', 'fixture@example.invalid')
    git('config', 'core.hooksPath', '/dev/null')
    for name in ['own.txt', 'own.bin', 'dependency.txt', 'peer.txt', 'dependency.js']:
        (root / name).write_text('base\n')
    git('add', '.')
    git('commit', '-qm', 'base')
    (root / 'scripts').mkdir()
    (root / 'node_modules/@typescript').mkdir(parents=True)
    (root / 'node_modules/@typescript/typescript6').symlink_to((source / 'node_modules/@typescript/typescript6').resolve())
    shutil.copy2(source / 'scripts/repo-size.mjs', root / 'scripts/repo-size.mjs')
    if wrapper_text is None:
        shutil.copy2(wrapper, root / 'scripts/commit.sh')
    else:
        (root / 'scripts/commit.sh').write_text(wrapper_text)
        (root / 'scripts/commit.sh').chmod(0o755)
    (root / '.githooks').mkdir()
    hook = root / '.githooks/pre-commit'
    hook.write_text('''#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys
root = pathlib.Path.cwd()
read_set = os.environ.get('WS_COMMIT_READ_SET')
if read_set:
    with open(read_set, 'a') as receipt:
        receipt.write(json.dumps({'root': str(root), 'paths':['own.txt','dependency.txt'], 'budget': bool(os.environ.get('BUDGET_MOVE')),
            'imports': {'dependency.js':[]} if os.environ.get('SYNTAX_MOVE') else {}})+'\\n')
before = subprocess.check_output(['git','rev-parse','HEAD'])
print('CHECK_READY', flush=True)
with open('gate') as gate: gate.read()
assert subprocess.check_output(['git','rev-parse','HEAD']) == before, 'check HEAD was not pinned'
if os.environ.get('MUTATE_CANDIDATE'):
    oid=subprocess.check_output(['git','hash-object','-w','--stdin'],input=b'other\\n').decode().strip()
    subprocess.check_call(['git','update-index','--cacheinfo','100644,'+oid+',own.txt'])
sys.exit(23 if os.environ.get('HOOK_RED') else 0)
''')
    hook.chmod(0o755)
    message_hook = root / '.githooks/commit-msg'
    message_hook.write_text('''#!/usr/bin/env python3
import os, subprocess, sys
if os.environ.get('MESSAGE_MUTATE'):
    oid=subprocess.check_output(['git','hash-object','-w','--stdin'],input=b'late\\n').decode().strip()
    subprocess.check_call(['git','update-index','--cacheinfo','100644,'+oid+',own.txt'])
sys.exit(1 if os.environ.get('MESSAGE_RED') else 0)
''')
    message_hook.chmod(0o755)
    git('config', 'core.hooksPath', '.githooks')
    os.mkfifo(root / 'gate')
    results = []
    for number, action in enumerate(['none', 'disjoint', 'dependency', 'stage', 'working', 'candidate', 'red', 'message', 'late-index', 'budget', 'syntax-body', 'syntax-edge']):
        (root / 'own.txt').write_text('change ' + str(number) + '\n')
        head = git('rev-parse', 'HEAD')
        paths = ['own.txt']
        if action == 'budget':
            (root / 'own.bin').write_text('binary change\n')
            paths.append('own.bin')
        child = subprocess.Popen(['scripts/commit.sh', 'fixture ' + action, '--', *paths], cwd=root,
            env={**env, **({'MUTATE_CANDIDATE':'1'} if action == 'candidate' else {}),
                 **({'HOOK_RED':'1'} if action == 'red' else {}), **({'MESSAGE_RED':'1'} if action == 'message' else {}),
                 **({'MESSAGE_MUTATE':'1'} if action == 'late-index' else {}), **({'BUDGET_MOVE':'1'} if action == 'budget' else {}),
                 **({'SYNTAX_MOVE':'1'} if action.startswith('syntax-') else {})},
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
        entered = False
        try:
            ready, _, _ = select.select([child.stdout], [], [], 5)
            assert ready, 'hook did not start'
            first = child.stdout.readline()
            while first and first.strip() != 'CHECK_READY':
                first = child.stdout.readline()
            entered = first.strip() == 'CHECK_READY'
            assert first.strip() == 'CHECK_READY', first
            # Causal witness: another lane can own the commit lease while the
            # hook is still blocked, without a sleep or timing threshold.
            with (root / '.git/commit.lock').open('a') as lease:
                fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
                fcntl.flock(lease, fcntl.LOCK_UN)
            if action in ['disjoint', 'dependency', 'budget', 'syntax-body', 'syntax-edge']:
                name = {'disjoint':'peer.txt', 'dependency':'dependency.txt', 'budget':'peer.bin',
                        'syntax-body':'dependency.js', 'syntax-edge':'dependency.js'}[action]
                contents = {'syntax-body':'export const value=2;\n', 'syntax-edge':'import "./other.js";\n'}
                (root / name).write_text(contents.get(action, action + '\n'))
                git('add', '--', name)
                git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'peer ' + action)
                head = git('rev-parse', 'HEAD')
            if action == 'stage':
                git('add', '--', 'own.txt')
            if action == 'working':
                (root / 'own.txt').write_text('late edit\n')
        finally:
            if entered:
                with (root / 'gate').open('w') as gate:
                    gate.write('continue')
            else:
                os.killpg(child.pid, signal.SIGKILL)
            output, error = child.communicate(timeout=8)
        passed = action in ['none', 'disjoint', 'syntax-body']
        assert (child.returncode == 0) == passed, (action, output, error)
        assert ('CHECK_READY' not in output), 'pre-commit executed twice'
        if passed:
            assert git('show', 'HEAD:own.txt') == 'change ' + str(number)
            assert git('rev-parse', 'HEAD^') == head
        else:
            assert git('rev-parse', 'HEAD') == head
        if action == 'disjoint':
            assert git('show', 'HEAD:peer.txt') == 'disjoint'
            assert 'retain disjoint peer commits' in output
        if action == 'budget':
            assert 'storage inputs changed' in output, output
        if action == 'syntax-edge':
            assert 'checked import graph changed' in output, output
        results.append(action)
        # This fixture owns its entire index; do not carry the deliberately
        # staged refusal into a later simulated peer commit.
        git('read-tree', 'HEAD')
    assert list((root / '.git').glob('commit-patch.*')) == []
    print(json.dumps({'outsideLock':True, 'pinnedHead':True, 'disjointPreserved':True,
                      'freshnessRefusals':True, 'hookRedsFatal':True, 'cases':results}))
