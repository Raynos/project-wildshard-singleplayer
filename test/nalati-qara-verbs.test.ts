// oxlint-disable-next-line import/no-nodejs-modules -- The real native fight owns its bounded child and worker.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the maintained native input runner.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Retain the strict renderer-free simulation loader.
import {pathToFileURL} from 'node:url';
import {expect,test} from 'vitest';

test('five real night kills unlock Qara, whose complete fight replays in a fresh worker',()=>{
  const child=spawnSync(process.execPath,['--experimental-transform-types','--import',pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href,
    resolve('test/fixtures/headless/nalati-qara-run.ts')],{encoding:'utf8',timeout:175_000});
  expect(child.error,child.stdout+child.stderr).toBeUndefined();
  expect(child.status,child.stdout+child.stderr).toBe(0);
  expect(child.stdout).toContain('"story":"nalati-qara-full-fight"');
},180_000);
