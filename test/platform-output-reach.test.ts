import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable output/reach fixture, never a repository export.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,unlinkSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confined fixture paths.
import {join,dirname} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Small temporary test repository.
import {tmpdir} from 'node:os';
import {outputShardLines,sourceProgressLines} from '../scripts/shard-platform.mjs';
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

it('attributes declared moves and decisions to their defining sim hosts',()=>{
 const roots=sectionHostImports([{name:'actors/moves'},{name:'sim/scripts'}]);
 expect(roots).toContain('engine/ai/moves');
 expect(roots).toContain('ActorMoveRunner');
 expect(roots).toContain('format/actorMoves');
 expect(roots).toContain('engine/script/decision');
 expect(roots).toContain('DecisionHost');
 expect(roots).toContain('format/decisionScripts');
});


it('keeps a data-selected native plan as a real user after its wrapper is removed',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-native-plan-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  put('src/game/package.json',JSON.stringify({name:'@wildshard/game',exports:{'./plugin/simulation':'./plugin/simulation.ts'}}));
  put('src/game/plugin/simulation.ts','export function prepareRuntimePlan() { return 1; }\nexport function unrelated() { return 2; }');
  put('src/game/shardfile/nativePlan.ts',"import {prepareRuntimePlan} from '../plugin/simulation'; export function prepareProductRuntimePlan() { return prepareRuntimePlan(); }");
  platformOutput(root,'sunscar-dunes',{'runtime/index.ts':"import {prepareRuntimePlan} from '@wildshard/game/plugin/simulation'; export const plan=prepareRuntimePlan();"});
  platformOutput(root,'far-reach',{'runtime/index.ts':'export const view=1;'});
  const before=sourceProgressLines(root)['sunscar-dunes']?.customLines;
  platformOutput(root,'far-reach',{'runtime/index.ts':'export const view=1;'},{'sim/runtime-plan':'{}'});
  expect(before).toBe(3);
  expect(sourceProgressLines(root)['sunscar-dunes']?.customLines).toBe(1);
  expect(outputShardLines(root)['sunscar-dunes']?.conversion.gameSystemAttribution.exports.map(row=>row.name)).not.toContain('prepareRuntimePlan');
  expect(sectionHostImports([{name:'sim/runtime-plan'}])).toContain('prepareProductRuntimePlan');
  const index=join(root,'out/far-reach/shard.json');
  unlinkSync(index);
  expect(()=>sourceProgressLines(root)).toThrow('far-reach: section inventory missing');
  platformOutput(root,'far-reach',{'runtime/index.ts':'export const view=1;'},{'sim/runtime-plan':'{}'});
  expect(sourceProgressLines(root)['sunscar-dunes']?.customLines).toBe(1);
  put('out/far-reach/sections/sim/runtime-plan.json','{"corrupt":true}');
  expect(()=>sourceProgressLines(root)).toThrow('section hash/size mismatch');
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('G467 excludes generator-only reach but follows runtime imports into generators',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-generator-reach-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  put('src/sdk/package.json',JSON.stringify({name:'@wildshard/sdk',exports:{'./compiler':'./compiler.ts','./motion':'./motion.ts'}}));
  put('src/sdk/compiler.ts','export function compile() { return 1; }');
  put('src/sdk/motion.ts','export function move() { return 2; }');
  platformOutput(root,'pine-hollow',{'runtime/index.ts':"import {move} from '@wildshard/sdk/motion'; export const live=move();"});
  platformOutput(root,'driftwood-isle',{'runtime/index.ts':'export const live=1;'});
  put('src/shards/driftwood-isle/generators/author.ts',"import {compile} from '@wildshard/sdk/compiler'; import {move} from '@wildshard/sdk/motion'; export const baked=[compile(),move()];");
  const rows=sourceProgressLines(root);
  expect(rows['driftwood-isle']?.customLines).toBe(1);
  // A build-only user cannot share Pine's runtime host.
  expect(rows['pine-hollow']?.customLines).toBe(2);
  platformOutput(root,'driftwood-isle',{'runtime/index.ts':"import {baked} from '../generators/author'; export const live=baked;"});
  // Crossing back into authoring code is real runtime reach, still charged.
  expect(sourceProgressLines(root)['driftwood-isle']?.customLines).toBe(2);
 }finally{rmSync(root,{recursive:true,force:true});}
});
