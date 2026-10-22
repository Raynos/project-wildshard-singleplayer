"""Source type tables from a completed generation phase, never from loose WIP."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time


def source_key(records, roots):
    exact, prefixes = set(roots), tuple(root + '/' for root in roots)
    selected = [row for row in records if row.split(b'\t', 1)[1].decode() in exact or
                row.split(b'\t', 1)[1].decode().startswith(prefixes)]
    return hashlib.sha256(b'\0'.join(selected)).hexdigest()


def phase_outputs(repo, revision, generated, records, deadline=None):
    """Read a completed generation phase only when its inputs match Git blobs."""
    phase = generated / '.cache/generation-phase.json'
    saved = json.loads(phase.read_text())
    seal = saved.pop('seal')
    text = json.dumps(saved, ensure_ascii=False, separators=(',', ':'))
    if hashlib.sha256(text.encode()).hexdigest() != seal or saved['root'] != str(generated):
        raise ValueError('Invalid generation phase cache')
    tracked = {row.split(b'\t', 1)[1].decode(): row.split(b'\t', 1)[0].split()[2] for row in records}
    registered = json.loads(subprocess.check_output(['git', 'show', revision + ':scripts/generation-jobs.json'], cwd=repo)) if 'scripts/generation-jobs.json' in tracked else {'jobs': []}
    declared = {name for job in registered['jobs'] for name in job['outputs']}
    if 'scripts/source-generation-outputs.json' in tracked:
        source = json.loads(subprocess.check_output(['git', 'show', revision + ':scripts/source-generation-outputs.json'], cwd=repo))
        declared.update(name for rows in source['producers'].values() for name in rows)
    pre_tables = {'src/game/bag/starter.generated.ts', 'src/game/systems/effects/starter.generated.ts',
                  'src/game/systems/viewmodel/clips.generated.ts', 'src/game/weapons/starter.generated.ts'}
    for folder, inventory in saved['trees'].items():
        actual = {name for name in tracked if name.startswith(folder + '/')}
        omitted = actual - set(inventory)
        if any(not (name.startswith('src/') and '.generated.' in name and name not in declared and
                    not name.endswith('/ktx2.generated.ts') and name not in pre_tables) for name in omitted):
            raise ValueError('Generation phase source inventory differs: ' + folder)
    files = [name for name in saved['inputs'] if name in tracked and name not in saved['outputs']]
    raw = subprocess.check_output(['git', 'cat-file', '--batch'], cwd=repo,
                                  input=b''.join(tracked[name] + b'\n' for name in files),
                                  timeout=None if deadline is None else max(.01, deadline - time.monotonic()))
    at = 0
    for name in files:
        end = raw.index(b'\n', at)
        size = int(raw[at:end].split()[2])
        data = raw[end + 1:end + 1 + size]
        at = end + size + 2
        if hashlib.sha256(data).hexdigest() != saved['inputs'][name]:
            raise ValueError('Generation phase source differs from commit: ' + name)
    tables = {}
    for name, digest in saved['inputs'].items():
        if name in tracked and name not in saved['outputs']:
            continue
        post_table = name in {'src/game/bag/starter.generated.ts', 'src/game/systems/effects/starter.generated.ts',
                              'src/game/systems/viewmodel/clips.generated.ts', 'src/game/weapons/starter.generated.ts'} or (
            name.startswith('src/shards/') and (name.endswith('/.wildshard/build-policy.json') or name.endswith('/discovery.generated.ts')))
        if name not in saved['outputs'] and not post_table:
            raise ValueError('Undeclared generation phase input: ' + name)
        if hashlib.sha256((generated / name).read_bytes()).hexdigest() != digest:
            raise ValueError('Generation phase input changed: ' + name)
        if post_table:
            tables[name] = digest
    if (generated.parent / 'HEAD').read_text().split()[0] != revision:
        raise ValueError('Generation phase moved while reading')
    return {**saved['outputs'], **tables}


def phase_roots(generated):
    saved = json.loads((generated / '.cache/generation-phase.json').read_text())
    folders = set(saved['trees'])
    files = {name for name in saved['inputs'] if not name.startswith(tuple(folder + '/' for folder in folders))}
    return sorted(files | folders | {'scripts/generation-jobs.json'})


def publish(repo, revision, generated, deadline=None):
    """Only an immutable phase with committed inputs can seed the type cache."""
    records = [row for row in subprocess.check_output(['git', 'ls-tree', '-rz', revision], cwd=repo).split(b'\0') if row]
    phase = generated / '.cache/generation-phase.json'
    phase_bytes = phase.read_bytes()
    verified = phase_outputs(repo, revision, generated, records, deadline)
    roots = phase_roots(generated)
    tracked = {row.split(b'\t', 1)[1].decode() for row in records}
    cache = repo / 'tmp/push-input-cache'
    blobs = cache / 'blobs'
    blobs.mkdir(parents=True, exist_ok=True)
    files = {}
    for name, expected in verified.items():
        if deadline is not None and time.monotonic() >= deadline:
            raise TimeoutError('Type-input cache publication exceeded budget')
        path = generated / name
        if name in tracked or not name.startswith('src/') or path.suffix not in ('.ts', '.mts', '.json'):
            continue
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('Generation phase output changed: ' + name)
        target = blobs / expected
        if not target.exists():
            target.write_bytes(data)
        files[name] = expected
    # Re-read the marker after all input/output reads; a moving phase refuses.
    if (generated.parent / 'HEAD').read_text().split()[0] != revision or phase.read_bytes() != phase_bytes:
        raise ValueError('Generation phase moved while publishing')
    saved = {'schema': 'push-type-inputs/3', 'revision': revision, 'roots': roots,
             'key': source_key(records, roots), 'files': files}
    temporary = cache / ('entries.' + str(os.getpid()) + '.tmp')
    temporary.write_text(json.dumps(saved))
    temporary.replace(cache / 'entries.json')
    return len(files)


def restore(repo, tree, records, deadline):
    """A miss never supplies old declarations or runs a producer."""
    file = repo / 'tmp/push-input-cache/entries.json'
    deadline = min(deadline, time.monotonic() + 8)
    def matches(saved):
        try:
            return isinstance(saved, dict) and saved.get('schema') == 'push-type-inputs/3' and source_key(records, saved['roots']) == saved['key']
        except (KeyError, TypeError):
            return False
    try:
        saved = json.loads(file.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        saved = None
    if not matches(saved):
        # Read completed cache metadata only. No mirror process, generation,
        # build, producer or mutable working-tree output is run or copied.
        phases = list((repo / 'tmp/build-mirror').glob('*/tree/.cache/generation-phase.json'))
        phases.sort(key=lambda path: path.stat().st_mtime, reverse=True)
        for phase in phases:
            if time.monotonic() >= deadline:
                return False
            generated = phase.parent.parent
            try:
                revision = (generated.parent / 'HEAD').read_text().split()[0]
                baseline = [row for row in subprocess.check_output(['git', 'ls-tree', '-rz', revision], cwd=repo, timeout=max(.01, deadline - time.monotonic())).split(b'\0') if row]
                roots = phase_roots(generated)
                if source_key(records, roots) != source_key(baseline, roots):
                    continue
                publish(repo, revision, generated, deadline)
                saved = json.loads(file.read_text())
                break
            except (ValueError, OSError, KeyError, TypeError):
                continue
            except (TimeoutError, subprocess.TimeoutExpired):
                return False
    if not matches(saved):
        return False
    try:
        for name, digest in saved['files'].items():
            if time.monotonic() >= deadline:
                raise TimeoutError('Type-input cache verification exceeded budget')
            if not name.startswith('src/') or '..' in Path(name).parts:
                raise ValueError('Invalid type-input cache path')
            path = tree / name
            if path.exists():
                continue
            data = (file.parent / 'blobs' / digest).read_bytes()
            if hashlib.sha256(data).hexdigest() != digest:
                raise ValueError('Corrupt type-input cache blob')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        return True
    except (OSError, KeyError, ValueError, TypeError):
        return False
