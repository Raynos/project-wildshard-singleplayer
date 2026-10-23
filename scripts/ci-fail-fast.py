#!/usr/bin/env python3
"""C4: stop owned CI work on a same-run failure without cancelling its red verdict."""
from collections import deque
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import re
import selectors
import signal
import subprocess
import sys
import time

ANSI = re.compile(r'\x1b\[[0-9;]*m')
FILE = r'(?:src|scripts|test|admin|api|drafts|lint|vite)/[^\s():\x1b]+\.(?:json|[cm]?[jt]sx?|py|sh|mjs)'


def failure_files(output):
    plain = ANSI.sub('', output)
    primary = [line for line in plain.splitlines() if re.search(r'\bFAIL\s|\berror (?:TS\d+|\[)|\berror\[|Error:|error:', line)]
    found = sorted(set(re.findall(FILE, '\n'.join(primary))))
    return found or sorted(set(re.findall(FILE, plain)))[:16]


def failed_job(jobs):
    # Pending and matrix-cancelled jobs never invent a cause. The original
    # failing job stays red and remains the source of its file diagnostics.
    failures = [job for job in jobs if job.get('conclusion') in ('failure', 'timed_out')]
    return min(failures, key=lambda job: job.get('completed_at') or '') if failures else None


def peer_failure():
    repo, run, attempt = (os.environ.get(key, '') for key in ('GITHUB_REPOSITORY','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'))
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', repo) or not run.isdigit() or not attempt.isdigit():
        raise RuntimeError('missing exact CI run identity')
    result = subprocess.run(['gh','api',f'repos/{repo}/actions/runs/{run}/attempts/{attempt}/jobs?per_page=100'],
                            text=True,capture_output=True,timeout=10)
    if result.returncode:
        raise RuntimeError('GitHub job observation exited %d' % result.returncode)
    payload = json.loads(result.stdout)
    if payload.get('total_count', 0) > len(payload.get('jobs', [])):
        raise RuntimeError('incomplete GitHub job inventory')
    return failed_job(payload['jobs'])


def escape(value):
    return str(value).replace('%','%25').replace('\r','%0D').replace('\n','%0A').replace(',','%2C').replace(':','%3A')


def diagnose(output, code, peer=None, record=True):
    files = [] if peer is not None else failure_files(output)
    label = ('Peer job '+peer['name']+' failed; stopped this owned command') if peer else 'Check exited '+str(code)
    for file in files:
        print('::error file=%s::%s: %s' % (escape(file), escape(label), escape(file)), flush=True)
    if not files:
        print('::error::'+escape(label)+(('; '+peer.get('html_url','')) if peer else '; see command output for the failing input'), flush=True)
    if record:
        directory=Path('tmp/ci-failures');directory.mkdir(parents=True,exist_ok=True)
        job=os.environ.get('GITHUB_JOB','check')
        # One runner owns this file. Failure metadata has no credentials/log text.
        (directory/'failure.json').write_text(json.dumps({'at':time.time(),'sha':os.environ.get('GITHUB_SHA'),
            'run':os.environ.get('GITHUB_RUN_ID'),'job':job,'files':files,'peer':peer.get('html_url') if peer else None})+'\n')
    return files


def stop(child):
    if child.poll() is not None:
        return
    try:
        os.killpg(child.pid, signal.SIGTERM)
        child.wait(timeout=2)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
    except ProcessLookupError:
        child.wait()


def run(command, reader=None, interval=15, record=True):
    """Drain output live; background observation never blocks the child's pipe."""
    output=deque(maxlen=2000)
    peer=None
    observer=None
    next_read=0
    with ThreadPoolExecutor(max_workers=1) as pool, subprocess.Popen(command,stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,start_new_session=True,bufsize=0) as child:
        selector=selectors.DefaultSelector()
        selector.register(child.stdout,selectors.EVENT_READ)
        pending=''
        try:
            while selector.get_map():
                if reader is not None and observer is None and time.monotonic() >= next_read:
                    observer=pool.submit(reader)
                if observer is not None and observer.done():
                    try:
                        peer=observer.result()
                    except (OSError,ValueError,RuntimeError,subprocess.SubprocessError) as error:
                        # One failed observation is named, never retried. The
                        # original checks still decide this runner's outcome.
                        print('::warning::CI peer observation unavailable: '+escape(type(error).__name__)+'; no retry',flush=True)
                        reader=None
                    observer=None
                    next_read=time.monotonic()+interval
                    if peer is not None:
                        stop(child)
                for key, _ in selector.select(timeout=.1):
                    chunk=os.read(key.fd,65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    text=chunk.decode('utf8',errors='replace')
                    print(text,end='',flush=True)
                    lines=(pending+text).split('\n');pending=lines.pop()
                    output.extend(lines)
            if pending:
                output.append(pending)
            code=child.wait()
        except BaseException:
            stop(child)
            raise
        finally:
            selector.close()
        # An in-flight read is bounded to 10s; no polling thread or child leaks.
    if peer is not None or code:
        diagnose('\n'.join(output),code,peer,record)
        return 1 if peer is not None else code if code > 0 else 1
    return 0


def main():
    args=sys.argv[1:]
    if args[:1]==['--']:
        args=args[1:]
    if not args:
        raise SystemExit('usage: ci-fail-fast.py -- <command...>')
    # Release jobs and local uses keep their original commands without peer IO.
    reader=peer_failure if os.environ.get('GITHUB_EVENT_NAME') in ('push','pull_request') else None
    def interrupted(number, frame):
        raise SystemExit(128+number)
    for number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(number,interrupted)
    raise SystemExit(run(args,reader))


if __name__=='__main__':
    main()
