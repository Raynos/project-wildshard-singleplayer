"""G759: choose a checked publication prefix without rewriting local main."""
import re
import json
import subprocess
import time


def completed_push_verdict(root, deadline, runner=subprocess.run):
    """Read the newest actual CI verdict; cancelled runs supply no verdict."""
    remaining = min(10, deadline - time.monotonic())
    if remaining <= 0:
        raise ValueError('CI verdict check has no remaining batch allowance')
    result = runner(['gh', 'api',
                     'repos/{owner}/{repo}/actions/workflows/deploy.yml/runs?branch=main&event=push&status=completed&per_page=25'],
                    cwd=root, capture_output=True, text=True, timeout=remaining, check=False)
    if result.returncode != 0:
        raise ValueError('CI verdict lookup refused: ' + result.stderr.strip()[:500])
    response = json.loads(result.stdout)
    rows = response.get('workflow_runs')
    if not isinstance(rows, list):
        raise ValueError('CI verdict response has no workflow runs')
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('Invalid CI run')
        if row.get('conclusion') not in ('success', 'failure', 'timed_out'):
            continue
        if (row.get('event') != 'push' or row.get('head_branch') != 'main' or
                row.get('status') != 'completed' or not isinstance(row.get('head_sha'), str) or
                not re.fullmatch(r'[0-9a-f]{40}', row['head_sha']) or
                type(row.get('id')) is not int or row['id'] <= 0):
            raise ValueError('CI verdict is not an exact completed main push')
        return {'id': row['id'], 'sha': row['head_sha'], 'red': row['conclusion'] != 'success'}
    raise ValueError('No completed CI quality verdict is available')


def red_hold_tip(commits, red):
    """Commits arrive oldest first; a red verdict admits the latest fix prefix.

    The caller still checks that exact prefix. A marker grants no test waiver.
    Unknown verdicts refuse rather than behaving as green.
    """
    if not isinstance(red, bool):
        raise ValueError('A completed push verdict is required')
    seen = set()
    selected = None
    for commit in commits:
        sha, message = commit.get('sha'), commit.get('message')
        if not isinstance(sha, str) or not re.fullmatch(r'[0-9a-f]{40}', sha) or sha in seen:
            raise ValueError('Invalid ordered commit identity')
        if not isinstance(message, str):
            raise ValueError('Missing commit message')
        seen.add(sha)
        # Assisted-by has its own blank separator in this repository. Read the
        # explicit commit-message line, not only Git's final trailer paragraph.
        marked = re.search(r'^Red-fix:[ \t]*\S[^\r\n]*$', message, re.M) is not None
        if not red or marked:
            selected = sha
    return selected
