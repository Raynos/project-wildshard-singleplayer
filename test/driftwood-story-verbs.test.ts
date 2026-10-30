// oxlint-disable-next-line import/no-nodejs-modules -- Isolate the native capture and worker replay.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only maintained repository fixtures.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixed strict source loader for the native child.
import {pathToFileURL} from 'node:url';
import {expect,test} from 'vitest';

test('Driftwood earns the Sealed Ring through real movement, combat, barrel contacts and replay',()=>{
  const child=spawnSync(process.execPath,['--experimental-transform-types','--import',pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href,
    resolve('test/fixtures/headless/driftwood-story-run.ts')],{encoding:'utf8',timeout:30_000});
  expect(child.status,child.stdout+child.stderr).toBe(0);
  expect(child.stdout).toContain('"story":"sealed-ring"');
},35_000);
