import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated attribution fixture sources.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All paths stay within the fixture root.
import {dirname,join,resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Small disposable fixture, never a repository export.
import {tmpdir} from 'node:os';
import {checkShares,shardLines,sourceProgressInventory,codeLines} from '../scripts/shard-platform.mjs';
import {platformOutput} from './fixtures/platformOutputs';
import {legacyLineBasis} from './fixtures/legacyLineBasis';
import {authoredManifestSource} from '../scripts/authored-manifest.mjs';
import generatedSources from '../scripts/source-generation-outputs.json' with {type:'json'};

it('excludes only the G456 build-tool paths from whole-module charges',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-build-tools-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  put('src/sdk/package.json',JSON.stringify({name:'@wildshard/sdk',exports:{'./bake/tool':'./bake/tool.ts','./project':'./project.ts','./bakeTools':'./bakeTools.ts','./projectOther':'./projectOther.ts'}}));
  put('src/sdk/bake/tool.ts',"import {helper} from '../runtimeHelper'; export const bake=helper;");
  put('src/sdk/project.ts','export const project=1;');
  put('src/sdk/bakeTools.ts','export const runtimeTool=1;');
  put('src/sdk/projectOther.ts','export const other=1;');
  put('src/sdk/runtimeHelper.ts','export const helper=1;');
  platformOutput(root,'pine-hollow',{'runtime/index.ts':"import {bake} from '@wildshard/sdk/bake/tool'; import {project} from '@wildshard/sdk/project'; import {runtimeTool} from '@wildshard/sdk/bakeTools'; import {other} from '@wildshard/sdk/projectOther'; export const live=[bake,project,runtimeTool,other];"});
  expect(shardLines(root)['pine-hollow']?.conversion.gameSystemAttribution.modules.map(row=>row.path)).toEqual(['src/sdk/bakeTools.ts','src/sdk/projectOther.ts','src/sdk/runtimeHelper.ts']);
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('also excludes sole declarations inside shared build modules, retaining runtime SDK declarations',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-build-exports-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  put('src/sdk/package.json',JSON.stringify({name:'@wildshard/sdk',exports:{'./bake/tool':'./bake/tool.ts','./project':'./project.ts','./runtime':'./runtime.ts'}}));
  for(const path of ['src/sdk/bake/tool.ts','src/sdk/project.ts','src/sdk/runtime.ts'])put(path,'export const first=1;\nexport const second=2;');
  for(const [slug,name]of [['pine-hollow','first'],['driftwood-isle','second']] as const)platformOutput(root,slug,{'runtime/index.ts':`import {${name} as bake} from '@wildshard/sdk/bake/tool'; import {${name} as project} from '@wildshard/sdk/project'; import {${name} as runtime} from '@wildshard/sdk/runtime'; export const live=[bake,project,runtime];`});
  const rows=shardLines(root);
  expect(rows['pine-hollow']?.conversion.gameSystemAttribution.exports).toEqual([{path:'src/sdk/runtime.ts',name:'first',exported:true,lines:1}]);
  expect(rows['driftwood-isle']?.conversion.gameSystemAttribution.exports).toEqual([{path:'src/sdk/runtime.ts',name:'second',exported:true,lines:1}]);
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('reports the AS tenth without adding its excess to custom TS or enforcing it',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-as-budget-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  platformOutput(root,'pine-hollow',{'runtime/index.ts':'export const LIVE=1;'});
  put('src/shards/pine-hollow/behaviour/brain.as','export function step(): i32 {\n return 1;\n}');
  put('src/shards/pine-hollow-legacy/manifest.ts','export default {};');
  put('src/shards/pine-hollow-legacy/plugin.ts',Array.from({length:9},(_,i)=>`export const V${i}=${i};`).join('\n'));
  put('lint/legacy-shards.json',JSON.stringify({version:1,sealed:true,shards:{'pine-hollow-legacy':{primary:'pine-hollow',source:'a'.repeat(40),files:{'manifest.ts':'b'.repeat(64),'plugin.ts':'c'.repeat(64)}}}}));
  legacyLineBasis(root,'pine-hollow',{'manifest.ts':'export default {};','plugin.ts':Array.from({length:9},(_,i)=>`export const V${i}=${i};`).join('\n')});
  const row=shardLines(root)['pine-hollow'];
  if(row===undefined)throw new Error('Missing fixture measure');
  expect(row.conversion.customRuntimeLines).toBe(1);
  expect(row.assemblyScriptBudget).toEqual({ceiling:1,share:.3,passed:false,enforcement:'report-only'});
  expect(checkShares({baseline:{'pine-hollow':10},enforced:{'pine-hollow':2}},{'pine-hollow':row})).toEqual([]);
  platformOutput(root,'pastel-plain',{'runtime/index.ts':'export const LIVE=1;'});
  expect(shardLines(root)['pastel-plain']?.assemblyScriptBudget).toEqual({ceiling:null,share:null,passed:null,enforcement:'report-only'});
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('never roots build-only data, generators or project config as runtime users',()=>{
 const root=mkdtempSync(join('tmp/','platform-build-roots-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  put('src/game/package.json',JSON.stringify({name:'@wildshard/game',exports:{'./painter':'./painter.ts'}}));
  put('src/game/painter.ts','export function paint() { return 1; }');
  platformOutput(root,'pine-hollow',{'runtime/index.ts':'export const live=1;'});
  for(const path of ['data/table.ts','generators/atlas.ts','shard.config.ts']){
   put(`src/shards/pine-hollow/${path}`,"import {paint} from '@wildshard/game/painter'; export const baked=paint();");
  }
  const row=sourceProgressInventory(root)['pine-hollow'];
  expect(row?.conversion.gameSystemAttribution.lines).toBe(0);
  expect(row?.customSources?.some(source=>source.path==='src/game/painter.ts')).toBe(false);
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('keeps a sole runtime user charged until a second runtime reaches the generator',()=>{
 const root=mkdtempSync(join('tmp/','platform-generator-users-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  put('src/game/package.json',JSON.stringify({name:'@wildshard/game',exports:{'./shared':'./shared.ts'}}));
  put('src/game/shared.ts','export function live() { return 1; }\nexport function other() { return 2; }');
  platformOutput(root,'pine-hollow',{'runtime/index.ts':"import {live} from '@wildshard/game/shared'; export const value=live();"});
  platformOutput(root,'driftwood-isle',{'runtime/index.ts':"import {other} from '@wildshard/game/shared'; export const value=other();"});
  put('src/shards/driftwood-isle/data/bridge.ts',"import {baked} from '../generators/atlas'; export const value=baked;");
  put('src/shards/driftwood-isle/generators/atlas.ts',"import {live} from '@wildshard/game/shared';\nexport const baked=live();");
  const before=sourceProgressInventory(root);
  expect(before['pine-hollow']?.conversion.gameSystemAttribution.exports).toEqual([{path:'src/game/shared.ts',name:'live',exported:true,lines:1}]);
  expect(before['driftwood-isle']?.customSources?.some(source=>source.path.endsWith('generators/atlas.ts'))).toBe(false);
  put('src/shards/driftwood-isle/runtime/index.ts',"import {other} from '@wildshard/game/shared'; export async function value() { return [other(),(await import('../data/bridge')).value]; }");
  const after=sourceProgressInventory(root);
  expect(after['pine-hollow']?.conversion.gameSystemAttribution.exports).toEqual([]);
  expect(after['driftwood-isle']?.customSources).toContainEqual(expect.objectContaining({path:'src/shards/driftwood-isle/generators/atlas.ts',kind:'runtime-ts',lines:2}));
 }finally{rmSync(root,{recursive:true,force:true});}
});


it.each(['blender-template','nine-dragon-stack','ink-cel-valley'])('registers %s discovery as generated without excluding its authored data',(slug)=>{
 const root=mkdtempSync(join('tmp/','platform-blender-discovery-'));
 const put=(path:string,source:string):void=>{const file=join(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,source);};
 try{
  platformOutput(root,slug);
  const discovery=slug==='ink-cel-valley'?authoredManifestSource(resolve('.'),slug):'export const generated=1;';
  put(`src/shards/${slug}/discovery.generated.ts`,discovery);
  put(`src/shards/${slug}/data/authored.ts`,'export const authored=1;');
  expect(sourceProgressInventory(root)[slug]?.conversion.customRuntimeLines).toBe(1+codeLines(discovery));
  put('scripts/source-generation-outputs.json',JSON.stringify(generatedSources));
  const row=sourceProgressInventory(root)[slug];
  expect(row?.conversion.customRuntimeLines).toBe(1);
  expect(row?.customSources?.map(source=>source.path)).toEqual([`src/shards/${slug}/data/authored.ts`]);
 }finally{rmSync(root,{recursive:true,force:true});}
});
