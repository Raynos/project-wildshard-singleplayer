import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Small, disposable ruler fixture.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confined fixture paths.
import {dirname,join} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- No repository copy.
import {tmpdir} from 'node:os';
import {shardLines,sourceProgressLines} from '../scripts/shard-platform.mjs';
import {platformOutput} from './fixtures/platformOutputs';

it('measures shipped TS, including generated copies, and never authoring data or shaders',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-output-data-'));
 const put=(file:string,source:string):void=>{const path=join(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,source);};
 try{
  platformOutput(root,'_template',{'runtime/index.ts':'export const LIVE=1;\nexport const GENERATED=2;'});
  put('src/shards/_template/data/table.ts','export const TABLE=1;');
  put('src/shards/_template/data/shader.glsl','void main() { gl_Position=vec4(0.0); }');
  put('src/shards/_template/generators/bake.ts','// Author-only.\nexport const AUTHOR=1;\n\nexport const OTHER=2;');
  put('src/shards/_template/generators/derived.ts','export const DERIVED=1;');
  put('src/shards/_template/generators/bake.test.ts','export const TEST=1;');
  put('src/shards/_template/generators/types.d.ts','export declare const TYPE:number;');
  put('scripts/source-generation-outputs.json',JSON.stringify({schema:'source-generation-outputs/1',producers:{'scripts/producer.mjs':['src/shards/_template/runtime/index.ts','src/shards/_template/generators/derived.ts']}}));
  const row=shardLines(root,true)['_template'];
  expect(row?.conversion.customRuntimeLines).toBe(2);
  expect(row?.generatorTsLines).toBe(2);
  const progress=sourceProgressLines(root)['_template'];
  expect(progress?.generatorTsLines).toBe(2);
  expect(progress?.customLines).toBe(2);
  expect(row?.conversion.rawGlslLines).toBe(0);
  expect(row?.customSources?.map(source=>source.path)).toEqual(['out/_template/runtime/index.ts']);
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('retains the sealed denominator and omits percentages for raw P0 escapes',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-output-frozen-'));
 const put=(file:string,source:string):void=>{const path=join(root,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,source);};
 try{
  platformOutput(root,'far-reach',{'runtime/index.ts':'export const LIVE=1;'});
  put('src/shards/far-reach/manifest.ts','export default {};');
  put('src/shards/far-reach-legacy/manifest.ts','export default {};');
  put('src/shards/far-reach-legacy/plugin.ts','export const ONE=1;\nexport const TWO=2;');
  put('lint/legacy-shards.json',JSON.stringify({version:1,sealed:true,shards:{'far-reach-legacy':{primary:'far-reach',source:'a'.repeat(40),files:{'manifest.ts':'b'.repeat(64),'plugin.ts':'b'.repeat(64)}}}}));
  expect(shardLines(root)['far-reach']?.conversion).toMatchObject({customRuntimeLines:1,legacyLines:3,runtimeShare:1/3});
  put('src/shards/far-reach/runtime/index.ts',"import rows from '../data/table'; export default rows;");
  expect(shardLines(root)['far-reach']).toBeUndefined();
 }finally{rmSync(root,{recursive:true,force:true});}
});
