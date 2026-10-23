#!/usr/bin/env python3
"""P1: bounded last-24h CI failure paths, cached in the existing push loop."""
import datetime as dt
import json
from pathlib import Path
import re
import runpy
import subprocess
import tempfile
import time

DIAGNOSTICS=runpy.run_path(str(Path(__file__).with_name('ci-fail-fast.py')))


def test_path(value):
    return isinstance(value,str) and '..' not in value.split('/') and '\\' not in value and bool(
        re.fullmatch(r'(?:src/|(?:admin/|drafts/)?test/)[\w./-]+\.test\.ts',value))


def read_cache(path, repo, now):
    try:
        value=json.loads(path.read_text())
        if value.get('repo') != repo:
            return {'repo':repo,'at':0,'runs':{}}
        value['runs']={key:row for key,row in value['runs'].items() if isinstance(row.get('at'),(int,float)) and now-86400 <= row['at'] <= now
                       and isinstance(row.get('files'),list) and all(test_path(file) for file in row['files'])}
        return value
    except (OSError,ValueError,AttributeError,KeyError,TypeError):
        return {'repo':repo,'at':0,'runs':{}}


def paths(cache):
    return list(dict.fromkeys(file for row in sorted(cache['runs'].values(),key=lambda row:-row['at']) for file in row['files']))


def request(args, root, deadline):
    left=deadline-time.monotonic()
    if left <= 0:
        raise TimeoutError('recent CI observation budget exhausted')
    result=subprocess.run(args,cwd=root,text=True,capture_output=True,timeout=min(4,left))
    return result.returncode,result.stdout


def failure_paths(root, repo, row, deadline, fetch=request):
    """Prefer exact C4 metadata, with legacy failed-job logs as a fallback."""
    (root/'tmp').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root/'tmp',prefix='recent-ci-') as directory:
        rc,_=fetch(['gh','run','download',str(row['databaseId']),'--repo',repo,'--pattern','ci-failures-*','--dir',directory],root,deadline)
        found=[]
        if rc==0:
            for file in Path(directory).rglob('failure.json'):
                record=json.loads(file.read_text())
                if record.get('sha') != row['headSha'] or str(record.get('run')) != str(row['databaseId']):
                    raise ValueError('foreign CI failure metadata')
                if record.get('peer') is None:
                    found.extend(path for path in record.get('files',[]) if test_path(path))
            return sorted(set(found))
        # Older CI runs predate C4; this is a different read, never a retry of a
        # timed-out operation. Only actual failed-job output is inspected.
        rc,out=fetch(['gh','run','view',str(row['databaseId']),'--repo',repo,'--log-failed'],root,deadline)
        if rc:
            raise RuntimeError('CI failed-job log unavailable')
        return [file for file in DIAGNOSTICS['failure_files'](out) if test_path(file)]


def refresh(root, deadline, fetch=request, now=None):
    now=time.time() if now is None else now
    common=Path(subprocess.check_output(['git','rev-parse','--path-format=absolute','--git-common-dir'],cwd=root,text=True).strip())
    remote=subprocess.run(['git','remote','get-url','origin'],cwd=root,text=True,capture_output=True)
    match=re.search(r'github\.com[:/]([\w.-]+/[\w.-]+?)(?:\.git)?$',remote.stdout.strip())
    if match is None:
        return [],'Recent CI tests unavailable: no GitHub origin'
    repo=match[1]
    path=common/'recent-ci-tests.json'
    cache=read_cache(path,repo,now)
    if isinstance(cache.get('at'),(int,float)) and 0 <= now-cache['at'] < 60:
        return paths(cache),'Recent CI tests: cached last-24h failures'
    note='Recent CI tests: refreshed last-24h failures'
    try:
        since=dt.datetime.fromtimestamp(now-86400,dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        rc,out=fetch(['gh','run','list','--repo',repo,'--workflow','deploy','--event','push','--status','failure',
                      '--created','>='+since,'--limit','100','--json','databaseId,updatedAt,headSha'],root,deadline)
        if rc:
            raise RuntimeError('CI run inventory unavailable')
        runs=json.loads(out)
        # Observe one newest unseen failure per tick; metadata is reused by
        # prefix checks and expires after 24h. No separate schedule or service.
        row=next((row for row in runs if str(row['databaseId']) not in cache['runs']),None)
        if row is not None:
            stamp=dt.datetime.fromisoformat(row['updatedAt'].replace('Z','+00:00')).timestamp()
            if now-86400 <= stamp <= now:
                # A timed-out exact run is recorded as observed, never retried.
                cache['runs'][str(row['databaseId'])]={'at':stamp,'files':[],'unavailable':True}
                files=failure_paths(root,repo,row,deadline,fetch)
                cache['runs'][str(row['databaseId'])]={'at':stamp,'files':files}
    except (OSError,ValueError,KeyError,TypeError,RuntimeError,TimeoutError,subprocess.SubprocessError) as error:
        note='Recent CI observation unavailable (%s); retained unexpired cached paths; no retry'%type(error).__name__
    cache['at']=now
    temporary=path.with_suffix('.next')
    temporary.write_text(json.dumps(cache)+'\n');temporary.replace(path)
    return paths(cache),note
