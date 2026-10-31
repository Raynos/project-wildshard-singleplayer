// oxlint-disable-next-line import/no-nodejs-modules -- One bounded native recorder and fresh independent workers.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixed checked-in runner and source loader only.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Native source loader requires its absolute URL.
import {pathToFileURL} from 'node:url';
import {expect,test} from 'vitest';
import * as v from 'valibot';

const result=v.object({phase:v.literal('replayed'),story:v.literal('sky-vanes'),ticks:v.number(),commands:v.number(),parts:v.number(),removedGusts:v.number()});
test('Sky turns all three vanes through real GUSTs; movement alone cannot turn them',()=>{
  const child=spawnSync(process.execPath,['--experimental-transform-types','--import',pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href,
    resolve('test/fixtures/headless/sky-roost-run.ts'),'vanes'],{encoding:'utf8',timeout:30_000});
  expect(child.status,child.stdout+child.stderr).toBe(0);
  const line=child.stdout.split('\n').find(row=>row.includes('"phase":"replayed"'));
  if(line===undefined)throw new Error('Missing actual Sky vane replay');
  const observed=v.parse(result,JSON.parse(line));
  expect(observed.ticks).toBeGreaterThan(0);expect(observed.commands).toBeGreaterThan(0);
  expect(observed.parts).toBeGreaterThan(1);expect(observed.removedGusts).toBeGreaterThan(0);
  console.info(line);
},35_000);
