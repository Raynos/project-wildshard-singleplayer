import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual backstop shell against tiny process fixtures.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the mock executables and dispatch record.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep fixtures inside the repository scratch directory.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Give only the child fixture its mock executable path.
import { env } from 'node:process';

test.each([
  { name: 'busy hourly slot', slot: 'false', ready: 'true', live: 'false', dry: false, count: 0, status: 0 },
  { name: 'pending exact smoke', slot: 'true', ready: 'false', live: 'false', dry: false, count: 0, status: 0 },
  { name: 'already live candidate', slot: 'true', ready: 'true', live: 'true', dry: false, count: 0, status: 0 },
  { name: 'new proven candidate', slot: 'true', ready: 'true', live: 'false', dry: false, count: 1, status: 0 },
  { name: 'dry run', slot: 'true', ready: 'true', live: 'false', dry: true, count: 0, status: 0 },
  { name: 'unreadable slot', slot: 'invalid', ready: 'true', live: 'false', dry: false, count: 0, status: 1 },
  { name: 'proof API error', slot: 'true', ready: 'error', live: 'false', dry: false, count: 0, status: 1 },
])('hourly backstop: $name', row => {
  const root = mkdtempSync(resolve('tmp/backstop-test-')), bin = resolve(root, 'bin');
  const dispatched = resolve(root, 'dispatch');
  try {
    mkdirSync(bin);
    writeFileSync(resolve(bin, 'node'), `#!/usr/bin/env python3
import os,sys
from pathlib import Path
mode=sys.argv[-1]
if mode=='release-slot': value='free='+os.environ['BACKSTOP_SLOT']
elif mode=='release-ready':
    if os.environ['BACKSTOP_READY']=='error': sys.exit(1)
    value='ready='+os.environ['BACKSTOP_READY']+'\\nsha='+'a'*40
elif mode=='check':
    if os.environ.get('DEPLOY_SHA')!='a'*40: sys.exit(2)
    value='skip='+os.environ['BACKSTOP_LIVE']
else: sys.exit(2)
Path(os.environ['GITHUB_OUTPUT']).write_text(value+'\\n')
`, { mode: 0o755 });
    writeFileSync(resolve(bin, 'gh'), `#!/usr/bin/env python3
import os,sys
from pathlib import Path
if sys.argv[1:]!=['workflow','run','deploy']: sys.exit(2)
with Path(os.environ['BACKSTOP_DISPATCH']).open('a') as f: f.write('dispatch\\n')
`, { mode: 0o755 });
    const result = spawnSync('/bin/bash', ['scripts/deploy-backstop/backstop.sh', ...(row.dry ? ['--dry-run'] : [])], {
      encoding: 'utf8', timeout: 10_000,
      env: { ...env, PATH: `${bin}:${env['PATH'] ?? ''}`, WS_DEPLOY_BACKSTOP_LOG_DIR: resolve(root, 'logs'),
        BACKSTOP_SLOT: row.slot, BACKSTOP_READY: row.ready, BACKSTOP_LIVE: row.live, BACKSTOP_DISPATCH: dispatched },
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(row.status);
    const calls = existsSync(dispatched) ? readFileSync(dispatched, 'utf8').trim().split('\n').length : 0;
    expect(calls).toBe(row.count);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
