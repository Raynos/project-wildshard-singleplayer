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
const directory=mkdtempSync(resolve('tmp/nalati-chapter-one-')),plains=resolve(directory,'plains.json'),approach=resolve(directory,'approach.json'),bond=resolve(directory,'bond.json'),goat=resolve(directory,'goat.json'),returning=resolve(directory,'return.json'),home=resolve(directory,'home.json');
let plainsHash:string|undefined,approachHash:string|undefined,bondHash:string|undefined,goatHash:string|undefined,returnHash:string|undefined;
afterAll(()=>{rmSync(directory,{recursive:true});});
function run(stage:'plains'|'approach'|'bond'|'goat'|'return'|'home',output:string,input?:string,hash?:string):string {
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
test('the earned plains continuation approaches its real stallion and earns the first bucking round',()=>{
  expect(plainsHash,'the first case must earn and fully replay the actual arrival').toBeDefined();
  if(plainsHash===undefined)throw new Error('Missing earned horse-plains continuation');
  expect(chapterWireHash(readFileSync(plains,'utf8'))).toBe(plainsHash);
  approachHash=run('approach',approach,plains,plainsHash);
},180_000);
test('the earned first bucking round tames its stallion through all five real rounds',()=>{
  expect(approachHash,'the preceding case must earn its actual trust and mount').toBeDefined();
  if(approachHash===undefined)throw new Error('Missing earned first breaking round');
  expect(chapterWireHash(readFileSync(approach,'utf8'))).toBe(approachHash);
  bondHash=run('bond',bond,approach,approachHash);
},180_000);
test('the earned horse wins and exactly replays the actual Kokpar pickup and delivery',()=>{
  expect(bondHash,'the preceding case must earn its real companion').toBeDefined();
  if(bondHash===undefined)throw new Error('Missing earned chapter horse');
  expect(chapterWireHash(readFileSync(bond,'utf8'))).toBe(bondHash);
  goatHash=run('goat',goat,bond,bondHash);
},180_000);
test('the earned Kokpar winner rides back to the real graded-road bend',()=>{
  expect(goatHash,'the preceding case must earn its actual delivery').toBeDefined();
  if(goatHash===undefined)throw new Error('Missing earned Kokpar continuation');
  expect(chapterWireHash(readFileSync(goat,'utf8'))).toBe(goatHash);
  returnHash=run('return',returning,goat,goatHash);
},180_000);
test('the earned road return crosses the bridge and finishes the real elder reading once',()=>{
  expect(returnHash,'the preceding case must ride the original return road').toBeDefined();
  if(returnHash===undefined)throw new Error('Missing earned graded-road return');
  expect(chapterWireHash(readFileSync(returning,'utf8'))).toBe(returnHash);
  run('home',home,returning,returnHash);
},180_000);
