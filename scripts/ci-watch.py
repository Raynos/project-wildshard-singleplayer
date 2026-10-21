#!/usr/bin/env python3
"""One five-minute launchd tick; notify each failed CI revision once."""
import json
from pathlib import Path
import runpy
import subprocess
import time

PUSH = runpy.run_path(str(Path(__file__).with_name('push-loop.py')))


def watch(root, command=subprocess.check_output, notify=PUSH['ping']):
    runs = json.loads(command(['gh', 'run', 'list', '--workflow', 'deploy', '--limit', '10',
                              '--json', 'headSha,conclusion,databaseId'], cwd=root, text=True, timeout=30))
    common = Path(PUSH['git'](root, 'rev-parse', '--path-format=absolute', '--git-common-dir'))
    state = common / 'ci-watch.json'
    pinged = PUSH['load'](state, [])
    for index, row in enumerate(runs):
        if row['conclusion'] not in ('failure', 'timed_out', 'startup_failure') or row['headSha'] in pinged:
            continue
        details = json.loads(command(['gh', 'run', 'view', str(row['databaseId']), '--json', 'jobs'],
                                     cwd=root, text=True, timeout=30))
        names = ', '.join(job['name'] for job in details['jobs'] if job['conclusion'] in ('failure', 'timed_out')) or row['conclusion']
        green = next((run['headSha'] for run in runs[index + 1:] if run['conclusion'] == 'success'), None)
        bad = None
        if green:
            failure = command(['gh', 'run', 'view', str(row['databaseId']), '--log-failed'], cwd=root, text=True, timeout=30)
            files = PUSH['LIVE']['failure_paths'](failure)
            bad = PUSH['offender'](root, green, row['headSha'], files, time.monotonic() + 10)
        # A failed tip without file attribution belongs with its own owner;
        # the first unrelated landing after an old green must not be blamed.
        commits = [bad or row['headSha']]
        attribution = '; attributed commit ' + bad if bad else ''
        if notify(root, commits, '[ci-watch] CI red at ' + row['headSha'][:10] + ': ' + names + attribution + '. Fix forward; gh run view ' + str(row['databaseId']) + ' --log-failed'):
            state.write_text(json.dumps([*pinged, row['headSha']][-100:]))
        break


if __name__ == '__main__':
    watch(Path(PUSH['git'](Path.cwd(), 'rev-parse', '--show-toplevel')))
