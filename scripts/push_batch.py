"""G757: split an over-cap outgoing prefix before naming its CI handoff."""
import re


def batch_disposition(commits, failed, unfinished):
    """Pure policy; callers still check and upload only the selected prefix.

    Every result belongs to an exact committed batch. A real refusal cannot
    become a timeout waiver. At one commit only named unfinished steps are
    handed off; successful checks retain their local verdicts.
    """
    if (not isinstance(commits, list) or not commits or
            any(not isinstance(sha, str) or not re.fullmatch(r'[0-9a-f]{40}', sha)
                for sha in commits) or len(set(commits)) != len(commits)):
        raise ValueError('An exact ordered outgoing commit batch is required')
    for names in (failed, unfinished):
        if (not isinstance(names, list) or
                any(not isinstance(name, str) or not re.fullmatch(r'[a-z][a-z0-9-]*', name)
                    for name in names) or len(set(names)) != len(names)):
            raise ValueError('Gate steps must have unique explicit names')
    if set(failed).intersection(unfinished):
        raise ValueError('A refused step cannot also be unfinished')
    if failed:
        return {'kind': 'refused', 'failed': failed}
    if not unfinished:
        return {'kind': 'passed', 'tip': commits[-1]}
    if len(commits) > 1:
        return {'kind': 'split', 'tip': commits[len(commits) // 2 - 1],
                'unfinished': unfinished}
    return {'kind': 'deferred', 'tip': commits[0], 'unfinished': unfinished,
            'tags': ['Gate-deferred: ' + name for name in unfinished]}
