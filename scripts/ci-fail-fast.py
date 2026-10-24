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
from urllib.parse import unquote

ANSI = re.compile(r'\x1b\[[0-9;]*m')
ROOT = r'(?:src|scripts|test|admin|api|drafts|lint|vite)/'
EXTENSION = r'\.(?:json|[cm]?[jt]sx?|py|sh|mjs)'
FILE = ROOT+r'[^\s():\x1b,=]+?'+EXTENSION+r'\b'
QUOTED_FILE = r'[\'\"]('+ROOT+r'[^\'\"\r\n]+?'+EXTENSION+r')[\'\"]'
ANNOTATION = re.compile(r'::error(?: ([^\r\n]*?))?::')


def repository_file(file):
    """Vitest annotations may name an absolute path in this exact checkout."""
    relative=os.path.relpath(file,os.environ.get('GITHUB_WORKSPACE') or os.getcwd()) if os.path.isabs(file) else file
    return relative if '..' not in relative.split('/') and re.match(ROOT,relative) else None


def failure_files(output):
    plain = ANSI.sub('', output)
    annotated, lines = [], []
    for line in plain.splitlines():
        annotation = ANNOTATION.search(line)
        if annotation:
            # Split annotation properties BEFORE decoding escaped commas. A
            # title is metadata, never a suffix of the file sent to Git.
            properties = dict(item.split('=', 1) for item in (annotation[1] or '').split(',') if '=' in item)
            if properties.get('file'):
                annotated.append(unquote(properties['file']))
                continue
            line = line[annotation.end():]
        lines.append(line)
    primary = [line for line in lines if re.search(r'\bFAIL\s|\berror (?:TS\d+|\[)|\berror\[|Error:|error:', line)]
    def extract(text):
        return re.findall(QUOTED_FILE, text) + re.findall(FILE, text)
    found = sorted(set(annotated + extract('\n'.join(primary))))
    paths=(repository_file(file) for file in (found or extract('\n'.join(lines))))
    return sorted({file for file in paths if file is not None})[:16]


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


def print_culprits(files):
    """Advisory exact-history attribution, bounded independently of the red check."""
    try:
        result=subprocess.run(['node',str(Path(__file__).with_name('ci-culprits.mjs')),
            '--sha='+os.environ.get('GITHUB_SHA',''),'--files='+json.dumps(files[:16])],
            text=True,capture_output=True,timeout=35)
        if result.returncode:
            raise RuntimeError('helper exited '+str(result.returncode))
        row=json.loads(result.stdout)
        if not re.fullmatch(r'[0-9a-f]{40}',row['base']) or len(row['candidates'])>3:
            raise ValueError('invalid culprit report')
        print('::group::CF4 likely culprit commits',flush=True)
        print('Last green main push: '+row['base'],flush=True)
        for candidate in row['candidates']:
            print('Candidate '+escape(candidate['sha'])+' ['+escape(candidate['match'])+'] '+
                escape(candidate['subject'])+' | Assisted-by: '+escape(candidate['assistedBy']),flush=True)
        if not row['candidates']:
            print('No commit in this range touches the failing files or their literal imports.',flush=True)
        if row['missingImports']:
            print('Unresolved/absent committed inputs: '+escape(', '.join(row['missingImports'][:10])),flush=True)
        print('::endgroup::',flush=True)
    except (OSError,ValueError,KeyError,TypeError,RuntimeError,subprocess.SubprocessError) as error:
        print('::warning::CI culprit report unavailable: '+escape(type(error).__name__)+
            '; original check remains red; no retry',flush=True)


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
        if peer is None and files and os.environ.get('GITHUB_EVENT_NAME')=='push' and os.environ.get('GITHUB_RUN_ID'):
            print_culprits(files)
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
    # G678/SW9: tests, products and types/lint report independent failures.
    # Keep each command's own stop and diagnostics without peer observation.
    # Release jobs and local uses also retain their commands without peer IO.
    reader=peer_failure if os.environ.get('GITHUB_EVENT_NAME') in ('push','pull_request') \
        and os.environ.get('GITHUB_JOB') not in ('behaviour', 'behaviour-products', 'products', 'typecheck-lint') else None
    def interrupted(number, frame):
        raise SystemExit(128+number)
    for number in (signal.SIGTERM, signal.SIGINT):
        signal.signal(number,interrupted)
    raise SystemExit(run(args,reader))


if __name__=='__main__':
    main()
