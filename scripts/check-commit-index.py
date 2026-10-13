#!/usr/bin/env python3
"""Refuse stale staged trees that undo another lane's committed paths."""
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys


def git(*args):
    return subprocess.check_output(['git', '--literal-pathspecs', *args],
                                   timeout=15)


def changes(raw):
    """Read exact mode/blob pairs and literal paths from Git's NUL output."""
    fields = raw.split(b'\0')
    index = 0
    while index < len(fields) - 1:
        header = fields[index].lstrip(b'\n')
        if not header:
            index += 1
            continue
        if not header.startswith(b':'):
            raise ValueError('Unreadable staged/history raw header')
        parts = header[1:].split()
        if len(parts) != 5:
            raise ValueError('Unreadable staged/history raw record')
        yield fields[index + 1], (parts[0], parts[2]), (parts[1], parts[3])
        index += 2


def main():
    probe = subprocess.run(['git', 'rev-parse', '--verify', 'HEAD'],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           timeout=15)
    if probe.returncode:
        # Only a genuinely unborn branch may have no HEAD.
        git('symbolic-ref', 'HEAD')
        if git('for-each-ref', '--format=%(objectname)', 'refs/heads/'):
            raise ValueError('Cannot resolve the current commit')
        return
    head = probe.stdout.decode().strip()
    staged = list(changes(git('diff-index', '--cached', '--raw', '-z',
                              '--no-abbrev', '--no-renames', head)))
    if not staged:
        return
    declaration = os.environ.get('WS_COMMIT_INTENT')
    if declaration is not None:
        intent = json.loads(declaration)
        if not isinstance(intent, dict) or intent.get('base') != head:
            raise ValueError('Declared commit parent moved; rebuild the private '
                             'index from current HEAD and retry by CAS')
        paths = intent.get('paths')
        if (not isinstance(paths, list) or not paths
                or any(not isinstance(path, str) or not path
                       or PurePosixPath(path).is_absolute()
                       or '..' in PurePosixPath(path).parts for path in paths)
                or len(set(paths)) != len(paths)):
            raise ValueError('Commit intent needs unique literal relative paths')
        allowed = {os.fsencode(path) for path in paths}
        foreign = [os.fsdecode(path) for path, _, _ in staged if path not in allowed]
        if foreign:
            # G367 adds only exact producer outputs after the original source
            # intent. A full-tree/parent receipt never admits foreign source.
            tree = git('write-tree').decode().strip()
            receipt = subprocess.run(
                ['node', str(Path(__file__).with_name('commit-produced.mjs')),
                 '--verify-extra', tree, json.dumps(foreign)],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
            if receipt.returncode:
                raise ValueError('Staged paths outside declared commit intent: '
                                 + ', '.join(foreign))
        return
    # Git constructs a pathspec commit's next-index from its captured parent
    # and owns the ref CAS. Comparing that snapshot with a HEAD that moved
    # while the hook waited incorrectly labels unchanged paths as rollbacks.
    # Only Git's own PID-named index gets this treatment; ordinary private
    # indexes still need the ancestor/intent checks below.
    owner = int(sys.argv[1]) if len(sys.argv) > 1 else os.getppid()
    index = os.environ.get('GIT_INDEX_FILE')
    if index is not None:
        actual = Path(index).resolve()
        gitdir = Path(git('rev-parse', '--absolute-git-dir').decode().strip())
        if actual == gitdir / f'next-index-{owner}.lock':
            process = subprocess.run(['ps', '-p', str(owner), '-o', 'comm='],
                                     stdout=subprocess.PIPE, text=True, timeout=5)
            if process.returncode == 0 and Path(process.stdout.strip()).name == 'git':
                return
    paths = [os.fsdecode(path) for path, _, _ in staged]
    # The shared branch is linear. Every old first-parent state is evidence
    # that a private snapshot could restore an earlier lane's bytes or mode.
    previous = {}
    for path, before, _ in changes(git('log', '--first-parent', '--raw', '-z',
                                       '--no-abbrev', '--no-renames', '--format=',
                                       head, '--', *paths)):
        previous.setdefault(path, set()).add(before)
    suspects = [os.fsdecode(path) for path, _, after in staged
                if after in previous.get(path, set())]
    if suspects:
        raise ValueError('Staged tree restores ancestor bytes/modes on: '
                         + ', '.join(suspects)
                         + '. Rebuild a private index from current HEAD with '
                         'only your paths, then commit-tree and CAS. For a '
                         'deliberate rollback declare WS_COMMIT_INTENT with '
                         'the exact base SHA and literal intended paths.')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f'BLOCKED by commit-index: {error}', file=sys.stderr)
        sys.exit(1)
