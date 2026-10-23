"""Exact staged text inputs for the five-second commit checks; no build assets."""
import json
import os
from pathlib import Path, PurePosixPath
import runpy
import re
import subprocess
import sys
import time

TEXT = {'.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json', '.jsonc',
        '.yaml', '.yml', '.css', '.glsl', '.frag', '.vert', '.wgsl', '.as', '.py', '.sh', '.html'}
ROOTS = {'src', 'scripts', 'test', 'lint', 'vite', 'budgets', '.github', 'admin', 'api', 'drafts'}


def staged_source(repo, tree, deadline, revision=None):
    def git(*args, **kwargs):
        return subprocess.check_output(['git', *args], cwd=repo,
                                       timeout=max(.01, deadline - time.time()), **kwargs)
    listed = git('ls-files', '--stage', '-z') if revision is None else git('ls-tree', '-rz', revision)
    entries = []
    records = []
    for row in listed.split(b'\0'):
        if not row:
            continue
        header, name = row.split(b'\t', 1)
        mode, middle, last = header.split()
        oid, stage = (middle, last) if revision is None else (last, b'0')
        if stage != b'0':
            raise ValueError('Commit checks require an unconflicted index')
        path = PurePosixPath(os.fsdecode(name))
        if path.is_absolute() or '..' in path.parts:
            raise ValueError('Unsafe staged source path')
        records.append(mode + b' blob ' + oid + b'\t' + name)
        selected = len(path.parts) == 1 or path.parts[0] in ROOTS and path.suffix in TEXT or str(path) == 'docs/HOST-BAR.md'
        if selected:
            if mode == b'120000':
                raise ValueError('Commit source snapshot refuses symlinks: ' + str(path))
            entries.append((path, oid, mode))
    raw = git('cat-file', '--batch', input=b''.join(oid + b'\n' for _, oid, _ in entries))
    at = 0
    for path, _, mode in entries:
        if time.time() >= deadline:
            raise TimeoutError('Staged source preparation exceeded five-second budget')
        end = raw.index(b'\n', at)
        size = int(raw[at:end].split()[2])
        target = tree / str(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw[end + 1:end + 1 + size])
        if mode == b'100755':
            target.chmod(0o755)
        at = end + size + 2
    (tree / '.push-tracked.json').write_text(json.dumps([os.fsdecode(row.split(b'\t', 1)[1]) for row in records]))
    # Tests may use the newest verified generation, never loose shared outputs.
    # This does not establish a current-source type proof.
    revision = None
    cache = repo / 'scripts/push_input_cache.py'
    if cache.exists() and (repo / 'tmp/push-input-cache/entries.json').exists():
        revision = runpy.run_path(str(cache))['restore_tests'](repo, tree, records, time.monotonic() + max(0, min(deadline - time.time(), .75)))
    # Imported asset URLs are part of these source guards. Read exact Git
    # objects in one batch; never take the shared working build-copy assets.
    blobs = {os.fsdecode(row.split(b'\t', 1)[1]): row.split(b'\t', 1)[0].split()[2] for row in records}
    assets = set()
    for folder in ['src', 'test']:
        for source in (tree / folder).rglob('*'):
            if source.suffix not in {'.ts', '.tsx', '.mts', '.mjs', '.js'}:
                continue
            for value in re.findall(r"""(?:from\s+|import\s*\(\s*|import\s*)["']([^"']+\.(?:png|jpe?g|webp|svg|hdr|glb|bin|wasm|json)(?:\?[^"']*)?)["']""", source.read_text()):
                value = value.split('?', 1)[0]
                name = value[1:] if value.startswith('/src/') else os.path.normpath(str(source.relative_to(tree).parent / value))
                if name in blobs and not (tree / name).exists():
                    assets.add(name)
    names = sorted(assets)
    raw = git('cat-file', '--batch', input=b''.join(blobs[name] + b'\n' for name in names))
    at = 0
    for name in names:
        end = raw.index(b'\n', at)
        size = int(raw[at:end].split()[2])
        target = tree / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw[end + 1:end + 1 + size])
        at = end + size + 2
    (tree / '.commit-inputs.json').write_text(json.dumps({'testRevision': revision}))


if __name__ == '__main__':
    try:
        staged_source(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), float(sys.argv[3]))
    except (TimeoutError, subprocess.TimeoutExpired) as error:
        print('pre-commit source preparation deferred: ' + str(error), file=sys.stderr)
        raise SystemExit(124)
