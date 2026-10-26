#!/usr/bin/env python3
"""Partition exact push dist bytes; verify identity before restoring one smoke leg."""
import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath
import tarfile
import time

PARTS = ('boot-public', 'boot-developer', 'boot-grid', 'hover-chromium', 'hover-webkit', 'explorer', 'phone-route')
ALIASES = {'nalati': 'nalati-grasslands', 'nine-dragon': 'nine-dragon-stack'}


def digest(path):
    with path.open('rb') as stream:
        return stream_digest(stream)


def stream_digest(stream):
    result = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        result.update(block)
    return result.hexdigest()


def safe(name):
    path = PurePosixPath(name)
    if not name or path.is_absolute() or str(path) != name or any(p in ('', '.', '..') for p in path.parts) or '\\' in name:
        raise ValueError('Invalid dist path: ' + name)
    return name


def owner(name, slugs):
    parts = PurePosixPath(name).parts
    if parts[0] == 'shardfiles':
        return parts[1] if len(parts) > 2 else None
    # Only explicit shard-owned path components are partitioned. Ambiguous/shared
    # assets, all compiled modules/maps and the complete shell remain in every leg.
    for component in parts[1:-1]:
        slug = ALIASES.get(component, component)
        if slug in slugs:
            return slug
    if len(parts) == 3 and parts[:2] == ('assets', 'packs'):
        slug = parts[-1].split('.')[0]
        if slug in slugs:
            return slug
    return None


def pack(dist, output, plan, sha, run):
    started = time.monotonic()
    if re.fullmatch('[a-f0-9]{40}', sha) is None or re.fullmatch('[0-9]+', run) is None:
        raise ValueError('Invalid source SHA/run')
    if set(plan) != {*PARTS, 'shared'} or not all(isinstance(plan[p], list) and plan[p] for p in PARTS):
        raise ValueError('Incomplete smoke-leg plan')
    slugs = set().union(*[set(plan[p]) for p in PARTS])
    files = []
    # Historical content-addressed packs accumulate in public/. Only literal pack
    # URLs in this exact emitted JS/JSON bank can be requested by its generated
    # tables. Boot tables are external JSON, so JS-only scanning loses live packs.
    packs = set()
    for suffix in ('*.js', '*.json'):
        for module in (dist / 'assets').glob(suffix):
            packs.update(re.findall(r'/assets/packs/([a-zA-Z0-9_.-]+\.bin)', module.read_text()))
    for path in sorted(dist.rglob('*')):
        if path.is_symlink():
            raise ValueError('Dist symlink refused')
        if path.is_file():
            name = safe(path.relative_to(dist).as_posix())
            if name.startswith('assets/packs/') and path.name not in packs:
                continue
            files.append({'path': name, 'bytes': path.stat().st_size, 'hash': digest(path)})
    if not {'index.html', 'version.json'}.issubset({row['path'] for row in files}):
        raise ValueError('Missing dist shell')
    version = json.loads((dist / 'version.json').read_text())
    prefix = version['build'].split('-')[0]
    if re.fullmatch('[a-f0-9]{7,40}', prefix) is None or not sha.startswith(prefix):
        raise ValueError('Dist version differs from source SHA')
    output.mkdir(parents=True, exist_ok=True)
    inventory = {'sha': sha, 'run': run, 'version': version, 'legs': {}}
    groups = [('boot-public', ['boot-public']), ('boot-developer', ['boot-developer']),
              ('worlds', ['boot-grid', 'hover-chromium', 'hover-webkit', 'explorer']),
              ('phone-route', ['phone-route'])]
    for artifact, parts in groups:
        part = parts[0]
        if any(set(plan[p]) != set(plan[part]) for p in parts):
            raise ValueError('Shared world legs differ; require a distinct artifact')
        selected = [row for row in files if owner(row['path'], slugs) in (None, *plan[part])
                    or row['path'] in plan['shared']]
        directory = output / artifact
        directory.mkdir()
        archive = directory / 'boot-dist.tar'
        with tarfile.open(archive, 'w') as tar:
            for row in selected:
                tar.add(dist / row['path'], arcname=row['path'], recursive=False)
        proof = {'sha': sha, 'run': run, 'parts': parts, 'shards': sorted(plan[part]), 'version': version,
                 'archiveHash': digest(archive), 'archiveBytes': archive.stat().st_size, 'files': selected}
        (directory / 'boot-dist-proof.json').write_text(json.dumps(proof, separators=(',', ':')) + '\n')
        for name in parts:
            inventory['legs'][name] = {key: proof[key] for key in ('archiveHash', 'archiveBytes', 'shards')}
            inventory['legs'][name]['artifact'] = artifact
            print(f'boot-dist {name}: {len(selected)} files, {sum(row["bytes"] for row in selected)} served bytes, {archive.stat().st_size} tar bytes')
    (output / 'boot-dist-manifest.json').write_text(json.dumps(inventory, separators=(',', ':')) + '\n')
    print(f'boot-dist pack seconds: {time.monotonic() - started:.3f}')


def restore(directory, target, manifest, sha, run, part):
    started = time.monotonic()
    if re.fullmatch('[a-f0-9]{40}', sha) is None or re.fullmatch('[0-9]+', run) is None or part not in PARTS:
        raise ValueError('Invalid source SHA/run/leg')
    proof = json.loads((directory / 'boot-dist-proof.json').read_text())
    if manifest['sha'] != sha or manifest['run'] != run or proof['sha'] != sha or proof['run'] != run or part not in proof['parts']:
        raise ValueError('Dist SHA/run/leg differs')
    leg = manifest['legs'][part]
    if any(proof[key] != leg[key] for key in ('archiveHash', 'archiveBytes', 'shards')) or proof['version'] != manifest['version']:
        raise ValueError('Dist source inventory differs')
    archive = directory / 'boot-dist.tar'
    if archive.stat().st_size != proof['archiveBytes'] or digest(archive) != proof['archiveHash']:
        raise ValueError('Dist archive checksum differs')
    expected = {safe(row['path']): row for row in proof['files']}
    if len(expected) != len(proof['files']):
        raise ValueError('Duplicate dist inventory')
    if target.exists():
        raise ValueError('Dist target must be absent')
    # Validate every member before writing any file. No symlink, extra, duplicate,
    # traversal or altered byte can enter the served tree.
    with tarfile.open(archive) as tar:
        members = tar.getmembers()
        if len(members) != len(expected) or {safe(row.name) for row in members} != set(expected):
            raise ValueError('Dist archive inventory differs')
        for member in members:
            if not member.isfile() or member.size != expected[member.name]['bytes']:
                raise ValueError('Dist member type/size differs')
            stream = tar.extractfile(member)
            if stream is None or stream_digest(stream) != expected[member.name]['hash']:
                raise ValueError('Dist member checksum differs')
        target.mkdir(parents=True)
        for member in members:
            path = target / member.name
            path.parent.mkdir(parents=True, exist_ok=True)
            stream = tar.extractfile(member)
            if stream is None:
                raise ValueError('Missing verified member')
            with path.open('wb') as output:
                import shutil
                shutil.copyfileobj(stream, output)
    if json.loads((target / 'version.json').read_text()) != manifest['version']:
        raise ValueError('Restored version differs')
    print(f'boot-dist restore {part}: {archive.stat().st_size} bytes, {time.monotonic() - started:.3f} seconds')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=('pack', 'restore'))
    parser.add_argument('--sha', required=True)
    parser.add_argument('--run', required=True)
    parser.add_argument('--dist', default='dist')
    parser.add_argument('--artifacts', default='boot-dist-parts')
    parser.add_argument('--plan', default='boot-dist-plan.json')
    parser.add_argument('--manifest', default='boot-dist-manifest.json')
    parser.add_argument('--part', choices=PARTS)
    args = parser.parse_args()
    if args.command == 'pack':
        pack(Path(args.dist), Path(args.artifacts), json.loads(Path(args.plan).read_text()), args.sha, args.run)
    else:
        restore(Path(args.artifacts), Path(args.dist), json.loads(Path(args.manifest).read_text()), args.sha, args.run, args.part)
