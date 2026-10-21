#!/usr/bin/env python3
"""Transfer one CI run's generated inputs and products to its behaviour jobs."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile

ARCHIVE = 'test-products.tar'
PROOF = 'test-products-proof.json'
GENERATED_ROOTS = ['src', 'public', 'out', 'docs/api', 'lint']
EXCLUDED = {'.git', 'node_modules', '.cache', '__pycache__'}


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def identity(root):
    sha, run = os.environ['GITHUB_SHA'], os.environ['GITHUB_RUN_ID']
    if git(root, 'rev-parse', 'HEAD').decode().strip() != sha:
        raise ValueError('Checkout does not match the CI SHA')
    return sha, run


def admitted_path(name):
    path = PurePosixPath(name)
    if (not name or path.is_absolute() or '..' in path.parts
            or any(part in EXCLUDED or part.startswith('.env') for part in path.parts)
            or path.parts[0] not in {'src', 'public', 'out', 'docs', 'lint', 'scripts', 'test', 'api', 'admin', 'drafts'}):
        raise ValueError('Unexpected prepared output path: ' + name)
    return path


def digest(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def catalogue_outputs(root):
    jobs = json.loads((root / 'scripts/generation-jobs.json').read_text())['jobs']
    declared, required = set(), set()
    for job in jobs:
        build = set(job.get('buildOutputs', {})) | set(job.get('buildTimeOutputs', []))
        declared.update(job['outputs'])
        declared.update(build)
        required.update(build)
    return declared, required


def pack(root):
    sha, run = identity(root)
    declared, required = catalogue_outputs(root)
    missing = sorted(name for name in required if not (root / admitted_path(name)).is_file())
    if missing:
        raise ValueError('Missing prepared catalogue outputs: ' + ', '.join(missing))
    ignored = git(root, 'ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', *GENERATED_ROOTS)
    untracked = git(root, 'ls-files', '--others', '--exclude-standard', '-z', '--', *GENERATED_ROOTS)
    modified = git(root, 'diff', '--name-only', '-z', '--diff-filter=AM')
    # Catalogue rows include retained and freshly emitted hashes regardless of
    # their gitignore status. The Git walk adds gen's tables, product outputs,
    # and build policy (.wildshard/build-policy.json) outside that catalogue.
    files = sorted({name for name in declared if (root / admitted_path(name)).is_file()}
                   | {os.fsdecode(name) for name in (ignored + untracked + modified).split(b'\0') if name})
    files = [name for name in files if not any(part in EXCLUDED for part in PurePosixPath(name).parts)]
    if not any(name.startswith('out/') and name.endswith('/shard.json') for name in files):
        raise ValueError('No prepared products to publish')
    with tarfile.open(root / ARCHIVE, 'w') as archive:
        for name in files:
            path = root / admitted_path(name)
            if not path.is_file() or path.is_symlink():
                raise ValueError('Prepared output is not a regular file: ' + name)
            archive.add(path, arcname=name, recursive=False)
    proof = {'sha': sha, 'run': run, 'sha256': digest(root / ARCHIVE), 'files': len(files)}
    (root / PROOF).write_text(json.dumps(proof) + '\n')
    print(f'Published {len(files)} prepared files for {sha} in run {run}')


def unpack(root):
    sha, run = identity(root)
    proof = json.loads((root / PROOF).read_text())
    if proof['sha'] != sha or proof['run'] != run:
        raise ValueError('Prepared products belong to a different SHA or CI run')
    if proof['sha256'] != digest(root / ARCHIVE):
        raise ValueError('Prepared products checksum mismatch')
    with tarfile.open(root / ARCHIVE, 'r') as archive:
        members = archive.getmembers()
        names = [member.name for member in members]
        if len(names) != proof['files'] or len(set(names)) != len(names):
            raise ValueError('Prepared output inventory mismatch')
        _, required = catalogue_outputs(root)
        if not required.issubset(names):
            raise ValueError('Prepared catalogue outputs are missing from the archive')
        if not any(name.startswith('out/') and name.endswith('/shard.json') for name in names):
            raise ValueError('Prepared products are missing')
        # Validate the entire inventory before writing any file. Never follow a
        # workspace symlink, even when the archive itself has no link members.
        for member in members:
            path = root / admitted_path(member.name)
            if not member.isfile() or path.is_symlink() or root.resolve() not in path.resolve().parents:
                raise ValueError('Unsafe prepared output: ' + member.name)
        for member in members:
            path = root / member.name
            path.parent.mkdir(parents=True, exist_ok=True)
            stream = archive.extractfile(member)
            if stream is None:
                raise ValueError('Missing prepared file: ' + member.name)
            with stream, path.open('wb') as destination:
                shutil.copyfileobj(stream, destination)
            path.chmod(member.mode & 0o777)
    print(f'Restored {len(members)} verified prepared files for {sha} in run {run}')


if __name__ == '__main__':
    {'pack': pack, 'unpack': unpack}[sys.argv[1]](Path.cwd())
