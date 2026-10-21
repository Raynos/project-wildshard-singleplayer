#!/usr/bin/env python3
"""G509 per-batch checks. Run directly: mirror admission precedes inner build leases."""
import argparse
import json
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys
import tempfile


def run(command, **options):
    print('+ ' + repr(command), flush=True)
    return subprocess.run(command, check=True, **options)


def lint_sources(tree, changed):
    listing = re.search(r'"ignorePatterns"\s*:\s*\[([^\]]*)\]', (tree / '.oxlintrc.json').read_text())
    ignored = re.findall(r'"([^"]+)"', listing.group(1)) if listing else []
    return [path for path in changed if path.endswith(('.ts', '.tsx', '.js', '.mjs', '.cjs'))
            and (tree / path).is_file() and not any(
                path.startswith(p) if '/' in p[:-1] else (path.startswith(p) or f'/{p}' in path)
                for p in ignored)]


def check_sources(root, sha, base):
    tree = Path.cwd()
    changed = subprocess.check_output(['git', 'diff', '--name-only', '--no-renames', base, sha],
                                      cwd=root, text=True).splitlines()
    run(['node', 'scripts/gen.mjs'])
    run(['pnpm', 'exec', 'tsc', '--noEmit'])
    run(['pnpm', 'exec', 'tsc', '-b', 'tsconfig.layers.json'])
    # Use the same peripheral-project checks, selector and disk registry as the push gate.
    (tree / 'tmp').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='batch-check-', dir=tree / 'tmp') as temporary:
        changes = Path(temporary) / 'changed.json'
        changes.write_text(json.dumps(changed))
        run(['node', 'scripts/local-gate-checks.mjs', 'types', str(changes), '--skip=tsconfig.json'])
        lintable = lint_sources(tree, changed)
        if lintable:
            run(['pnpm', 'exec', 'oxlint', '--type-aware', '-c', '.oxlintrc.json', *lintable])
        selected = run(['node', 'scripts/gate-related-tests.mjs', str(changes)], stdout=subprocess.PIPE, text=True)
        tests = json.loads(selected.stdout.strip().splitlines()[-1])
        registry = json.loads((tree / 'scripts/gate-test-products.json').read_text())
        products = runpy.run_path(str(root / 'scripts/local-gate.py'))['required_test_products'](tests, registry)
        env = dict(os.environ, WS_VITEST_MAX_WORKERS='4')
        if products:
            run(['python3', 'scripts/heavy-lane.py', 'build', '--', 'node', 'scripts/build-shardfiles.mjs',
                 '--reuse', '--shard=' + ','.join(products)])
            env['WS_TEST_PRODUCTS_SHA'] = sha
        if tests:
            run(['pnpm', 'exec', 'vitest', 'run', *tests], env=env)


def boot(root, sha, shards, scratch):
    env = dict(os.environ, SERVE_OWNER='batch-check-' + str(os.getpid()))
    if not shards:
        return
    port = None
    try:
        served = run(['bash', str(root / 'scripts/serve-build.sh'), '--rev', sha, '--shard', ','.join(shards),
                      '--hours', '1', '--name', 'batch-check'], cwd=scratch, env=env,
                     stdout=subprocess.PIPE, text=True)
        match = re.search(r'^http://127\.0\.0\.1:(\d+)/$', served.stdout, re.MULTILINE)
        if match is None:
            raise ValueError('serve-build returned no preview URL: ' + served.stdout)
        port = match.group(1)
        for shard in shards:
            run(['bash', str(root / 'scripts/browser-lane.sh'), '--max', '6', 'node',
                 str(root / 'scripts/batch-first-frame.mjs'), '--url=http://127.0.0.1:' + port, '--shard=' + shard],
                cwd=root, env=env)
    finally:
        # This unique owner also cleans up a preview if serving failed after starting it.
        run(['bash', str(root / 'scripts/serve-build.sh'), 'stop', port or 'all-mine'], cwd=scratch, env=env)


def declared_outputs(root, sha):
    """Every output slug the source folders at this commit declare (src/shards/<folder>/outputs.json)."""
    listing = subprocess.check_output(['git', 'ls-tree', '--name-only', sha, 'src/shards/'], cwd=root, text=True).split()
    slugs = set()
    for folder in listing:
        shown = subprocess.run(['git', 'show', sha + ':' + folder + '/outputs.json'], cwd=root,
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        if shown.returncode == 0:
            slugs.update(row['slug'] for row in json.loads(shown.stdout)['outputs'])
    return slugs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rev', default='HEAD', help='immutable commit to check')
    parser.add_argument('--base', default='origin/main', help='changed-file range starts at merge-base with this ref')
    parser.add_argument('--inside', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('shards', nargs='+')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    sha = subprocess.check_output(['git', 'rev-parse', '--verify', args.rev + '^{commit}'], cwd=root, text=True).strip()
    base = subprocess.check_output(['git', 'merge-base', args.base, sha], cwd=root, text=True).strip()
    for shard in args.shards:
        if re.fullmatch(r'[a-z0-9_-]+', shard) is None:
            parser.error('invalid shard slug: ' + shard)
        # A declared shard has manifest.json; a shard still on the trusted runtime has manifest.ts; an output of a source
        # folder (SF88g, scripts/shard-outputs.mjs) is a row of that folder's outputs.json.
        if not any(subprocess.run(['git', 'cat-file', '-e', sha + ':src/shards/' + shard + '/manifest.' + ext],
                                  cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
                   for ext in ('json', 'ts')) and shard not in declared_outputs(root, sha):
            parser.error('no shard manifest at ' + sha + ': ' + shard)
    if args.inside:
        check_sources(root, sha, base)
        return 0
    run(['node', str(root / 'scripts/build-mirror.mjs'), 'run', sha, '--slot', os.environ.get('WILDSHARD_MIRROR_SLOT', 'check'), '--',
         sys.executable, str(root / 'scripts/batch_check.py'), '--inside', '--rev', sha, '--base', base, *args.shards], cwd=root)
    # Release the check mirror before serve-build acquires it, then build inside its lease.
    (root / 'tmp').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='batch-check-', dir=root / 'tmp') as scratch:
        boot(root, sha, list(dict.fromkeys(args.shards)), scratch)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (subprocess.CalledProcessError, ValueError) as error:
        print('batch-check: ' + str(error), file=sys.stderr)
        sys.exit(1)
