#!/usr/bin/env python3
"""G416: validate a real build, not historical outputs or process receipts."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
    sha = subprocess.check_output(['git', 'rev-parse', '--verify', sys.argv[1] + '^{commit}'], cwd=root, text=True).strip()
    common = Path(subprocess.check_output(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=root, text=True).strip())
    passed = common / 'build-gate-g416' / sha
    if passed.exists():
        print('vercel-gate: ' + sha[:9] + ' build already passed')
        return 0
    try:
        with tempfile.TemporaryDirectory(prefix='wildshard-build-gate-') as temporary:
            tree = Path(temporary).resolve()
            archive = tree / 'source.tar'
            subprocess.run(['git', 'archive', sha, '--output', str(archive)], cwd=root, check=True)
            subprocess.run(['tar', '-xf', str(archive), '-C', str(tree)], check=True)
            archive.unlink()
            subprocess.run(['node', str(root / 'scripts/link-node-modules.mjs'), str(root), str(tree)], check=True)
            env = dict(os.environ, WS_VITEST_MAX_WORKERS='2', WS_FULL_SUITE='1')
            for key in subprocess.check_output(['git', 'rev-parse', '--local-env-vars'], cwd=root, text=True).splitlines():
                env.pop(key, None)
            base = subprocess.check_output(['git', 'merge-base', 'origin/main', sha], cwd=root, text=True).strip()
            changed = subprocess.check_output(['git', 'diff', '--name-only', '--no-renames', base, sha], cwd=root, text=True).splitlines()
            present = [path for path in changed if (tree / path).is_file() and path.endswith(('.ts', '.tsx', '.js', '.mjs', '.cjs'))]
            source_list = tree / '.local-gate-changed.json'
            source_list.write_text(json.dumps(present))
            commands = [['pnpm', 'gen'], ['node', 'scripts/check-graph.mjs', '--source-only'],
                        ['node', 'scripts/local-gate-checks.mjs', 'types', str(source_list)]]
            if present:
                commands.append(['pnpm', 'exec', 'oxlint', '--type-aware', '-c', '.oxlintrc.json', *present])
            commands.extend([['pnpm', 'test'], ['pnpm', 'build']])
            for command in commands:
                subprocess.run(command, cwd=tree, env=env, check=True)
        passed.parent.mkdir(parents=True, exist_ok=True)
        passed.write_text('build passed\n')
        print('vercel-gate: ' + sha[:9] + ' passed')
        return 0
    except subprocess.CalledProcessError as error:
        print('vercel-gate: FAILED at ' + sha[:9] + ' — ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
