#!/usr/bin/env python3
"""D9: related tests in one 45-second budget; CI owns complete checks."""
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time

LIMIT = 45
ANSI = re.compile(r'\x1b\[[0-9;]*m')


def git(root, *args):
    return subprocess.check_output(['git', *args], cwd=root, text=True, timeout=10).strip()


def changed(root, base, tip):
    return git(root, 'diff', '--name-only', '--no-renames', base, tip).splitlines()


def snapshot(root, files):
    return {name: hashlib.sha256((root / name).read_bytes()).hexdigest()
            if (root / name).is_file() else None for name in files}


def matches(root, tip, files):
    # A later landing or half edit cannot stand in for a prefix's source.
    return not files or not git(root, 'diff', '--name-only', tip, '--', *files)


def run(command, root, deadline, env=None):
    """Reap the entire owned command group at the shared deadline."""
    left = deadline - time.monotonic()
    if left <= 0:
        return 124, 'pre-push budget exhausted'
    with subprocess.Popen(command, cwd=root, env=env, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, text=True, start_new_session=True) as child:
        try:
            output, _ = child.communicate(timeout=left)
            return child.returncode, output
        except subprocess.TimeoutExpired:
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            output, _ = child.communicate()
            return 124, output + '\npre-push budget exhausted'


def failure_paths(output):
    plain = ANSI.sub('', output)
    # TS, oxlint and Vitest diagnostics. Unknown errors never guess a prefix.
    return sorted(set(re.findall(r'(?<![\w])((?:src|scripts|test|admin|api|drafts|lint|vite)/[^\s():\x1b]+\.(?:json|[cm]?[jt]sx?|py|sh))\b', plain)))


def json_path_list(output):
    """Read the last JSON payload despite merged, trailing tool diagnostics."""
    for line in reversed(ANSI.sub('', output).splitlines()):
        try:
            value = json.loads(line)
        except ValueError:
            continue
        if isinstance(value, list) and all(isinstance(path, str) for path in value):
            return value
        raise ValueError('Expected a JSON array of paths')
    raise ValueError('Missing JSON array of paths')


def selection_paths(path, output):
    # The CLI writes its result separately: stdout/stderr can interleave inside
    # an arbitrarily long JSON line on the merged diagnostics pipe.
    if not path.exists():
        return json_path_list(output)  # Older tooling may still use stdout.
    value = json.loads(path.read_text())
    if not isinstance(value, list) or not all(isinstance(name, str) for name in value):
        raise ValueError('Expected a JSON array of paths in selector result')
    return value


def check(root, base, tip, deadline, runner=run, files=None, tools=None, types_available=True,
          tests_available=None, test_revision=None, deleted=(), typed_files=()):
    files = changed(root, base, tip) if files is None else files
    tools = root / 'scripts' if tools is None else tools
    result = {'ok': False, 'phase': 'working-tree', 'files': [], 'output': ''}
    result['types'] = 'pre-commit'
    tests_available = types_available if tests_available is None else tests_available
    if test_revision:
        result['output'] = 'Verified generated test inputs: ' + test_revision
        if not types_available:
            result['output'] += ' (previous generation; not current type proof)'
    if not tests_available:
        result['output'] += '\nNo verified generated test inputs: related tests defer to the full CI gate.'
    before = snapshot(root, files)
    (root / 'tmp').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='live-prepush-', dir=root / 'tmp') as temporary:
        listing = Path(temporary) / 'changed.json'
        listing.write_text(json.dumps(files))
        env = dict(os.environ, WS_VITEST_MAX_WORKERS='4', WS_LIVE_PREPUSH='1', NO_COLOR='1')
        def refused(rc, output):
            failed = re.search(r'(?:FAIL\s+|failed\s*\(|Tests\s+\d+ failed|Test Files\s+\d+ failed|error\[|\berror [\w-]+[(/])', ANSI.sub('', output))
            return rc != 0 and (rc != 124 or failed)

        # Mandatory cheap guards precede optional related tests, including when
        # current generated declarations are unavailable. No app setup runs.
        removed = Path(temporary) / 'deleted.json'
        removed.write_text(json.dumps(list(deleted)))
        if deleted:
            rc, output = runner(['node', str(tools / 'push-checks.mjs'), 'deleted', str(removed)], root, deadline, env)
            if rc:
                result.update(phase='deleted-paths', output=output, files=failure_paths(output))
                return result
        guards = ['test/host-callbacks.test.ts', 'test/shardfile-boundaries.test.ts',
                  'test/platform-chargebacks.test.ts', 'test/manifest-declarations.test.ts']
        if any(name.startswith(('src/format/', 'src/sdk/')) for name in files):
            guards.insert(0, 'test/schema-reference.test.ts')
        rc, output = runner(['pnpm', 'exec', 'vitest', 'run', '--config',
                             'scripts/vitest-push-guards.config.ts', *guards], root, deadline, env)
        if rc:
            # The required guards cannot silently become optional at the cap.
            result.update(phase='guards', output=output, files=failure_paths(output))
            return result
        result['output'] += '\nRequired guards passed: ' + ', '.join(guards)
        left = deadline - time.monotonic()
        if tests_available and left > 2:
            selected = Path(temporary) / 'selected.json'
            rc, output = runner(['node', str(tools / 'gate-related-tests.mjs'), str(listing),
                                 '--live', '--budget=' + str(max(0, left - 2)), '--output=' + str(selected)], root, deadline, env)
            if rc not in (0, 124):
                result.update(phase='selection', output=output, files=failure_paths(output))
                return result
            if rc == 0:
                try:
                    tests = selection_paths(selected, output)
                except (ValueError, OSError) as error:
                    result.update(phase='selection', output=f'Invalid related selector output: {error}\n{output}', files=[])
                    return result
                tests = [test for test in tests if test not in guards]
                result['output'] += '\n' + output
                if tests:
                    rc, output = runner(['pnpm', 'exec', 'vitest', 'run', '--config',
                                         'scripts/vitest-push.config.ts', *tests], root, deadline, env)
                    # An actual refusal remains red, even if the clock then expires.
                    if refused(rc, output):
                        result.update(phase='tests', output=output, files=failure_paths(output))
                        return result
                    if rc == 124:
                        result['output'] += '\nRelated tests reached the ceiling; CI owns unfinished work from: ' + ', '.join(tests)
                    else:
                        result['output'] += '\nRelated tests passed: ' + ', '.join(tests)
            else:
                result['output'] += '\nRelated selection reached the ceiling; remaining related tests run in CI'
        # Spend the remaining budget on changed source and its typed importers.
        # Previous generated inputs are deliberately insufficient for this step.
        if types_available and deadline - time.monotonic() > 1:
            imported = Path(temporary) / 'importers.json'
            rc, output = runner(['node', str(tools / 'push-checks.mjs'), 'importers', str(listing),
                                 '--output=' + str(imported)], root, deadline, env)
            if rc not in (0, 124):
                result.update(phase='importers', output=output, files=failure_paths(output))
                return result
            lint = list(typed_files)
            if rc == 0:
                try:
                    lint = list(dict.fromkeys([*lint, *selection_paths(imported, output)]))
                except (ValueError, OSError) as error:
                    result.update(phase='importers', output=f'Invalid importer selector output: {error}\n{output}', files=[])
                    return result
            else:
                result['output'] += '\nImporter selection reached the ceiling; typed importers run in CI'
            if lint and deadline - time.monotonic() > 1:
                for start in range(0, len(lint), 16):
                    remainder = lint[start:]
                    rc, output = runner(['pnpm', 'exec', 'oxlint', '--type-check', '--type-aware',
                                         '-c', '.oxlintrc.json', *remainder[:16]], root, deadline, env)
                    if refused(rc, output):
                        result.update(phase='typed-check', output=output,
                                      files=failure_paths(output) or remainder[:16])
                        return result
                    if rc == 124:
                        result['output'] += '\nTyped lint reached the ceiling; CI owns: ' + ', '.join(remainder)
                        break
                else:
                    result['output'] += '\nTyped importer lint passed: ' + ', '.join(lint)
                    result['types'] = 'pre-commit+importers'
            elif lint:
                result['output'] += '\nPush budget exhausted; typed lint runs in CI: ' + ', '.join(lint)
        elif not types_available:
            result['output'] += '\nTyped importers require exact generated inputs; CI owns this remainder'
        else:
            result['output'] += '\nPush budget exhausted before typed importer selection; CI owns importers of: ' + ', '.join(files)
        if before != snapshot(root, files):
            result.update(phase='working-tree', output='Inputs changed during checks; retry next minute')
            return result
    result.update(ok=True, phase='passed')
    return result


def main():
    root = Path(git(Path.cwd(), 'rev-parse', '--show-toplevel'))
    tip = sys.argv[1] if len(sys.argv) > 1 else 'main'
    tip = git(root, 'rev-parse', tip)
    base = git(root, 'merge-base', 'origin/main', tip)
    result = check(root, base, tip, time.monotonic() + LIMIT)
    print(json.dumps(result))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
