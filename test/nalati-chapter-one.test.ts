// oxlint-disable-next-line import/no-nodejs-modules -- Execute the fixed native input recorder with its original field-proof bound.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Only this case owns and retires its genuinely earned private continuation.
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the maintained native loader and checked-in runner.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The renderer-free loader uses its native file URL.
import {pathToFileURL} from 'node:url';
import {afterAll,expect,test} from 'vitest';
import {chapterWireHash} from './fixtures/headless/chapterHandoff';

mkdirSync(resolve('tmp'),{recursive:true});
const directory=mkdtempSync(resolve('tmp/nalati-chapter-one-')),plains=resolve(directory,'plains.json'),bond=resolve(directory,'bond.json');
let plainsHash:string|undefined;
afterAll(()=>{rmSync(directory,{recursive:true});});
function run(stage:'plains'|'bond',output:string,input?:string,hash?:string):string {
  const started=performance.now();
  const child=spawnSync(process.execPath,['--experimental-transform-types','--import',pathToFileURL(resolve('scripts/sim-node-loader.mjs')).href,
    resolve('test/fixtures/headless/nalati-chapter-one-run.ts'),stage,output,...(input===undefined?[]:[input]),...(hash===undefined?[]:[hash])],{encoding:'utf8',timeout:150_000});
  const outcome=child.stdout+child.stderr+JSON.stringify({error:child.error?.message,signal:child.signal,elapsedMs:performance.now()-started});
  expect(child.error,outcome).toBeUndefined();expect(child.signal,outcome).toBeNull();expect(child.status,outcome).toBe(0);
  expect(child.stdout).toContain(`"story":"chapter-one-${stage}"`);
  const actual=chapterWireHash(readFileSync(output,'utf8'));expect(child.stdout).toContain(`"hash":"${actual}"`);
  process.stdout.write(child.stdout);return actual;
}
test('chapter one earns its horse-plains arrival through the real elder talk and bank walk',()=>{
  plainsHash=run('plains',plains);
},180_000);
test('the earned plains continuation tames its stallion through real gaze and all five bucking rounds',()=>{
  expect(plainsHash,'the first case must earn and fully replay the actual arrival').toBeDefined();
  if(plainsHash===undefined)throw new Error('Missing earned horse-plains continuation');
  expect(chapterWireHash(readFileSync(plains,'utf8'))).toBe(plainsHash);
  run('bond',bond,plains,plainsHash);
},180_000);
