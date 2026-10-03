"""rerecord.py <sha-prefix> <reason>: re-record far-reach's GL ceilings at the measured parity values, exactly as the tool wrote them."""
import json, hashlib, shutil, re, subprocess, sys, os
os.chdir('/Users/raynos/projects/games/wildshard-singleplayer')
short, reason = sys.argv[1], sys.argv[2]
SHA = subprocess.check_output(['git', 'rev-parse', short]).decode().strip()
d7 = SHA[:7]
meas = {}
for t in ('phone', 'desktop'):
    dst = f'budgets/calibration-reports/far-reach.{t}.json'; shutil.copy(f'progress/parity/{d7}/far-reach.{t}.json', dst)
    raw = open(dst, 'rb').read(); rep = json.loads(raw)
    v = [f['now'] for f in rep['fields'] if f['field'] == 'budgets.current.gpuMB'][0]; meas[t] = (v, hashlib.sha256(raw).hexdigest()); print(t, repr(v))
p = 'budgets/ceiling-sources.json'; d = json.load(open(p))
for r in d['reRecords']:
    if r['shard'] == 'far-reach':
        v, h = meas[r['tier']]
        r.update({'commit': SHA, 'reason': reason, 'approval': reason, 'captureSha': SHA, 'captureSha256': h, 'ceilings': {f"far-reach.{r['tier']}.current.gpuMB": v}})
open(p, 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
p = 'budgets/ceiling-re-records.json'; d = json.load(open(p))
for r in d['entries']:
    if r['shard'] == 'far-reach': r.update({'commit': SHA, 'reason': reason})
open(p, 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
p = 'src/shards/far-reach/budgetCeilings.ts'; s = open(p).read()
s = re.sub(r'("phone": \{\s*"current": \{\s*"gpuMB": )[0-9.]+', lambda m: m.group(1) + repr(meas['phone'][0]), s)
s = re.sub(r'("desktop": \{\s*"current": \{\s*"gpuMB": )[0-9.]+', lambda m: m.group(1) + repr(meas['desktop'][0]), s)
open(p, 'w').write(s)
