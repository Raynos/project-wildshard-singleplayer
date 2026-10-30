// oxlint-disable-next-line import/no-nodejs-modules -- Execute the bounded native input capture and independent replay.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the checked-in native runner and loader.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The same renderer-free loader as every trusted native worker.
import {pathToFileURL} from 'node:url';
import {expect,test} from 'vitest';

test('Nalati natural storm and mounted inputs earn and replay the complete Titan fight',()=>{
  const child=spawnSync(process.execPath,['--experimental-transform-types','--import',pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href,
    resolve('test/fixtures/headless/nalati-titan-run.ts')],{encoding:'utf8',timeout:150_000});
  expect(child.status,child.stdout+child.stderr+String(child.error??'')+(child.signal??'')).toBe(0);
  expect(child.stdout).toContain('"story":"titan"');
},180_000);
