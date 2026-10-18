#!/usr/bin/env python3
"""Normalize Git segments; exempt only narrow operations on private indexes.

This is a classifier, never a shell evaluator. Unresolved substitutions refuse
private-index recognition. The existing guard still owns all staging rules.
"""
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys


ASSIGNMENT = re.compile(r'^([A-Za-z_][A-Za-z_0-9]*)=(.*)$', re.S)

def private_index(value):
    if not value or not Path(value).is_absolute() or Path(value).name == 'index':
        return False
    # Clear the candidate override when asking Git for its real shared index.
    env = dict(os.environ)
    env.pop('GIT_INDEX_FILE', None)
    result = subprocess.run(['git', 'rev-parse', '--path-format=absolute', '--git-path', 'index'],
                            env=env, text=True, capture_output=True, check=False)
    if result.returncode != 0:
        return False
    shared, candidate = Path(result.stdout.strip()), Path(value)
    actual = candidate.resolve()
    reserved = [shared.resolve(), shared.with_name(shared.name + '.lock').resolve()]
    if actual in reserved or actual.parent == shared.parent and actual.name.startswith('next-index-'):
        return False
    try:
        for path in reserved:
            if candidate.exists() and path.exists() and candidate.samefile(path):
                return False
    except OSError:
        return False
    return True


def normalize(command):
    lexer = shlex.shlex(command, posix=True, punctuation_chars=';&|\n')
    lexer.whitespace = ' \t\r'
    lexer.whitespace_split = True
    lexer.commenters = '#'
    try:
        tokens = list(lexer)
    except ValueError:
        return command  # malformed quoting never creates a private exemption
    variables = dict(os.environ)
    segments, segment = [], []
    for token in [*tokens, ';']:
        if token and all(char in ';&|\n' for char in token):
            if segment:
                local = dict(variables)
                if segments:
                    # Earlier shell code may unset the inherited override.
                    local.pop('GIT_INDEX_FILE', None)
                parts = list(segment)
                exporting = parts[0] == 'export'
                if exporting:
                    parts.pop(0)
                if parts and parts[0] == 'env':
                    parts.pop(0)
                    if parts[:2] == ['-u', 'GIT_INDEX_FILE']:
                        local.pop('GIT_INDEX_FILE', None)
                        del parts[:2]
                while parts:
                    assignment = ASSIGNMENT.fullmatch(parts[0])
                    if assignment is None:
                        break
                    value = assignment[2]
                    if any(char in value for char in '$`'):
                        local.pop(assignment[1], None)
                    else:
                        local[assignment[1]] = value
                    parts.pop(0)
                if parts and parts[0] == 'git':
                    # Normalize assignment-prefixed shared operations too: a
                    # prefix must never hide a shared-index add or bare commit.
                    operation = parts[1] if len(parts) > 1 else ''
                    flags = [part for part in parts[2:] if part.startswith('-')]
                    bulk_add = any(flag in ('--all', '--update') or
                                   flag.startswith('-') and not flag.startswith('--') and
                                   any(char in flag[1:] for char in 'Au') for flag in flags)
                    bulk_add = bulk_add or any(part in ('.', ':/') for part in parts[2:])
                    auto_commit = any(flag == '--all' or flag.startswith('-') and
                                      not flag.startswith('--') and 'a' in flag[1:] for flag in flags)
                    narrow = operation == 'add' and not bulk_add or operation == 'commit' and not auto_commit
                    if narrow and private_index(local.get('GIT_INDEX_FILE')):
                        parts[0] = 'isolated-index'
                    segment = parts
                segments.append(shlex.join(segment))
            segment = []
        else:
            segment.append(token)
    return ' ; '.join(segments)


if __name__ == '__main__':
    print(normalize(sys.stdin.read()))
