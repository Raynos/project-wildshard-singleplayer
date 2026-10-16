import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable output/reach fixture, never a repository export.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confined fixture paths.
import {join,dirname} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Small temporary test repository.
import {tmpdir} from 'node:os';
import {outputShardLines} from '../scripts/shard-platform.mjs';
import {sectionHostImports} from '../scripts/shard-platform-hosts.mjs';
import {platformOutput} from './fixtures/platformOutputs';

it('roots G294 in copied runtime and emitted section hosts, never build imports',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-output-reach-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  put('src/game/package.json',JSON.stringify({name:'@wildshard/game',exports:{'./private':'./private.ts'}}));
  put('src/game/private.ts','export function live() { return 1; }\nexport function authored() { return 2; }');
  put('src/game/shard/declaredRows.ts','export function declaredWeather() { return 1; }\nexport function unrelated() { return 2; }');
  platformOutput(root,'pine-hollow',{'runtime/index.ts':"import {live} from '@wildshard/game/private'; export const value=live();"},{'world/weather':'{"rows":{"weather":[]}}'});
  platformOutput(root,'driftwood-isle',{'runtime/index.ts':'export const value=1;'});
  put('src/shards/driftwood-isle/data/build.ts',"import {live,authored} from '@wildshard/game/private'; export const table=[live(),authored()];");
  const pine=outputShardLines(root,true)['pine-hollow'];
  expect(pine?.measurement).toBe('built-output');
  expect(pine?.conversion.shardRuntimeLines).toBe(1);
  expect(pine?.conversion.gameSystemAttribution.modules.map(row=>row.path)).toContain('src/game/private.ts');
  expect(pine?.conversion.gameSystemAttribution.modules.map(row=>row.path)).toContain('src/game/shard/declaredRows.ts');
  expect(pine?.customSources?.filter(row=>row.kind==='runtime-ts').map(row=>row.path)).toEqual(['out/pine-hollow/runtime/index.ts']);
  expect(pine?.customSources?.some(row=>row.path.includes('data/'))).toBe(false);
  // A real second runtime user, unlike the authoring import above, shares the module.
  platformOutput(root,'driftwood-isle',{'runtime/index.ts':"import {live} from '@wildshard/game/private'; export const value=live();"});
  expect(outputShardLines(root)['pine-hollow']?.conversion.gameSystemAttribution.modules.map(row=>row.path)).not.toContain('src/game/private.ts');
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('rejects unknown section hosts and absent outputs instead of measuring source',()=>{
 expect(()=>sectionHostImports([{name:'world/unreviewed'}])).toThrow('No output host attribution');
 expect(sectionHostImports([{name:'custom/private'}])).toBe('');
 const root=mkdtempSync(join(tmpdir(),'platform-output-missing-'));
 try{
  mkdirSync(join(root,'src/shards/_template/runtime'),{recursive:true});
  writeFileSync(join(root,'src/shards/_template/runtime/index.ts'),'export const value=1;');
  expect(()=>outputShardLines(root)).toThrow('built output missing');
 }finally{rmSync(root,{recursive:true,force:true});}
});
