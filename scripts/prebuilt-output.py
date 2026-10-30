#!/usr/bin/env python3
"""Ship the exact push build: source identity, full inventory and bounded extraction."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tempfile
import tarfile


def digest(stream):
    value = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        value.update(block)
    return value.hexdigest()


def file_hash(path):
    with path.open('rb') as stream:
        return digest(stream)


def identity(sha, run):
    if not re.fullmatch('[0-9a-f]{40}', sha) or not re.fullmatch('[0-9]+', run):
        raise ValueError('Invalid prebuilt source identity')


def safe(name):
    path = PurePosixPath(name)
    if str(path) != name or path.is_absolute() or '\\' in name or any(p in ('', '.', '..') for p in path.parts):
        raise ValueError('Invalid prebuilt path')
    if not (name.startswith('.vercel/output/') or name.startswith('dist/')):
        raise ValueError('Unexpected prebuilt root')
    return path


def collect(directory, ancestors=None):
    ancestors = set() if ancestors is None else ancestors
    target = directory.resolve(strict=True)
    if target in ancestors:
        raise ValueError('Cyclic prebuilt directory')
    for path in sorted(directory.iterdir()):
        if path.is_dir():
            yield from collect(path, ancestors | {target})
        elif path.is_file():
            yield path
        else:
            raise ValueError('Unsupported prebuilt entry')


def required(files, sha, root):
    names = {row['path'] for row in files}
    for name in ('.vercel/output/config.json', '.vercel/output/static/index.html',
                 '.vercel/output/static/sw.js', '.vercel/output/static/version.json',
                 '.vercel/output/functions/api/inbox.func/.vc-config.json',
                 '.vercel/output/functions/api/errors.func/.vc-config.json',
                 'dist/version.json', 'dist/.vite/chunk-modules.json'):
        if name not in names:
            raise ValueError('Incomplete prebuilt output: ' + name)
    version = json.loads((root / '.vercel/output/static/version.json').read_text())
    if not isinstance(version.get('build'), str) or not version['build'].startswith(sha[:9] + '-'):
        raise ValueError('Prebuilt version differs from source')
    if (root / 'dist/version.json').read_bytes() != (root / '.vercel/output/static/version.json').read_bytes():
        raise ValueError('Diagnostic version differs from prebuilt version')


def pack(root, directory, sha, run):
    identity(sha, run)
    directory.mkdir(parents=True, exist_ok=True)
    paths = list(collect(root / '.vercel/output'))
    paths += [p for p in collect(root / 'dist') if p.relative_to(root / 'dist').as_posix() in
              ('version.json', '.vite/chunk-modules.json') or re.search(r'\.map(?:\.(?:gz|br))?$', p.name)]
    files = [{'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size,
              'hash': file_hash(p), 'mode': p.stat().st_mode & 0o777} for p in paths]
    required(files, sha, root)
    archive = directory / 'prebuilt.tar'
    with tarfile.open(archive, 'w', dereference=True) as output:
        for path, row in zip(paths, files):
            safe(row['path'])
            output.add(path, arcname=row['path'], recursive=False)
    proof = {'version': 1, 'sha': sha, 'run': run, 'files': files,
             'archiveBytes': archive.stat().st_size, 'archiveHash': file_hash(archive)}
    compressed = directory / 'prebuilt.tar.zst'
    subprocess.run(['zstd', '-q', '-3', '-T2', '-f', str(archive), '-o', str(compressed)], check=True)
    proof['transport'] = {'bytes': compressed.stat().st_size, 'hash': file_hash(compressed)}
    (directory / 'proof.json').write_text(json.dumps(proof) + '\n')
    archive.unlink()


def restore(root, directory, sha, run):
    identity(sha, run)
    proof = json.loads((directory / 'proof.json').read_text())
    if proof['version'] != 1 or proof['sha'] != sha or proof['run'] != run:
        raise ValueError('Prebuilt source SHA/run differs')
    compressed = directory / 'prebuilt.tar.zst'
    if compressed.stat().st_size != proof['transport']['bytes'] or file_hash(compressed) != proof['transport']['hash']:
        raise ValueError('Prebuilt transport checksum differs')
    limit = proof['archiveBytes']
    if type(limit) is not int or limit <= 0:
        raise ValueError('Invalid prebuilt archive extent')
    with tempfile.TemporaryFile(dir=directory) as archive:
        decoder = subprocess.Popen(['zstd', '-q', '-dc', str(compressed)], stdout=subprocess.PIPE)
        size, value = 0, hashlib.sha256()
        try:
            for block in iter(lambda: decoder.stdout.read(min(1024 * 1024, limit - size + 1)), b''):
                size += len(block)
                if size > limit:
                    raise ValueError('Prebuilt archive exceeds proof')
                archive.write(block)
                value.update(block)
            if decoder.wait() != 0 or size != limit or value.hexdigest() != proof['archiveHash']:
                raise ValueError('Prebuilt archive checksum differs')
        finally:
            decoder.stdout.close()
            if decoder.poll() is None:
                decoder.kill()
            decoder.wait()
        archive.seek(0)
        extract(root, archive, proof, sha)


def extract(root, archive, proof, sha):
    rows = proof['files']
    names = [row['path'] for row in rows]
    if len(set(names)) != len(names):
        raise ValueError('Duplicate prebuilt inventory')
    # Validate the complete archive before writing anything. Links, devices,
    # extra/missing members and parent symlinks never reach extraction.
    with tarfile.open(fileobj=archive, mode='r:') as source:
        members = source.getmembers()
        if [member.name for member in members] != names:
            raise ValueError('Prebuilt inventory differs')
        for member, row in zip(members, rows):
            path = root / safe(member.name)
            if (not member.isfile() or member.size != row['bytes'] or member.mode != row['mode']
                    or not isinstance(row['bytes'], int) or row['bytes'] < 0):
                raise ValueError('Invalid prebuilt member')
            if path.exists() or path.is_symlink() or any(p.is_symlink() for p in path.parents):
                raise ValueError('Prebuilt destination already exists or links outside root')
            with source.extractfile(member) as stream:
                if digest(stream) != row['hash']:
                    raise ValueError('Prebuilt member hash differs')
        for member, row in zip(members, rows):
            path = root / member.name
            path.parent.mkdir(parents=True, exist_ok=True)
            with source.extractfile(member) as stream, path.open('xb') as target:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    target.write(block)
            path.chmod(row['mode'])
    required(rows, sha, root)
    print(json.dumps({'sha': sha, 'run': proof['run'], 'files': len(rows), 'archiveHash': proof['archiveHash']}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=('pack', 'restore'))
    parser.add_argument('--sha', required=True)
    parser.add_argument('--run', required=True)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--directory', type=Path, default=Path('prebuilt-output'))
    args = parser.parse_args()
    globals()[args.command](args.root, args.directory, args.sha, args.run)


if __name__ == '__main__':
    main()
