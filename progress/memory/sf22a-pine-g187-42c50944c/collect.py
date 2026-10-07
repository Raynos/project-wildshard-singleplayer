#!/usr/bin/env python3
"""Keep the measurement, omit incidental device telemetry, compress repetitive full GL ledgers."""
import gzip
import json
import shutil
import sys
from pathlib import Path

scratch, out = (Path(arg) for arg in sys.argv[1:])
assert (scratch / 'sim-complete.exit').read_text().strip() == '0'
assert (scratch / 'gl-complete.exit').read_text().strip() == '0'

def inspector(source, target):
    rows = [json.loads(line) for line in source.read_text().splitlines() if line.strip()]
    for row in rows:
        if row.get('kind') == 'summary':
            saves = row['result'].get('deviceSaves')
            if saves is not None:
                row['result']['deviceSaves'] = {key: value for key, value in saves.items()
                                                if key in ('devMode', 'debug.plugin.pine-hollow.pineMemoryTrim')}
    target.write_text(''.join(json.dumps(row, separators=(',', ':')) + '\n' for row in rows))

for name, source in [('sim', 'sim-complete'), ('instrumentation-attempt', 'sim')]:
    dest = out / name
    dest.mkdir(parents=True, exist_ok=True)
    for file in (scratch / source).iterdir():
        if file.suffix == '.jsonl':
            if file.name.endswith('.inspector.jsonl'):
                inspector(file, dest / file.name)
            else:
                shutil.copyfile(file, dest / file.name)
        elif file.name in ('plan.json', 'report.json', 'table.md'):
            shutil.copyfile(file, dest / file.name)
dest = out / 'gl'
dest.mkdir(parents=True, exist_ok=True)
for file in (scratch / 'gl-complete').iterdir():
    if file.name.startswith('r') and file.suffix == '.json':
        (dest / (file.name + '.gz')).write_bytes(gzip.compress(file.read_bytes(), mtime=0))
    elif file.name == 'summary.json' or file.suffix == '.jpg':
        assert file.suffix != '.jpg' or file.stat().st_size <= 500_000
        shutil.copyfile(file, dest / file.name)
failed_gl = scratch / 'gl/r1.json'
(out / 'instrumentation-attempt/gl-r1.json.gz').write_bytes(gzip.compress(failed_gl.read_bytes(), mtime=0))
for name in ('bootstrap.json', 'gl-bootstrap.json'):
    shutil.copyfile(scratch / name, out / name)
for source in ('sim', 'sim-complete', 'gl', 'gl-complete'):
    shutil.copyfile(scratch / (source + '.log'), out / (source + '.log'))
print(out)
