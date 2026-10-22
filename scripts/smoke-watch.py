#!/usr/bin/env python3
"""One temporary smoke/deploy observation; cadence belongs to sp-tools."""
from pathlib import Path
import fcntl
import json
import re
import subprocess
import urllib.request

root = Path(__file__).resolve().parents[1]
folder = root / 'tmp/sp-tools/smoke'
legacy = root / 'tmp/sp-x7-live'
repository = 'Raynos/project-wildshard-singleplayer'
floor = 'f66a4309ea67feabe04da0022ed70989bb46bee8'

def command(args):
    return subprocess.check_output(args, cwd=root, text=True, timeout=45)

def notify(message):
    delivered = True
    for target in ['wildshard-new', 'sp-x7']:
        result = subprocess.run([str(root / 'scripts/herdr-prompt.sh'), target, message], cwd=root, capture_output=True, timeout=30)
        delivered = delivered and result.returncode == 0
    return delivered

def live_version():
    state = folder / 'live-version.json'
    previous = json.loads(state.read_text()) if state.exists() else {}
    request = urllib.request.Request('https://wildshard-singleplayer.vercel.app/version.json', headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=30) as response:
        version = json.load(response)
    if version.get('build') == previous.get('build'):
        return
    prefix = version.get('build', '').split('-')[0]
    if re.fullmatch('[a-f0-9]{7,40}', prefix) is None:
        raise RuntimeError('Invalid production version stamp')
    revision = command(['git', 'rev-parse', '--verify', prefix + '^{commit}']).strip()
    statuses = json.loads(command(['gh', 'api', 'repos/' + repository + '/commits/' + revision + '/status']))['statuses']
    proof = next((row for row in statuses if row['context'] == 'production-live'), None)
    if proof is not None and proof['state'] == 'success':
        if notify('LIVE ' + revision + ' build ' + version['build'] + '; version.json and exact production-live status verified ' + proof['target_url']):
            state.write_text(json.dumps(version))

def cancel_superseded_queued():
    runs = json.loads(command(['gh', 'run', 'list', '--repo', repository, '--workflow', 'deploy', '--event', 'push',
                               '--branch', 'main', '--limit', '100', '--json', 'databaseId,headSha,status,createdAt']))
    if not runs:
        return
    newest = max(runs, key=lambda row: row['createdAt'])
    cancelled = []
    for row in runs:
        if row['status'] != 'queued' or row['databaseId'] == newest['databaseId']:
            continue
        if subprocess.run(['git', 'merge-base', '--is-ancestor', row['headSha'], newest['headSha']], cwd=root, capture_output=True).returncode != 0:
            continue
        path = 'repos/' + repository + '/actions/runs/' + str(row['databaseId'])
        fresh = json.loads(command(['gh', 'api', path]))
        if fresh['event'] != 'push' or fresh['head_branch'] != 'main' or fresh['path'] != '.github/workflows/deploy.yml' or fresh['status'] != 'queued':
            continue
        jobs = json.loads(command(['gh', 'api', path + '/jobs?per_page=100']))['jobs']
        if any(job['status'] == 'in_progress' for job in jobs):
            continue
        # Never cancel an active run merely because the earlier list was stale.
        if json.loads(command(['gh', 'api', path]))['status'] != 'queued':
            continue
        result = subprocess.run(['gh', 'run', 'cancel', str(row['databaseId']), '--repo', repository], cwd=root, capture_output=True, text=True, timeout=45)
        if result.returncode == 0:
            cancelled.append(str(row['databaseId']))
    if cancelled:
        print('Cancelled superseded queued PUSH CI only: ' + ','.join(cancelled) + '; retained newest ' + str(newest['databaseId']), flush=True)

def retained_products():
    marker = folder / 'retained-products-done'
    if marker.exists():
        return
    run = '39694237624'
    rows = json.loads(command(['gh', 'api', 'repos/' + repository + '/actions/runs/' + run + '/jobs?per_page=100']))['jobs']
    product = next((row for row in rows if row['name'] == 'products'), None)
    if product is None or product['status'] != 'completed':
        return
    if product['conclusion'] == 'success':
        message = 'Retained CI 6adaf5e89a products PASS: Pine map fix 1ca7e0cc6a is included and all products/SF66 checks passed in run ' + run + '. Full CI still needs its remaining jobs.'
    else:
        failed = command(['gh', 'api', '--allow-escape-sequences', 'repos/' + repository + '/actions/jobs/' + str(product['id']) + '/logs'])
        (folder / 'retained-products-failed.log').write_text(failed)
        message = 'BLOCKER retained CI 6adaf5e89a products ' + str(product['conclusion']) + '; inspect tmp/sp-tools/smoke/retained-products-failed.log for SF66 status. Run ' + run
    if notify(message):
        marker.write_text(product['conclusion'])

def migrate_state(destination, source_folder):
    destination.mkdir(parents=True, exist_ok=True)
    # Retain only notice state; tooling lives in scripts, logs stay disposable.
    for name in ['live-version.json', 'retained-products-done', 'smoke-notices.json']:
        source, target = source_folder / name, destination / name
        if source.exists() and not target.exists():
            target.write_bytes(source.read_bytes())


def main():
    migrate_state(folder, legacy)
    with (folder / 'smoke-watch.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit(0)
        state = folder / 'smoke-notices.json'
        seen = json.loads(state.read_text()) if state.exists() else []
        try:
            runs = json.loads(command(['gh', 'run', 'list', '--repo', repository, '--workflow', 'boot-smoke', '--limit', '20',
                                       '--json', 'databaseId,headSha,conclusion,url,attempt']))
            for row in runs:
                key = str(row['databaseId']) + ':' + str(row.get('attempt', 1))
                if key in seen or row['conclusion'] not in ['failure', 'timed_out', 'startup_failure']:
                    continue
                eligible = subprocess.run(['git', 'merge-base', '--is-ancestor', floor, row['headSha']], cwd=root, capture_output=True).returncode == 0
                if not eligible:
                    continue
                failed = command(['gh', 'run', 'view', str(row['databaseId']), '--repo', repository, '--log-failed'])
                (folder / 'smoke-current-failed.log').write_text(failed)
                lines = [line[-600:] for line in failed.splitlines() if re.search(r'Error:|BOOT_FATAL|Truncated tar|##\[error\]|TimeoutError', line)]
                detail = '\n'.join(dict.fromkeys(lines))[:1800]
                message = 'BLOCKER smoke workflow ' + str(row['databaseId']) + ' workflow SHA ' + row['headSha'][:10] + ': ' + (detail or row['conclusion']) + '\n' + row['url'] + '\nLog tmp/sp-tools/smoke/smoke-current-failed.log; tested SHA must be checked from artifact provenance.'
                if notify(message):
                    seen.append(key)
                    state.write_text(json.dumps(seen[-100:]))
                break
        except Exception as error:
            signature = 'watch-error:' + str(error)
            if signature not in seen and notify('BLOCKER smoke watcher: ' + str(error)):
                state.write_text(json.dumps([*seen, signature][-100:]))
        try:
            live_version()
        except Exception as error:
            print('Live verification deferred: ' + str(error), flush=True)
        try:
            retained_products()
            cancel_superseded_queued()
        except Exception as error:
            print('CI queue observation deferred: ' + str(error), flush=True)


if __name__ == '__main__':
    main()
