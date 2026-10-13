// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated source inventory fixture.
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use only a fixture folder.
import {tmpdir} from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve owned fixture sources.
import {dirname,resolve} from 'node:path';
import {expect,it} from 'vitest';
import {shardLines} from '../scripts/shard-platform.mjs';
import {customInventory,writeCustomInventories} from '../scripts/shard-custom-inventory.mjs';

it('reconciles exact canonical spans, avoids shader double counting and refuses invented totals',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'custom-inventory-'));
 const put=(path:string,source:string)=>{mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),source);};
 try{
  put('src/shards/sample/runtime/index.ts','// comment\nexport const value=1;\n');
  put('src/shards/sample/data/look.ts','export const shader=`uniform float t;\nvoid main(){ }`;\n');
  put('src/shards/sample/shard.config.ts','const row={};export default row;\n');
  const measured=shardLines(root,true)['sample'];if(measured===undefined)throw new Error('Missing source fixture');
  const report=customInventory(root,'sample',measured);
  expect(report.parts).toEqual([{name:'Additional raw GLSL',lines:2},{name:'Installers',lines:1}]);
  expect(report.files.some(row=>row.path.endsWith('shard.config.ts'))).toBe(false);
  expect(report.measured.customRuntimeLines).toBe(3);
  expect(()=>customInventory(root,'sample',{...measured,conversion:{...measured.conversion,customRuntimeLines:4}})).toThrow('does not reconcile');
  writeCustomInventories(root,['sample'],'2026-10-13','a'.repeat(40));const path=resolve(root,'progress/shard-platform/sample-custom-2026-10-13/data.json');const before=readFileSync(path);writeCustomInventories(root,['sample'],'2026-10-13','a'.repeat(40));expect(readFileSync(path)).toEqual(before);
  expect(()=>writeCustomInventories(root,['sample'],'2026-10-13','stale')).toThrow('full source revision');
 }finally{rmSync(root,{recursive:true,force:true});}
});
