// oxlint-disable-next-line import/no-nodejs-modules -- A fixed native recorder and its independent replay own one bounded child.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- No caller-selected executable or fixture source.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Same strict source loader as the native worker.
import {pathToFileURL} from 'node:url';
import {expect,test} from 'vitest';
import * as v from 'valibot';

const result=v.object({story:v.literal('driftwood-optional'),ticks:v.number(),commands:v.number(),parts:v.number(),glass:v.number(),vista:v.number()});
test('Driftwood walk-in glass and bench USE earn their real counters exactly once',()=>{
  const child=spawnSync(process.execPath,['--experimental-transform-types','--import',pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href,
    resolve('test/fixtures/headless/driftwood-optional-run.ts')],{encoding:'utf8',timeout:30_000});
  expect(child.status,child.stdout+child.stderr).toBe(0);
  const line=child.stdout.split('\n').find(row=>row.includes('"story":"driftwood-optional"'));
  if(line===undefined)throw new Error('Missing actual optional Driftwood replay');
  const observed=v.parse(result,JSON.parse(line));
  expect(observed.ticks).toBeGreaterThan(0);expect(observed.commands).toBeGreaterThan(0);expect(observed.parts).toBeGreaterThan(1);
  expect(observed.glass).toBe(2);expect(observed.vista).toBe(1);console.info(line);
},35_000);
