#!/usr/bin/env bash
# CI7: the sha256 of every generated file in this CI job's tree: the ignored, untracked or modified files under the
# roots scripts/ci-products.py packs, sorted by path. The fixtures job writes it beside its snapshots; a test shard reads
# those snapshots only when its own tree (prepare's unpacked products) hashes the same.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${GITHUB_JOB:-}" = fixtures ]; then
  # Keep the before-snapshot census in check annotations too: a disk-full
  # runner can lose its job log. Stderr leaves the hash manifest unchanged.
  python3 - <<'PY' >&2
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import subprocess

try:
    cache_home = Path.home()
    paths = [('workspace', Path('.')), ('dist', Path('dist')),
             ('out', Path('out')), ('tmp', Path('tmp')),
             ('gen', cache_home / '.cache/wildshard/gen'),
             ('spawn-parts-br', cache_home / '.cache/wildshard/gen/spawn-parts-br'),
             ('generate', cache_home / '.cache/wildshard/generate'),
             ('shardfiles', cache_home / '.cache/wildshard/shardfiles')]
    for name, path in paths:
        row = {'name': name, 'exists': path.exists(),
               'observedAt': datetime.now(timezone.utc).isoformat(),
               'sha': os.environ.get('GITHUB_SHA'),
               'run': os.environ.get('GITHUB_RUN_ID'),
               'scope': 'runner' if os.environ.get('GITHUB_ACTIONS') == 'true' else 'local-control'}
        if path.exists():
            disk = os.statvfs(path)
            row.update(freeBytes=disk.f_bavail * disk.f_frsize, freeInodes=disk.f_favail)
            size = subprocess.run(['du', '-sk', str(path)], capture_output=True, text=True)
            fields = size.stdout.split()
            row['allocatedBytes'] = int(fields[0]) * 1024 if size.returncode == 0 and fields else None
            if name in ('dist', 'spawn-parts-br'):
                parts = {'raw': {'files': 0, 'bytes': 0}, 'br': {'files': 0, 'bytes': 0}}
                for root, _, files in os.walk(path):
                    for file in files:
                        kind = 'raw' if file.endswith('.pack') else 'br' if file.endswith('.br') else None
                        member = Path(root) / file
                        if kind is not None and not member.is_symlink():
                            parts[kind]['files'] += 1
                            parts[kind]['bytes'] += member.stat().st_size
                row['parts'] = parts
        print('::notice title=Fixture disk before snapshots::' + json.dumps(row, separators=(',', ':')), flush=True)
except (OSError, ValueError) as error:
    print('::notice title=Fixture disk before snapshots::Census unavailable: ' + type(error).__name__, flush=True)
PY
fi
roots=(src public out docs/api lint)
{
  git ls-files -z --others --ignored --exclude-standard -- "${roots[@]}"
  git ls-files -z --others --exclude-standard -- "${roots[@]}"
  git diff --name-only -z --diff-filter=AM
} | sort -zu | grep -zvE '(^|/)(\.git|node_modules|\.cache|__pycache__)(/|$)' \
  | xargs -0 -r -P4 -n64 sha256sum | LC_ALL=C sort -k2
