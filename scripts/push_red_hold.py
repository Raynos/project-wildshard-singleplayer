"""G759: choose a checked publication prefix without rewriting local main."""
import re


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
