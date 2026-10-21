"""Disposable committed source inputs, without a worktree, archive, mirror or build."""
import contextlib
import hashlib
import json
import os
import runpy
from pathlib import Path, PurePosixPath
import subprocess
import tempfile
import time

TEXT = {'.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json', '.jsonc',
        '.yaml', '.yml', '.css', '.glsl', '.frag', '.vert', '.wgsl', '.as', '.py', '.sh', '.md', '.html'}
ROOTS = {'src', 'scripts', 'test', 'lint', 'vite', 'admin', 'api', 'drafts', 'site', 'docs', 'budgets', '.githooks'}
TOOLS = ['local-gate-checks.mjs', 'gate-related-tests.mjs', 'push-inputs.mjs', 'test-products.json', 'push-tables.mjs', 'authored-manifest.mjs', 'manifest-budget.mjs', 'manifest-spawns.mjs']


def source_file(name):
    path = PurePosixPath(name)
    return not path.is_absolute() and '..' not in path.parts and (
        len(path.parts) == 1 or path.parts[0] in ROOTS) and (path.suffix in TEXT or len(path.parts) == 1)


def command(root, args, deadline, **options):
    return subprocess.run(args, cwd=root, check=True, timeout=max(.01, deadline - time.monotonic()), **options)


def outputs(repo, tree, records, deadline, assets=()):
    """Only committed pins or an exact commit-input key can supply ignored source outputs."""
    common = Path(command(repo, ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], deadline,
                          capture_output=True, text=True).stdout.strip())
    selected = [row for row in records if row.split(b'\t', 1)[1].startswith(
        (b'src/', b'scripts/', b'lint/', b'public/', b'test/', b'music/', b'sfx/',
         b'package', b'pnpm', b'vite', b'vitest', b'tsconfig', b'.oxlint'))]
    key = hashlib.sha256(b'\0'.join(selected)).hexdigest()
    manifest = common / 'commit-inputs' / (key + '.json')
    pinned = {}
    cached = {}
    registry = tree / 'scripts/generation-jobs.json'
    if registry.exists():
        for job in json.loads(registry.read_text())['jobs']:
            pins = {**job.get('comparisonOutputs', {}), **job.get('buildOutputs', {})}
            pinned.update(pins)
            cache = Path(os.environ.get('WILDSHARD_GENERATE_CACHE', str(Path.home() / '.cache/wildshard/generate'))) / job['id']
            if cache.is_dir() and pins:
                for directory in cache.iterdir():
                    receipt = directory / '.generation-receipt.json'
                    if not receipt.is_file():
                        continue
                    try:
                        values = json.loads(receipt.read_text())['files']
                    except (ValueError, KeyError):
                        continue
                    for name, digest in pins.items():
                        if (source_file(name) or name in assets) and values.get(name) == digest:
                            cached.setdefault(name, []).append(directory / name)
    exact = json.loads(manifest.read_text()) if manifest.exists() else {}
    for name, digest in {**pinned, **exact}.items():
        if time.monotonic() >= deadline:
            raise TimeoutError('committed source preparation exceeded budget')
        if not (source_file(name) or name in assets) or (tree / name).exists():
            continue
        paths = [common / 'commit-inputs/blobs' / digest]
        if name in pinned:
            paths.append(repo / name)
            paths.extend(cached.get(name, []))
        for source in paths:
            if source.is_file():
                data = source.read_bytes()
                if hashlib.sha256(data).hexdigest() == digest:
                    target = tree / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(data)
                    break


@contextlib.contextmanager
def committed_source(repo, revision, tooling_revision, deadline):
    folder = repo / 'tmp'
    folder.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='push-source-', dir=folder) as temporary:
        tree = Path(temporary).resolve()
        listed = command(repo, ['git', 'ls-tree', '-rz', revision], deadline, capture_output=True).stdout
        records = [row for row in listed.split(b'\0') if row]
        entries = [row.split(b'\t', 1) for row in records]
        entries = [(header.split(), name.decode()) for header, name in entries if source_file(name.decode())]
        entries = [(header, name) for header, name in entries if header[1] == b'blob' and header[0] != b'120000']
        raw = command(repo, ['git', 'cat-file', '--batch'], deadline, input=b''.join(
            header[2] + b'\n' for header, _ in entries), capture_output=True).stdout
        at = 0
        for header, name in entries:
            if time.monotonic() >= deadline:
                raise TimeoutError('committed source preparation exceeded budget')
            end = raw.index(b'\n', at)
            size = int(raw[at:end].split()[2])
            data = raw[end + 1:end + 1 + size]
            at = end + size + 2
            target = tree / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            if header[0] == b'100755':
                target.chmod(0o755)
        # Discovery validates the images its committed manifests name. Fetch
        # only those tracked blobs, never the public asset tree or loose WIP.
        assets = set()
        def images(value):
            if isinstance(value, str) and value.startswith(('/src/', '/assets/')):
                path = value[1:] if value.startswith('/src/') else 'public' + value
                path = path.split('?', 1)[0]
                if not PurePosixPath(path).is_absolute() and '..' not in PurePosixPath(path).parts:
                    assets.add(path)
            elif isinstance(value, dict):
                for child in value.values():
                    images(child)
            elif isinstance(value, list):
                for child in value:
                    images(child)
        for manifest in (tree / 'src/shards').glob('*/manifest.json'):
            images(json.loads(manifest.read_text()))
        for manifest in (tree / 'src/shards').glob('*/outputs.json'):
            images(json.loads(manifest.read_text()))
        blobs = {name.decode(): header.split()[2] for header, name in
                 (row.split(b'\t', 1) for row in records)}
        for name in assets:
            if name in blobs and not (tree / name).exists():
                data = command(repo, ['git', 'cat-file', 'blob', blobs[name].decode()], deadline, capture_output=True).stdout
                target = tree / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        outputs(repo, tree, records, deadline, assets)
        cache = runpy.run_path(str(Path(__file__).with_name('push_input_cache.py')))
        cache['restore'](repo, tree, records, deadline)
        tools = tree / '.push-tools'
        tools.mkdir()
        for name in [*TOOLS, 'link-node-modules.mjs']:
            data = command(repo, ['git', 'show', tooling_revision + ':scripts/' + name], deadline,
                           capture_output=True).stdout
            (tools / name).write_bytes(data)
        command(tree, ['node', str(tools / 'link-node-modules.mjs'), str(repo), str(tree)], deadline)
        yield tree, tools
