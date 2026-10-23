// oxlint-disable-next-line import/no-nodejs-modules -- Immutable guard-input fixtures.
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture files.
import {dirname,resolve} from 'node:path';
import {afterEach,expect,test} from 'vitest';
import {missingInventoryGeneration} from '../scripts/precommit-inputs.mjs';

const owned:string[]=[];
afterEach(()=>{for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture(){
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/guard-generation-'));owned.push(root);
  const put=(file:string,value:string):void=>{mkdirSync(dirname(resolve(root,file)),{recursive:true});writeFileSync(resolve(root,file),value);};
  put('scripts/generation-jobs.json',JSON.stringify({jobs:[{outputs:['src/producer.generated.json']}]}));
  put('scripts/source-generation-outputs.json',JSON.stringify({producers:{'scripts/gen-shards.mjs':['src/discovery.generated.ts']}}));
  return {root,put};
}
test('identifies only absent registered inputs and runs normally once restored',()=>{
  const {root,put}=fixture();
  put('test/guard.test.ts',"import manifest from '../src/discovery.generated';import data from '../src/producer.generated.json' with {type:'json'};");
  expect(missingInventoryGeneration(root,'test/guard.test.ts')).toEqual(['src/discovery.generated.ts','src/producer.generated.json']);
  put('src/discovery.generated.ts','export default {};');put('src/producer.generated.json','{}');
  expect(missingInventoryGeneration(root,'test/guard.test.ts')).toEqual([]);
});
test('ordinary missing imports and unavailable declarations never earn a deferral',()=>{
  const {root,put}=fixture();
  put('test/guard.test.ts',"import code from '../src/missing';import fake from '../src/unregistered.generated';");
  expect(missingInventoryGeneration(root,'test/guard.test.ts')).toEqual([]);
  rmSync(resolve(root,'scripts/generation-jobs.json'));
  put('test/guard.test.ts',"import manifest from '../src/discovery.generated';");
  expect(missingInventoryGeneration(root,'test/guard.test.ts')).toEqual([]);
});
