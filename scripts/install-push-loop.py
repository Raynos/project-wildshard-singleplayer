#!/usr/bin/env python3
"""Install D8's two one-shot schedules at the carrier's natural boundary."""
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys


def jobs(root, python, path):
    common = Path(subprocess.check_output(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd=root, text=True).strip())
    return [{'Label': 'com.wildshard.' + name,
             'ProgramArguments': [python, str(root / 'scripts' / script)],
             'WorkingDirectory': str(root), 'StartInterval': interval,
             'EnvironmentVariables': {'PATH': path, 'HERDR_ENV': '1'},
             'StandardOutPath': str(common / (name + '-launchd.log')),
             'StandardErrorPath': str(common / (name + '-launchd.log'))}
            for name, script, interval in [('push', 'push-loop.py', 60), ('ci-watch', 'ci-watch.py', 300)]]


def main():
    root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
    python = shutil.which('python3')
    if python is None:
        raise SystemExit('python3 is required')
    folder = Path.home() / 'Library/LaunchAgents'
    folder.mkdir(parents=True, exist_ok=True)
    domain = 'gui/' + str(os.getuid())
    for job in jobs(root, python, os.environ['PATH']):
        file = folder / (job['Label'] + '.plist')
        file.write_bytes(plistlib.dumps(job))
        if '--activate' in sys.argv:
            subprocess.run(['launchctl', 'bootout', domain + '/' + job['Label']], capture_output=True)
            subprocess.run(['launchctl', 'bootstrap', domain, str(file)], check=True)
        print(str(file))


if __name__ == '__main__':
    main()
