#!/usr/bin/env python3
"""G363: immutable changed-file checks, one fail-closed two-minute deadline."""
import concurrent.futures
import json
import os
import pathlib
import signal
import subprocess
import sys
import tempfile
import time

CAP_SECONDS = 120


def bounded(command, cwd, deadline, output=None, env=None):
    """A timeout kills only this command's owned process tree, including forks."""
    child = subprocess.Popen(command, cwd=cwd, env=env, start_new_session=True,
                             stdout=output, stderr=subprocess.STDOUT if output else None)
    try:
        return child.wait(timeout=max(0.001, deadline - time.monotonic()))
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
        return 124


def main():
    started = time.monotonic()
    # Reserve cleanup/receipt time inside the hard 120s cap.
    deadline = started + CAP_SECONDS - 2
    root = pathlib.Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
    sha = subprocess.check_output(['git', 'rev-parse', '--verify', sys.argv[1] + '^{commit}'], cwd=root, text=True).strip()
    common = pathlib.Path(subprocess.check_output(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=root, text=True).strip())
    stamps = common / 'local-gate-g363-v1'
    steps = {}
    ok = False
    try:
        if (stamps / sha).exists():
            ok = True
            print('vercel-gate: ' + sha[:9] + ' already passed (exact SHA)')
            return 0
        with tempfile.TemporaryDirectory(prefix='wildshard-local-gate-') as tmp:
            work = pathlib.Path(tmp).resolve()
            tree = work / 'tree'
            tree.mkdir()

            def run(name, command, cwd=tree, env=None):
                before = time.monotonic()
                log = work / (name + '.log')
                with log.open('w') as stream:
                    code = bounded(command, cwd, deadline, stream, env)
                steps[name] = round(time.monotonic() - before, 3)
                print(f'  {"✓" if code == 0 else "✗"} {name} ({steps[name]:.3f} s)', flush=True)
                if code:
                    print('── ' + name + ' ──', flush=True)
                    print(log.read_text()[-12000:], flush=True)
                    raise RuntimeError(name + (' exceeded 120s gate deadline' if code == 124 else ' failed'))

            # Retain the original Vercel-ignore admission on this exact tree.
            run('ignore-init', ['git', 'init', '-q', str(work / 'ign')], root)
            ignore = subprocess.run(['git', 'show', sha + ':.vercelignore'], cwd=root, capture_output=True, check=False)
            (work / 'ignore').write_bytes(ignore.stdout)
            names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', sha], cwd=root)
            ignored = subprocess.run(['git', '-C', str(work / 'ign'), '-c', 'core.excludesFile=' + str(work / 'ignore'), 'check-ignore', '--no-index', '--stdin'], input=names, capture_output=True, check=False)
            if ignored.returncode not in (0, 1):
                raise RuntimeError('Vercel ignore admission failed')
            dropped = set(ignored.stdout.decode().splitlines())
            bad = [p for p in dropped if p != '.vercelignore' and ('/' not in p or p.startswith(('src/', 'public/', 'api/', 'scripts/')))]
            if bad:
                raise RuntimeError('.vercelignore excludes build inputs: ' + ', '.join(sorted(bad)))
            environment = dict(os.environ, GIT_INDEX_FILE=str(work / 'index'))
            run('read-tree', ['git', 'read-tree', sha], root, environment)
            keep = b'\0'.join(p for p in names.splitlines() if p.decode() not in dropped) + b'\0'
            (work / 'keep').write_bytes(keep)
            with (work / 'keep').open('rb') as source:
                before = time.monotonic()
                child = subprocess.Popen(['git', 'checkout-index', '-z', '--stdin', '--prefix=' + str(tree) + '/'], cwd=root, env=environment, stdin=source, start_new_session=True)
                try:
                    code = child.wait(timeout=max(0.001, deadline - time.monotonic()))
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait()
                    raise RuntimeError('export exceeded 120s gate deadline')
                if code:
                    raise RuntimeError('export failed')
                steps['export'] = round(time.monotonic() - before, 3)
            run('workspace-links', ['node', str(root / 'scripts/link-node-modules.mjs'), str(root), str(tree)])
            base = subprocess.check_output(['git', 'merge-base', 'origin/main', sha], cwd=root, text=True).strip()
            changed = subprocess.check_output(['git', 'diff', '--name-only', '--no-renames', base, sha], cwd=root, text=True).splitlines()
            (tree / '.local-gate-changed.json').write_text(json.dumps(changed))
            present = [p for p in changed if (tree / p).is_file() and p.endswith(('.ts', '.tsx', '.js', '.mjs', '.cjs'))]
            if present:
                # These are ephemeral build inputs, not committed-output regeneration.
                run('generation-inputs', ['node', str(root / 'scripts/commit-inputs.mjs'), '--restore', str(root), sha, str(tree)])
                run('affected-plan', ['node', str(root / 'scripts/local-gate-checks.mjs'), 'plan', str(tree / '.local-gate-changed.json'), str(common / 'gate-vitest-results')])
                plan = json.loads((tree / '.local-gate-plan.json').read_text())
                print((work / 'affected-plan.log').read_text(), flush=True)
                jobs = [('typecheck', ['node', str(root / 'scripts/local-gate-checks.mjs'), 'types', str(tree / '.local-gate-changed.json')]),
                        ('oxlint', ['pnpm', 'exec', 'oxlint', '--type-aware', '-c', '.oxlintrc.json', *present])]
                if plan['local']:
                    jobs.append(('vitest', ['pnpm', 'exec', 'vitest', 'run', *plan['local']]))
                test_env = dict(os.environ, WS_VITEST_MAX_WORKERS=os.environ.get('WS_VITEST_MAX_WORKERS', '4'))
                with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                    futures = [executor.submit(run, name, command, tree, test_env) for name, command in jobs]
                    errors = []
                    for future in futures:
                        try:
                            future.result()
                        except RuntimeError as error:
                            errors.append(str(error))
                    if errors:
                        raise RuntimeError(', '.join(errors))
            if time.monotonic() > deadline:
                raise RuntimeError('total exceeded 120s gate deadline')
            stamps.mkdir(exist_ok=True)
            (stamps / sha).write_text(sha + '\n')
            ok = True
            print('vercel-gate: ' + sha[:9] + ' passed')
            return 0
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print('vercel-gate: FAILED at ' + sha[:9] + ' — ' + str(error), file=sys.stderr)
        return 1
    finally:
        wall = round(time.monotonic() - started, 3)
        print(f'vercel-gate: total {wall:.3f}s / 120s; ' + ('GREEN' if ok else 'RED'), flush=True)
        with (common / 'gate-timings.jsonl').open('a') as stream:
            stream.write(json.dumps(dict(at=int(time.time()), sha=sha, wall=wall, mode='changed', ok=ok, steps=steps)) + '\n')


if __name__ == '__main__':
    sys.exit(main())
