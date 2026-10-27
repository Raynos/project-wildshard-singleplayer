// oxlint-disable-next-line import/no-nodejs-modules -- Own tiny Git fixtures exercise the real commit pipeline.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The FIFO rendezvous proves ordering without sleeps or timing races.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep every fixture beneath repository tmp.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';

test.each(['none', 'guard', 'storage'] as const)('storage overlaps typed lint and preserves %s refusal', async refusal => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/commit-overlap-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  const put = (name: string, text: string): void => { writeFileSync(resolve(root, name), text); };
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture'); git('config', 'core.hooksPath', '/dev/null');
    mkdirSync(resolve(root, 'scripts'));
    put('package.json', '{"type":"module"}');
    put('.oxlintrc.json', '{}');
    const fifo = resolve(root, 'rendezvous'), ack = resolve(root, 'guard-done');
    execFileSync('mkfifo', [fifo]);
    put('scripts/repo-size.mjs', `import assert from 'node:assert/strict';
import {constants,openSync,writeSync,closeSync} from 'node:fs';
 const fd=openSync(${JSON.stringify(fifo)},constants.O_WRONLY);
 try{assert.equal(writeSync(fd,'exact candidate'),15);}finally{closeSync(fd);}
 ${refusal === 'storage' ? "throw new Error('explicit storage refusal');" : ''}
`);
    put('unit.ts', 'export const value = 1;\n');
    git('add', '.'); git('commit', '-qm', 'fixture');
    put('unit.ts', 'export const value = 2;\n');
    git('add', 'unit.ts');
    const checker = resolve(root, 'check.py');
    put('check.py', `#!/usr/bin/env python3
import os,sys
if '--type-aware' in sys.argv:
 with open(${JSON.stringify(fifo)},'rb',buffering=0) as pipe:
  assert pipe.read(15)==b'exact candidate'
 with open(${JSON.stringify(ack)},'w') as output: output.write('checked')
 ${refusal === 'guard' ? "sys.exit('explicit guard refusal')" : ''}
`);
    chmodSync(checker, 0o755);
    const index = readFileSync(resolve(root, '.git/index'));
    const checked = precommitInputs(root, checker);
    await (refusal === 'none' ? expect(checked).resolves.toBeUndefined()
      : expect(checked).rejects.toThrow(refusal === 'guard' ? 'typed lint: refused' : 'storage: refused'));
    expect(readFileSync(ack, 'utf8')).toBe('checked');
    expect(readFileSync(resolve(root, '.git/index'))).toEqual(index);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
