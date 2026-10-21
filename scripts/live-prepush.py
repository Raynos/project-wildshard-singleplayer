#!/usr/bin/env python3
"""D8: live changed-root checks in one 45-second budget; CI owns builds."""
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
SOURCE = re.compile(r'\.(?:[cm]?[jt]sx?)$')
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


def lint_sources(root, files):
    config = (root / '.oxlintrc.json').read_text()
    listing = re.search(r'"ignorePatterns"\s*:\s*\[([^\]]*)\]', config)
    ignored = re.findall(r'"([^"]+)"', listing.group(1)) if listing else []
    return [name for name in files if SOURCE.search(name) and (root / name).is_file()
            and not any(name.startswith(p) if '/' in p[:-1]
                        else name.startswith(p) or '/' + p in name for p in ignored)]


def failure_paths(output):
    plain = ANSI.sub('', output)
    # TS, oxlint and Vitest diagnostics. Unknown errors never guess a prefix.
    return sorted(set(re.findall(r'(?<![\w/])((?:src|scripts|test|admin|api|drafts|lint|vite)/[^\s():\x1b]+\.(?:[cm]?[jt]sx?|json|py|sh))', plain)))


def check(root, base, tip, deadline, runner=run, files=None, tools=None):
    files = changed(root, base, tip) if files is None else files
    tools = root / 'scripts' if tools is None else tools
    result = {'ok': False, 'phase': 'working-tree', 'files': [], 'output': ''}
    before = snapshot(root, files)
    (root / 'tmp').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='live-prepush-', dir=root / 'tmp') as temporary:
        listing = Path(temporary) / 'changed.json'
        listing.write_text(json.dumps(files))
        lintable = lint_sources(root, files)
        commands = [('types', ['node', str(tools / 'local-gate-checks.mjs'), 'types', str(listing)])]
        if lintable:
            commands.append(('lint', ['pnpm', 'exec', 'oxlint', '--type-aware', '-c', '.oxlintrc.json', *lintable]))
        env = dict(os.environ, WS_VITEST_MAX_WORKERS='4', WS_LIVE_PREPUSH='1', NO_COLOR='1')
        for phase, command in commands:
            rc, output = runner(command, root, deadline, env)
            if rc:
                result.update(phase=phase, output=output, files=failure_paths(output))
                return result
        # Selection also consumes the same budget; it never prepares products.
        left = deadline - time.monotonic()
        if left > 2:
            rc, output = runner(['node', str(tools / 'gate-related-tests.mjs'), str(listing),
                                 '--live', '--budget=' + str(max(0, left - 2))], root, deadline, env)
            if rc not in (0, 124):
                result.update(phase='selection', output=output, files=failure_paths(output))
                return result
            if rc == 0:
                tests = json.loads(output.strip().splitlines()[-1])
                if tests:
                    rc, output = runner(['pnpm', 'exec', 'vitest', 'run', *tests], root, deadline, env)
                    # An actual refusal remains red, even if the clock then expires.
                    failed = re.search(r'(?:FAIL\s+|failed\s*\(|Tests\s+\d+ failed|Test Files\s+\d+ failed)', ANSI.sub('', output))
                    if rc != 0 and (rc != 124 or failed):
                        result.update(phase='tests', output=output, files=failure_paths(output))
                        return result
                    if rc == 124:
                        result['output'] = 'Related tests reached the ceiling; remainder runs in CI'
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
