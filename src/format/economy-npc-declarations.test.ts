// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten metadata consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ['collectionDisplay','npcs','lootBag','lootEconomy'])test(`${name} emits bounded isolated data contracts`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{
  fileName:`${name}.ts`,reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(16_000);
 expect(emitted.outputText).toContain('v.GenericSchema<');
});

test('collection cards, economy grant entries and NPC talk unions retain their contracts',()=>{
 const consumer=resolve('src/format/t4-economy-npc-consumer.ts');
 let source=`import * as v from 'valibot';
import {CollectionModelSchema,type CollectionKeepsakes} from './collectionDisplay';
import {LootEconomySchema,type LootEconomy} from './lootEconomy';
import type {LootBagRows} from './lootBag';
import type {QuestNpcTalkBinding,NpcMotion,QuestPageTalksRows} from './npcs';
export const card=v.pick(CollectionModelSchema,['id','name','file','surface','defaults','variants']);
export const grants=v.object({player:LootEconomySchema.entries.grants.entries.player,worn:LootEconomySchema.entries.grants.entries.worn,weapons:LootEconomySchema.entries.grants.entries.weapons});
declare const economy:LootEconomy;
export const native:v.InferOutput<typeof grants>=economy.grants;
declare const bag:LootBagRows;
export const flags:string[]=bag.progression.flags;
declare const keepsakes:CollectionKeepsakes;
export const kind:'count'|'trophies'|undefined=keepsakes.placements[0]?.role;
declare const motion:NpcMotion;
export const swing:number=motion.rest.lift[0];
declare const talk:QuestNpcTalkBinding;
export const talkKind:'posed-talk'=talk.kind;
export function trader(rows:QuestPageTalksRows):string|undefined{const call=rows.calls.first;return call?.kind==='trader'?call.trader:undefined;}
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual economy/NPC consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const badRole:CollectionKeepsakes['placements'][number]['role']='unknown';
export const badKind:QuestNpcTalkBinding['kind']='talk';
export const badGrant:v.InferOutput<typeof grants>['player'][number]={id:'bad',key:'x'};`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2322);
});
