#!/usr/bin/env python3
"""One five-minute launchd tick; notify each failed CI revision once."""
import json
from pathlib import Path
import runpy
import subprocess

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
        commits = PUSH['git'](root, 'rev-list', '--reverse', green + '..' + row['headSha']).splitlines() if green else [row['headSha']]
        if notify(root, commits, '[ci-watch] CI red at ' + row['headSha'][:10] + ': ' + names + '. Fix forward; gh run view ' + str(row['databaseId']) + ' --log-failed'):
            state.write_text(json.dumps([*pinged, row['headSha']][-100:]))
        break


if __name__ == '__main__':
    watch(Path(PUSH['git'](Path.cwd(), 'rev-parse', '--show-toplevel')))
