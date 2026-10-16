# Extends ../effort-recount-2026-10-09/sessions.py. Per session file (one lane / subagent): its active-time timeline and
# every plan-era commit it mentions. Since the Conventional Commits switch (E476, 10-11) and private-index landings, a
# lane rarely prints "[main <sha>]", so any 9-40 hex token that is a known commit's prefix counts as a mention; effort.py
# credits a commit to the session that mentions it first (the author reports its own SHA as it lands).
#   python3 sessions.py <scratch dir>     (reads <scratch>/commits.json, writes <scratch>/sessions.json)
import glob, json, os, re, sys
from datetime import datetime
SP = sys.argv[1]
START = datetime.fromisoformat('2026-10-04T07:00:00+00:00').timestamp()
TS = re.compile(rb'"timestamp":"(2026-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z)"')
HEX = re.compile(rb'(?<![0-9a-f])([0-9a-f]{9,40})(?![0-9a-f])')
known = {c['sha'][:9]: c['sha'] for c in json.load(open(f'{SP}/commits.json'))}
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
    stamps, commits = [], {}
    with open(f, 'rb') as h:
        for line in h:
            m = TS.search(line, 0, 400) or TS.search(line)
            if not m: continue
            t = datetime.fromisoformat(m.group(1).decode().replace('Z', '+00:00')).timestamp()
            stamps.append(t)
            for x in HEX.findall(line):
                sha = known.get(x[:9].decode())
                if sha and sha.startswith(x.decode()): commits.setdefault(sha, t)
    stamps = sorted(s for s in stamps if s >= START)
    if not stamps: continue
    out.append({'kind': kind, 'file': f, 'stamps': stamps, 'commits': commits})
print(len(out), 'sessions', sum(len(s['commits']) for s in out), 'mentions', file=sys.stderr)
json.dump(out, open(f'{SP}/sessions.json', 'w'))
