"""Disposable committed source inputs, without a worktree, archive, mirror or build."""
import contextlib
import hashlib
import json
import os
import runpy
import re
from pathlib import Path, PurePosixPath
import subprocess
import tempfile
import time

TEXT = {'.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json', '.jsonc',
        '.yaml', '.yml', '.css', '.glsl', '.frag', '.vert', '.wgsl', '.as', '.py', '.sh', '.md', '.html'}
ROOTS = {'src', 'scripts', 'test', 'lint', 'vite', 'admin', 'api', 'drafts', 'site', 'docs', 'budgets', '.githooks', '.github'}
FAST_LINT_TOOLS = ['lint-fast.mjs', 'precommit-checks.mjs', 'guard-counts.mjs', 'guard-index-tree.mjs',
                   'push-lint-config.mjs', 'ratchet-approval.mjs', 'legacy-shards.mjs']
TOOLS = ['gate-related-tests.mjs', 'push-inputs.mjs', 'push-checks.mjs', 'test-products.json', *FAST_LINT_TOOLS]
RUNTIME_TOOLS = ['runtime_input_copies.py', 'copied-runtime-inputs.json']
CONFIGS = ['vitest-push.config.ts', 'vitest-push-guards.config.ts']


def source_file(name):
    path = PurePosixPath(name)
    return not path.is_absolute() and '..' not in path.parts and (
        len(path.parts) == 1 or path.parts[0] in ROOTS) and (path.suffix in TEXT or len(path.parts) == 1)


def command(root, args, deadline, **options):
    timeout = None if deadline == float('inf') else max(.01, deadline - time.monotonic())
    return subprocess.run(args, cwd=root, check=True, timeout=timeout, **options)


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


def missing_generated(tree):
    """A verified cache can still omit post-generation discovery/type tables."""
    imports = re.compile(r"""(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)["'](\.[^"'\n]*\.generated[^"'\n]*)["']""")
    missing = set()
    for path in (tree / 'src').rglob('*'):
        if path.suffix not in {'.ts', '.tsx', '.mts', '.js', '.mjs'}:
            continue
        for name in imports.findall(path.read_text()):
            target = path.parent / name
            candidates = [target, *(Path(str(target) + suffix) for suffix in ('.ts', '.tsx', '.mts', '.d.ts', '.js', '.mjs'))]
            if not any(candidate.is_file() for candidate in candidates):
                missing.add(os.path.relpath(target, tree))
    return sorted(missing)


@contextlib.contextmanager
def committed_source(repo, revision, tooling_revision, deadline):
    folder = repo / 'tmp'
    folder.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='push-source-', dir=folder) as temporary:
        tree = Path(temporary).resolve()
        listed = command(repo, ['git', 'ls-tree', '-rz', revision], deadline, capture_output=True).stdout
        records = [row for row in listed.split(b'\0') if row]
        entries = [row.split(b'\t', 1) for row in records]
        entries = [(header.split(), name.decode()) for header, name in entries if source_file(name.decode())
                   or name.startswith(b'test/fixtures/')]
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
        assets = set()
        # Fixtures import only a small set of literal public JSON tables.
        for _, name in entries:
            if not re.search(r'\.[cm]?[jt]sx?$', name):
                continue
            for reference in re.findall(r'''(?:from\s+|import\s*\(\s*)["']([^"']+\.json)["']''', (tree / name).read_text()):
                target = os.path.normpath(str(PurePosixPath(name).parent / reference))
                if target.startswith('public/') and '..' not in PurePosixPath(target).parts:
                    assets.add(target)
        blobs = {name.decode(): header.split()[2] for header, name in
                 (row.split(b'\t', 1) for row in records)
                 if header.split()[1] == b'blob' and header.split()[0] in (b'100644', b'100755')}
        for name in assets:
            if name in blobs and not (tree / name).exists():
                data = command(repo, ['git', 'cat-file', 'blob', blobs[name].decode()], deadline, capture_output=True).stdout
                target = tree / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        outputs(repo, tree, records, deadline, assets)
        cache = runpy.run_path(str(Path(__file__).with_name('push_input_cache.py')))
        input_deadline = min(deadline, time.monotonic() + 8)
        available = cache['restore'](repo, tree, records, input_deadline)
        available = available and not missing_generated(tree)
        test_revision = cache['restore_tests'](repo, tree, records, input_deadline)
        # Runtime setup has two explicit disk preloads plus native physics.
        # Supply tracked bytes from Git, never from the shared working tree.
        bootstrap = {'public/assets/nalati/baked/places.bin', 'public/assets/physics/rapier.wasm'}
        species = tree / 'src/shards/nalati-grasslands/data/species.generated.json'
        if species.exists():
            packed = json.loads(species.read_text()).get('packedBodies', {}).get('file')
            if isinstance(packed, str) and packed.startswith('/assets/') and '..' not in PurePosixPath(packed).parts:
                bootstrap.add('public' + packed)
        for name in bootstrap:
            if name in blobs and not (tree / name).exists():
                data = command(repo, ['git', 'cat-file', 'blob', blobs[name].decode()], deadline, capture_output=True).stdout
                target = tree / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        # Build-copied assets are neither Git blobs nor generated source imports.
        # Read the copier and manifest from immutable gate tooling, including
        # when checking an older prefix that predates this gate repair.
        runtime_tools = {}
        for name in RUNTIME_TOOLS:
            runtime_tools[name] = command(repo, ['git', 'show', tooling_revision + ':scripts/' + name],
                                          deadline, capture_output=True).stdout
        copier_path = tree / '.push-runtime-copies.py'
        copier_path.write_bytes(runtime_tools['runtime_input_copies.py'])
        copied = runpy.run_path(str(copier_path))['restore_runtime_inputs'](
            repo, tree, json.loads(runtime_tools['copied-runtime-inputs.json']), deadline)
        print('push-source: restored %d content-verified copied runtime inputs' % copied, flush=True)
        tests_available = test_revision is not None
        # Native tests also read tracked files through fs/new URL rather than
        # module imports. Only exact literal matches in the tip's Git inventory
        # are materialised; loose working bytes and unrelated assets stay out.
        imported_assets = set()
        for folder in ['src', 'test', 'admin', 'drafts', 'scripts', 'vite', 'api']:
            for path in (tree / folder).rglob('*'):
                if path.suffix not in {'.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.py', '.sh'}:
                    continue
                for value in re.findall(r"""["'`]([^"'`\r\n]+)["'`]""", path.read_text()):
                    if '${' in value or '/' not in value:
                        continue
                    value = value.split('?', 1)[0]
                    candidates = {value, os.path.normpath(str(path.relative_to(tree).parent / value))}
                    if value.startswith('/src/'):
                        candidates.add(value[1:])
                    elif value.startswith('/assets/'):
                        candidates.add('public' + value)
                    imported_assets.update(name for name in candidates if name in blobs)
        for name in imported_assets:
            if name in blobs and (not source_file(name) or not (tree / name).exists()):
                data = command(repo, ['git', 'cat-file', 'blob', blobs[name].decode()], deadline, capture_output=True).stdout
                target = tree / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        (tree / '.push-tracked.json').write_text(json.dumps(list(blobs)))
        (tree / '.push-types.json').write_text(json.dumps({
            'available': available, 'testsAvailable': tests_available, 'testRevision': test_revision}))
        tools = tree / '.push-tools'
        tools.mkdir()
        for name in [*TOOLS, 'link-node-modules.mjs']:
            data = command(repo, ['git', 'show', tooling_revision + ':scripts/' + name], deadline,
                           capture_output=True).stdout
            (tools / name).write_bytes(data)
        for name in CONFIGS:
            data = command(repo, ['git', 'show', tooling_revision + ':scripts/' + name], deadline,
                           capture_output=True).stdout
            (tree / 'scripts' / name).write_bytes(data)
        command(tree, ['node', str(tools / 'link-node-modules.mjs'), str(repo), str(tree)], deadline)
        yield tree, tools
