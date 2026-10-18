"""Exercise the real shell hook with shared stages and isolated indexes."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

hook = Path(sys.argv[1]).resolve()
repo = hook.parents[2]
env = dict(os.environ, CLAUDE_PROJECT_DIR=str(repo))
for key in subprocess.check_output(['git', 'rev-parse', '--local-env-vars'], text=True).splitlines():
    env.pop(key, None)

with tempfile.TemporaryDirectory(prefix='sweep-guard-', dir=repo / 'tmp') as temporary:
    root = Path(temporary)

    def git(*args):
        return subprocess.check_output(['git', *args], cwd=root, env=env, text=True).strip()

    git('init', '-q', '-b', 'main')
    git('config', 'user.name', 'Fixture')
    git('config', 'user.email', 'fixture@example.invalid')
    (root / 'tracked').write_text('base\n')
    git('add', 'tracked')
    git('commit', '-qm', 'base')
    (root / 'foreign').write_text('another lane\n')
    git('add', 'foreign')
    shared = root / '.git/index'
    original = shared.read_bytes()
    private = root / 'mine.index'
    active = dict(env, GIT_INDEX_FILE=str(private))
    subprocess.run(['git', 'read-tree', 'HEAD'], cwd=root, env=active, check=True)
    (root / 'alias.index').symlink_to(shared)
    os.link(shared, root / 'hard.index')

    def check(command, allowed, environment=env):
        result = subprocess.run(['bash', str(hook)], cwd=root, env=environment,
                                input=json.dumps({'tool_input': {'command': command}}),
                                text=True, capture_output=True, check=False)
        assert result.returncode == (0 if allowed else 2), (command, result.returncode, result.stderr)
        assert shared.read_bytes() == original, 'Guard touched foreign stages'

    for prefix in ('', f'GIT_INDEX_FILE={shared} ', f'env GIT_INDEX_FILE={shared} '):
        check(prefix + 'git add tracked', False)
        check(prefix + 'git commit -m "bare"', False)
    for alias in ('alias.index', 'hard.index'):
        check(f'GIT_INDEX_FILE={root / alias} git add tracked', False)
        check(f'GIT_INDEX_FILE={root / alias} git commit -m bare', False)
    for reserved in (str(shared) + '.lock', str(shared.parent / 'next-index-123.lock')):
        check(f'GIT_INDEX_FILE={reserved} git add tracked', False)
        check(f'GIT_INDEX_FILE={reserved} git commit -m bare', False)
    for prefix in (f'GIT_INDEX_FILE={private} ', f'env GIT_INDEX_FILE={private} '):
        check(prefix + 'git add tracked', True)
        check(prefix + 'git commit -F message', True)
        for operation in ('add -A', 'add .', 'add -u', 'commit -am sweep'):
            check(prefix + 'git ' + operation, False)
    check('git add tracked', True, active)
    check('git commit -F message', True, active)
    check('unset GIT_INDEX_FILE; git commit -F message', False, active)
    check(f'export GIT_INDEX_FILE={shared}; git add tracked', False, active)
    check(f'GIT_INDEX_FILE={private} git add tracked; git commit -m bare', False)
    check(f'GIT_INDEX_FILE={private} git add tracked; git add tracked', False)
    check(f'GIT_INDEX_FILE={private} git add tracked; GIT_INDEX_FILE={shared} git commit -m bare', False)
    check(f'false && export GIT_INDEX_FILE={private}; git commit -m bare', False)
    check("GIT_INDEX_FILE='$PRIVATE' git commit -m bare", False)
    check('git diff -- tracked && git commit -m bare', False)
    check('git commit -m "mentions -- tracked; | &"', False)
    check('git commit -m "the user\'s picks" -- tracked', True)
    check('git add new-file && git commit -m new -- new-file', True)
    assert git('diff', '--cached', '--name-only') == 'foreign'
print('sweep guard: private recognition and shared-stage isolation pass')
