import {expect,it,vi} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Disposable output/reach fixture, never a repository export.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,unlinkSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confined fixture paths.
import {join,dirname} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Small temporary test repository.
import {tmpdir} from 'node:os';
import {outputCensus,outputShardLines,sourceProgressLines,sourceProgressInventory} from '../scripts/shard-platform.mjs';
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

it('attributes body sections to defining hosts without a native barrel adapter',()=>{
 const roots=sectionHostImports([{name:'sim/bodies'},{name:'sim/bodies'}]);
 expect(roots.split('\n')).toEqual([
  "import { DeclaredBodyOpsSchema as host0 } from '../../src/format/bodySlots'; void host0;",
  "import { DeclaredBodyOps as host1 } from '../../src/game/quest/bodyOps'; void host1;",
 ]);
 expect(roots).not.toContain('nativeBodyScripts');
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


it('retains only checked proof-map imports after a handwritten catalogue is deleted',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-native-proof-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  put('src/game/package.json',JSON.stringify({name:'@wildshard/game',exports:{'./proof':'./proof.ts'}}));
  put('src/game/proof.ts','export function admitted() { return 1; }\nexport function unrelated() { return 2; }');
  platformOutput(root,'pine-hollow',{'runtime/index.ts':"import {admitted,unrelated} from '@wildshard/game/proof'; export const value=[admitted(),unrelated()];"});
  platformOutput(root,'driftwood-isle',{'runtime/index.ts':'export const value=1;'});
  put('src/shards/driftwood-isle/data/headlessAssembly.json',JSON.stringify({version:1,modules:{'src/game/proof':['admitted']}}));
  const catalogue='src/shards/driftwood-isle/boot/headlessModules.ts';
  put(catalogue,"import {admitted} from '@wildshard/game/proof'; export const headlessModules={'src/game/proof':{admitted}};");
  const before=sourceProgressLines(root)['pine-hollow']?.customLines;
  unlinkSync(join(root,catalogue));
  expect(before).toBe(2); // Pine's own line and the undeclared export stay charged.
  expect(sourceProgressLines(root)['pine-hollow']?.customLines).toBe(before);
  // Product/runtime census remains independent of proof-only capabilities.
  expect(outputShardLines(root)['pine-hollow']?.conversion.customRuntimeLines).toBe(3);
  put('src/shards/driftwood-isle/data/headlessAssembly.json',JSON.stringify({version:1,modules:{'src/game/proof':['missing']}}));
  expect(()=>sourceProgressLines(root)).toThrow('Missing headless export');
 }finally{rmSync(root,{recursive:true,force:true});}
});


it('shares syntax facts without merging source and output attribution',()=>{
 const root=mkdtempSync(join('tmp/','platform-shared-census-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  vi.stubEnv('WS_SHARD_PARSE_CACHE',join(root,'.cache/parse'));
  put('src/game/package.json',JSON.stringify({name:'@wildshard/game',exports:{'./shared':'./shared.ts'}}));
  put('src/game/shared.ts','export function shared() { return 1; }');
  put('docs/ENGINE.md','game/shared');
  put('docs/plans/shard-platform/decisions.md','| G475 | approved toon |');
  put('lint/platform-pending-users.json',JSON.stringify({schema:'platform-pending-users/1',entries:[{
   module:'src/game/shared.ts',export:'shared',documentation:'docs/ENGINE.md',
   approvedFeature:{name:'toon look host',decision:{path:'docs/plans/shard-platform/decisions.md',row:'G475'}}
  }]}));
  platformOutput(root,'pine-hollow',{'runtime/index.ts':"import {shared} from '@wildshard/game/shared'; export const value=shared();"});
  platformOutput(root,'driftwood-isle',{'runtime/index.ts':'export const value=1;'});
  put('src/shards/driftwood-isle/data/authored.ts',"import {shared} from '@wildshard/game/shared'; export const value=shared();");
  const expected={measures:outputShardLines(root,true),inventory:sourceProgressInventory(root),source:sourceProgressLines(root)};
  expect(outputCensus(root)).toEqual(expected);
  put('src/game/shared.ts','export function shared() {\n return 2;\n}');
  const changed=outputCensus(root);
  expect(changed.measures).toEqual(outputShardLines(root,true));
  expect(changed.source).toEqual(sourceProgressLines(root));
  expect(changed.measures).not.toEqual(expected.measures);
  // A new report must validate current policy and exports even with a warm disk cache.
  put('docs/plans/shard-platform/decisions.md','| G476 | unrelated |');
  expect(()=>outputCensus(root)).toThrow('Missing platform feature decision');
  put('docs/plans/shard-platform/decisions.md','| G475 | approved toon |');
  put('src/game/shared.ts','export function renamed() { return 2; }');
  expect(()=>outputCensus(root)).toThrow('Missing pending platform export');
 }finally{vi.unstubAllEnvs();rmSync(root,{recursive:true,force:true});}
});


it.each([
 ["import { privateWork as defining } from '@wildshard/game/implementation'; export const forwarded: typeof defining = defining;", "import { forwarded as previous } from './inner'; const local = previous; export const chosen = local;"],
 ["export { privateWork as forwarded } from '@wildshard/game/implementation';", "export { forwarded as chosen } from './inner';"],
 ["import * as defining from '@wildshard/game/implementation'; export const forwarded = defining.privateWork;", "import * as previous from './inner'; export const chosen = previous.forwarded;"],
 ["import { privateWork as defining } from '@wildshard/game/implementation'; export default defining;", "import previous from './inner'; export const chosen = previous;"],
])('follows SDK forwarding chains to the same defining declarations (%s)',(inner,outer)=>{
 const root=mkdtempSync(join('tmp/','platform-forwarding-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  put('src/game/package.json',JSON.stringify({name:'@wildshard/game',exports:{'./implementation':'./implementation.ts'}}));
  put('src/sdk/package.json',JSON.stringify({name:'@wildshard/sdk',exports:{'./outer':'./outer.ts'}}));
  put('src/game/implementation.ts','function helper() { return 1; }\nexport function privateWork() { return helper(); }\nexport function sharedWork() { return 2; }\nexport function unused() { return 3; }');
  put('src/sdk/inner.ts',inner);put('src/sdk/outer.ts',outer);
  platformOutput(root,'pine-hollow',{'runtime/index.ts':"import {privateWork} from '@wildshard/game/implementation'; export const value=privateWork();"});
  platformOutput(root,'driftwood-isle',{'runtime/index.ts':"import {sharedWork} from '@wildshard/game/implementation'; export const value=sharedWork();"});
  const defining=()=>outputShardLines(root,true)['pine-hollow']?.customSources?.filter(row=>row.path==='src/game/implementation.ts');
  const direct=defining();
  expect(direct?.map(row=>row.name)).toEqual(['helper','privateWork']);
  platformOutput(root,'pine-hollow',{'runtime/index.ts':"import {chosen} from '@wildshard/sdk/outer'; export const value=chosen();"});
  expect(defining()).toEqual(direct);
  // A genuine second shard using the same forwarded binding shares it;
  // forwarding modules themselves never manufacture another shard user.
  platformOutput(root,'driftwood-isle',{'runtime/index.ts':"import {chosen} from '@wildshard/sdk/outer'; import {sharedWork} from '@wildshard/game/implementation'; export const value=[chosen(),sharedWork()];"});
  expect(defining()).toEqual([]);
 }finally{rmSync(root,{recursive:true,force:true});}
});
