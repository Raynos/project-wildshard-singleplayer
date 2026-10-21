"""Type-input cache from a completed exact-SHA build, bound to producer source blobs."""
import hashlib
import json
from pathlib import Path
import subprocess

INFRA = [ 'scripts/generate.mjs', 'scripts/generation-cache.mjs',
         'scripts/generation-inputs.mjs', 'scripts/generation-recorder.mjs',
         'scripts/shardfile-inputs.mjs', 'scripts/compiler-code.mjs', 'scripts/function-source.mjs',
         'scripts/generation-snapshot.mjs', 'scripts/generation-capture.mjs',
         'scripts/generation-sources.mjs', 'scripts/generation-inventory.mjs',
         'scripts/source-generation-outputs.json', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']


def identities(jobs, records):
    owners = {}
    by_id = {row['id']: row for row in jobs}
    for row in jobs:
        for output in row['outputs']:
            path = Path(output)
            for parent in [path, *path.parents]:
                owners.setdefault(str(parent), set()).add(row['id'])
    edges = {row['id']: set().union(*(owners.get(source, set()) for source in row['inputRoots'])) for row in jobs}
    named = [(record, record.split(b'\t', 1)[1].decode()) for record in records]
    keys = {}
    for job in jobs:
        pending, seen, roots = [job['id']], set(), set(INFRA)
        while pending:
            current = pending.pop()
            if current in seen:
                continue
            seen.add(current)
            roots.update(by_id[current]['inputRoots'])
            pending.extend(edges[current] - seen)
        # Literal JSON recipes declare their complete source closure; format
        # admission does not execute in that driver. Other producers retain
        # the conservative shared-format dependency.
        if any('src/sdk/bake/json.mjs' not in by_id[owner].get('command', []) for owner in seen):
            roots.add('src/format')
        prefixes = tuple(source + '/' for source in roots)
        selected = [record for record, name in named if name in roots or name.startswith(prefixes)]
        descriptors = [row for row in jobs if row['id'] in seen]
        keys[job['id']] = hashlib.sha256(json.dumps(descriptors, sort_keys=True).encode() + b'\0' + b'\0'.join(selected)).hexdigest()
    return keys


def publish(repo, revision, generated):
    """The caller supplies a successfully gated tree; refuse an unverified revision."""
    common = Path(subprocess.check_output(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=repo, text=True).strip())
    if not list((common / 'build-gate-g518').glob(revision + '-*')):
        raise ValueError('No successful exact-SHA full gate for cache seed')
    if (generated.parent / 'HEAD').read_text().split()[0] != revision:
        raise ValueError('Generated source revision differs from cache seed')
    records = [row for row in subprocess.check_output(['git', 'ls-tree', '-rz', revision], cwd=repo).split(b'\0') if row]
    jobs = json.loads(subprocess.check_output(['git', 'show', revision + ':scripts/generation-jobs.json'], cwd=repo))['jobs']
    tracked = {row.split(b'\t', 1)[1].decode() for row in records}
    cache = repo / 'tmp/push-input-cache'
    cache.mkdir(exist_ok=True)
    blobs = cache / 'blobs'
    blobs.mkdir(exist_ok=True)
    rows = []
    keys = identities(jobs, records)
    for job in jobs:
        files = {}
        for name in job['outputs']:
            path = generated / name
            if name not in tracked and name.startswith('src/') and path.suffix in ('.ts', '.json', '.mts') and path.is_file():
                data = path.read_bytes()
                digest = hashlib.sha256(data).hexdigest()
                target = blobs / digest
                if not target.exists():
                    target.write_bytes(data)
                files[name] = digest
        if files:
            rows.append({'id': job['id'], 'key': keys[job['id']], 'files': files})
    (cache / 'entries.json').write_text(json.dumps(rows))
    return sum(len(row['files']) for row in rows)


def restore(repo, tree, records, deadline):
    import time
    file = repo / 'tmp/push-input-cache/entries.json'
    registry = tree / 'scripts/generation-jobs.json'
    if not file.exists() or not registry.exists():
        return
    jobs = json.loads(registry.read_text())['jobs']
    by_id = {row['id']: row for row in jobs}
    keys = identities(jobs, records)
    for saved in json.loads(file.read_text()):
        if time.monotonic() >= deadline:
            raise TimeoutError('Type-input cache verification exceeded budget')
        job = by_id.get(saved['id'])
        if job is None or keys[job['id']] != saved['key']:
            continue
        for name, digest in saved['files'].items():
            if not name.startswith('src/') or '..' in Path(name).parts or name not in job['outputs']:
                raise ValueError('Invalid type-input cache path')
            path = tree / name
            if path.exists():
                continue
            data = (file.parent / 'blobs' / digest).read_bytes()
            if hashlib.sha256(data).hexdigest() != digest:
                raise ValueError('Corrupt type-input cache blob')
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
