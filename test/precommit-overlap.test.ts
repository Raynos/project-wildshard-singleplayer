// oxlint-disable-next-line import/no-nodejs-modules -- Own tiny Git fixtures exercise the real commit pipeline.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The FIFO rendezvous proves ordering without sleeps or timing races.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep every fixture beneath repository tmp.
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { precommitInputs } from '../scripts/precommit-inputs.mjs';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';

test.each(['none', 'guard', 'related'] as const)('related execution overlaps guards and preserves %s refusal', async refusal => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/commit-overlap-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim();
  const put = (name: string, text: string): void => { writeFileSync(resolve(root, name), text); };
  const warning = vi.spyOn(console, 'warn');
  try {
    git('init', '-q'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'fixture'); git('config', 'core.hooksPath', '/dev/null');
    mkdirSync(resolve(root, 'scripts')); mkdirSync(resolve(root, 'test'));
    put('package.json', '{"type":"module"}');
    put('.oxlintrc.json', '{}');
    put('scripts/precommit-related.mjs', '// Registered defining CF1 helper.\n');
    put('vitest.config.mjs', 'export default {test:{include:["test/**/*.test.ts"],maxWorkers:1}};');
    const fifo = resolve(root, 'rendezvous'), ack = resolve(root, 'guard-done');
    execFileSync('mkfifo', [fifo]);
    put('test/value.test.ts', `import {test,expect} from 'vitest';
import {constants,openSync,writeSync,closeSync} from 'node:fs';
test('guard and test rendezvous',async()=>{
 const fd=openSync(${JSON.stringify(fifo)},constants.O_WRONLY);
 try{expect(writeSync(fd,'exact candidate')).toBe(15);}finally{closeSync(fd);}
 expect(1).toBe(${refusal === 'related' ? 2 : 1});
 ${refusal === 'guard' ? 'await new Promise(resolve=>setTimeout(resolve,60000));' : ''}
});`);
    git('add', '.'); git('commit', '-qm', 'fixture');
    put('test/value.test.ts', `${readFileSync(resolve(root, 'test/value.test.ts'), 'utf8')}\n// staged change\n`);
    git('add', 'test/value.test.ts');
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
    linkNodeModules(resolve('.'), root);
    const index = readFileSync(resolve(root, '.git/index'));
    const checked = precommitInputs(root, checker);
    await (refusal === 'none' ? expect(checked).resolves.toBeUndefined()
      : expect(checked).rejects.toThrow(refusal === 'guard' ? 'typed lint: refused' : 'Related tests refused'));
    expect(readFileSync(ack, 'utf8')).toBe('checked');
    if (refusal === 'guard') expect(warning.mock.calls.some(args => String(args[0]).includes('cancelled after another commit guard refused'))).toBe(true);
    expect(readFileSync(resolve(root, '.git/index'))).toEqual(index);
  } finally { warning.mockRestore(); rmSync(root, { recursive: true, force: true }); }
}, 30_000);
