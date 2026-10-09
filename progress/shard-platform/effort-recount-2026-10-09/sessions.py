# Per session file (one lane / subagent): active-time timeline (gaps capped) and the commits it made ("[main <sha>]").
import glob, json, os, re, sys
from datetime import datetime
SP = '/private/tmp/claude-501/-Users-raynos-projects-games-wildshard-singleplayer/81cffee4-70d4-4229-8860-2e3743d9c0b8/scratchpad'
START = datetime.fromisoformat('2026-10-04T07:00:00+00:00').timestamp()
TS = re.compile(rb'"timestamp":"(2026-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"')
COMMIT = re.compile(rb'\[main ([0-9a-f]{7,40})\]')
SUBJ = re.compile(rb'SHARD-PLATFORM ([^\\\n"]{40})')
files = []
for f in glob.glob(os.path.expanduser('~/.codex/sessions/2026/*/*/*.jsonl')):
    if os.path.getmtime(f) < START: continue
    with open(f, 'rb') as h:
        head = h.read(4000)
    if b'wildshard-singleplayer' in head: files.append(('codex', f))
for f in glob.glob(os.path.expanduser('~/.claude/projects/-Users-raynos-projects-games-wildshard-singleplayer/**/*.jsonl'), recursive=True):
    if os.path.getmtime(f) >= START and '81cffee4' not in f: files.append(('claude', f))
out = []
for kind, f in files:
    stamps, commits, subs = [], {}, {}
    with open(f, 'rb') as h:
        for line in h:
            m = TS.search(line, 0, 400) or TS.search(line)
            if not m: continue
            t = datetime.fromisoformat(m.group(1).decode().replace('Z', '+00:00')).timestamp()
            stamps.append(t)
            if b'SHARD-PLATFORM ' in line:
                for x in SUBJ.findall(line):
                    subs.setdefault(x.decode('utf8', 'replace'), t)
            if b'[main ' in line:
                for c in COMMIT.findall(line):
                    commits.setdefault(c.decode(), t)
    stamps = sorted(s for s in stamps if s >= START)
    if not stamps: continue
    out.append({'kind': kind, 'file': f, 'stamps': stamps, 'commits': commits, 'subs': subs})
    print(kind, os.path.basename(f)[:40], len(stamps), len(commits), file=sys.stderr)
json.dump(out, open(f'{SP}/sessions.json', 'w'))
