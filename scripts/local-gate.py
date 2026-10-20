#!/usr/bin/env python3
"""G416: validate a real build, not historical outputs or process receipts.

Steps (Jake, 2026-10-15: related tests only at push; the full suite runs in CI on every push, fix-forward):
pnpm gen, check-graph, changed-file types, oxlint on the changed files, the tests that import the changed files
(scripts/gate-related-tests.mjs, capped near 45 s) and the production build (`pnpm build`) under the gate's own
`push-gate` lease. Each step's seconds go to stdout and .git/push-gate-steps.jsonl.
"""
import json
import re
import os
from pathlib import Path
import subprocess
import sys
import time


def required_test_products(tests, registry):
    """Explicit disk-product edges, including tests whose imports cannot name them."""
    products = set()
    for test in tests:
        if re.fullmatch(r'test/scripts/[^/]+\.test\.ts', test) and test not in registry:
            raise ValueError('Register disk scenario products before gating: ' + test)
        products.update(registry.get(test, []))
    return sorted(products)


def custom_section_growth_command(tree, repo, base, sha, common):
    """Only the immutable carrier's checker can vouch for its products."""
    growth = tree / 'scripts/check-custom-section-growth.mjs'
    if not growth.is_file():
        return None
    return ['node', str(growth), str(repo), base, sha,
            str(common / 'custom-section-measures')]


def main():
    inside = os.environ.get('WS_GATE_REPO')
    root = Path(inside) if inside else Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
    sha = subprocess.check_output(['git', 'rev-parse', '--verify', sys.argv[1] + '^{commit}'], cwd=root, text=True).strip()
    common = Path(subprocess.check_output(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=root, text=True).strip())
    base = subprocess.check_output(['git', 'merge-base', 'origin/main', sha], cwd=root, text=True).strip()
    # Old build-only stamps cannot vouch for G518. A changed pushed base needs
    # its own comparison, even when this candidate has already been built.
    passed = common / 'build-gate-g518' / (sha + '-' + base)
    if passed.exists():
        print('vercel-gate: ' + sha[:9] + ' build already passed')
        return 0
    if not inside:
        # Build the commit in the locked `gate` slot of the build mirror: one persistent copy under ./tmp, without art/,
        # progress/ and sources/ like Vercel's .vercelignore tree, synced file by file instead of a fresh 5 GB export per
        # push. This script re-runs itself there.
        mirror = [str(root / 'scripts/build-mirror.mjs'), 'run', sha, '--slot', 'gate', '--']
        return subprocess.run(['node', *mirror, sys.executable, str(root / 'scripts/local-gate.py'), sha],
                              env=dict(os.environ, WS_GATE_REPO=str(root))).returncode
    timings = {}
    started = time.time()
    present, tests, passed_gate = [], None, False

    def run(name, command, **options):
        step = time.time()
        try:
            return subprocess.run(command, cwd=tree, env=env, check=True, **options)
        finally:
            timings[name] = round(time.time() - step, 1)
            print('vercel-gate: step ' + name + ' ' + str(timings[name]) + 's', flush=True)

    try:
        tree = Path.cwd().resolve()
        # Four workers for the short related-test phase (the full suite ran on two); only Vitest reads it.
        # Production refusals (including stale map stamps) must fail here just
        # as they do in Actions; local capture previews retain warning mode.
        # Gate readers parse the raw diagnostics for green-prefix selection.
        # Keep nested entry points verbose; only an explicit outer --quiet logs them.
        env = dict(os.environ, CI='true', WS_VITEST_MAX_WORKERS='4', WS_QUIET_ACTIVE='1')
        env.pop('WS_GATE_REPO', None)
        for key in subprocess.check_output(['git', 'rev-parse', '--local-env-vars'], cwd=root, text=True).splitlines():
            env.pop(key, None)
        changed = subprocess.check_output(['git', 'diff', '--name-only', '--no-renames', base, sha], cwd=root, text=True).splitlines()
        existing = [path for path in changed if (tree / path).is_file()]
        present = [path for path in existing if path.endswith(('.ts', '.tsx', '.js', '.mjs', '.cjs'))]
        source_list = tree / '.local-gate-changed.json'
        source_list.write_text(json.dumps(present))
        # Every changed file (JSON data and GLSL are imported too) seeds the related-test walk.
        related_list = tree / '.local-gate-related.json'
        related_list.write_text(json.dumps(changed))
        run('gen', ['pnpm', 'gen'])
        run('check-graph', ['node', 'scripts/check-graph.mjs', '--source-only'])
        # The root project's full `tsc --noEmit` runs inside `pnpm build` below; the changed roots of the other projects
        # (scripts, api, admin, drafts) are only checked here.
        run('types', ['node', 'scripts/local-gate-checks.mjs', 'types', str(source_list), '--skip=tsconfig.json'])
        # oxlint exits 1 on 'No files found to lint' when every file is in its ignorePatterns.
        # .oxlintrc.json is JSONC (comments, globs with '/*'), so read only its ignorePatterns array.
        listing = re.search(r'"ignorePatterns"\s*:\s*\[([^\]]*)\]', (tree / '.oxlintrc.json').read_text())
        ignored = re.findall(r'"([^"]+)"', listing.group(1)) if listing else []
        # gitignore-style: a pattern with an inner '/' is anchored at the root, otherwise it matches at any depth.
        def is_ignored(path):
            return any(path.startswith(p) if '/' in p[:-1] else (path.startswith(p) or f'/{p}' in path) for p in ignored)
        lintable = [path for path in present if not is_ignored(path)]
        if lintable:
            run('oxlint', ['pnpm', 'exec', 'oxlint', '--type-aware', '-c', '.oxlintrc.json', *lintable])
        # The tests that import the changed files, not the whole suite (focused files need no full-test lease).
        # The checkout's selector, like this script, so a tip older than the selector still runs it.
        selected = run('select-tests', ['node', str(root / 'scripts/gate-related-tests.mjs'), str(related_list)],
                       stdout=subprocess.PIPE, text=True)
        tests = json.loads(selected.stdout.strip().splitlines()[-1])
        if tests:
            registry_path = tree / 'scripts/gate-test-products.json'
            if not registry_path.exists():
                registry_path = root / 'scripts/gate-test-products.json'
            registry = json.loads(registry_path.read_text())
            products = required_test_products(tests, registry)
            if products:
                run('test-products', ['node', 'scripts/build-shardfiles.mjs', '--reuse', '--shard=' + ','.join(products)])
                env['WS_TEST_PRODUCTS_SHA'] = sha
            run('vitest', ['pnpm', 'exec', 'vitest', 'run', *tests])
        # Vercel's `pnpm build`, under the gate's own lease (heavy-lane.py RESOURCES) so it never queues behind a lane's
        # build. Its leading `pnpm gen` repeats the first step on the same tree, so the gate runs the rest of the
        # script; any other shape of package.json's build script runs whole.
        build = json.loads((tree / 'package.json').read_text())['scripts']['build']
        shape = re.fullmatch(r"python3 scripts/heavy-lane\.py build -- bash -c 'pnpm gen && ([^']+)'", build)
        command = ['pnpm', 'exec', 'bash', '-c', shape.group(1)] if shape else ['pnpm', 'build']
        run('build', [sys.executable, 'scripts/heavy-lane.py', 'gate', '--', *command])
        # A carrier older than 7db7073437 has no growth check in its tree; skip it there rather than fail the push.
        growth = custom_section_growth_command(tree, root, base, sha, common)
        if growth is not None:
            run('custom-section-growth', growth)
        else:
            print('vercel-gate: custom-section-growth skipped (commit predates the check)')
        passed.parent.mkdir(parents=True, exist_ok=True)
        passed.write_text('build passed\n')
        passed_gate = True
        print('vercel-gate: ' + sha[:9] + ' passed')
        return 0
    except subprocess.CalledProcessError as error:
        print('vercel-gate: FAILED at ' + sha[:9] + ' — ' + str(error), file=sys.stderr)
        return 1
    finally:
        # `passed` says whether the gate passed: a failed gate still records the seconds of the steps it ran (a record
        # alone once read as a pass for a tip whose Pine build had refused).
        record = {'at': int(started), 'tip': sha, 'passed': passed_gate, 'changed': len(present), 'tests': None if tests is None else len(tests),
                  'total': round(time.time() - started, 1), **timings}
        try:
            with (common / 'push-gate-steps.jsonl').open('a') as log:
                log.write(json.dumps(record) + '\n')
        except OSError:
            pass


if __name__ == '__main__':
    from quiet_logs import requested, run_logged
    if '--quiet' in sys.argv[1:] and requested(sys.argv[1:]):
        sys.exit(run_logged('vercel-gate', [sys.executable, __file__,
                            *[arg for arg in sys.argv[1:] if arg != '--quiet']]))
    sys.exit(main())
