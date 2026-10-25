// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten cross-schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ['decisionScripts','eliteFeature','namedJsonContracts','spawnScripts','bakedTiles','runtime','roamingBossProjection','contracts','questStory','buildings','props','viewProgram','flyers','moverMotion'])test(`${name} emits bounded isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{
  fileName:`${name}.ts`,reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(20_000);
});

test('world consumers retain nested identities, variant metadata and authored defaults',()=>{
 const consumer=resolve('src/format/t4-declarative-world-consumer.ts');
 let source=`import * as v from 'valibot';
import {DecisionScriptsSchema,type DecisionScriptRow} from './decisionScripts';
import {EliteFeatureSchema} from './eliteFeature';
import {ReturnProgramSchema,HEADLESS_ASSEMBLY_JSON_SCHEMA} from './namedJsonContracts';
import type {SpawnScriptRowData} from './spawnScripts';
import type {BakedTilesRow,BakedPlan} from './bakedTiles';
import {LegacyRuntimeSchema,ClientPlanRuntimeSchema,type RuntimeDeclaration} from './runtime';
import {ContractBoardPageSchema,type ContractReward} from './contracts';
import {AdventureContentSchema,QuestStorySchema,PersistedQuestPageSchema} from './questStory';
import type {ViewProgramRows} from './viewProgram';
import {DiverSchema,type OrbitDiverRowsInput} from './flyers';
import {MOVER_DRIVER_MODULES} from './moverMotion';
export const script=DecisionScriptsSchema.pipe[2].item;
export const omitEmpty=DecisionScriptsSchema.pipe[7];
declare const decision:DecisionScriptRow;
export const actor:string|undefined=decision.actors['actor'];
export const definition=EliteFeatureSchema.entries.fights.pipe[0].item.entries.def;
export const programme=v.object({...ReturnProgramSchema.entries});
export const source=v.omit(LegacyRuntimeSchema.pipe[0],['spawns']);
export const compiled=v.omit(ClientPlanRuntimeSchema.pipe[0],['spawns']);
export function entry(row:RuntimeDeclaration):string{return 'kind' in row?row.kind:row.entry;}
export const board=v.omit(ContractBoardPageSchema,['contracts','panel','store']);
export const store=ContractBoardPageSchema.entries.store;
export const poi=AdventureContentSchema.entries.places.item.entries.at.entries.poi;
export const bench=QuestStorySchema.entries.bench;
export const page=v.omit(PersistedQuestPageSchema,['capture']);
export const brains=v.variant('kind',[DiverSchema,v.strictObject({kind:v.literal('other')})]);
declare const orbit:Omit<OrbitDiverRowsInput,'thinkDivisor'>;
export const defaultThink:OrbitDiverRowsInput=orbit;
export const release:SpawnScriptRowData['slots'][number]['release']='retain';
export const tiles:BakedTilesRow['tiles']={phone:'phone',desktop:'desktop'};
export const indices:BakedPlan['families'][number]['indices']=[0,1];
export const rootKind:string=HEADLESS_ASSEMBLY_JSON_SCHEMA.type;
export const reward:ContractReward['items'][number]={id:'item',n:1};
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual declarative world consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const wrongRelease:SpawnScriptRowData['slots'][number]['release']='forget';
export const wrongIndices:BakedPlan['families'][number]['indices']=['zero'];
export const wrongReward:ContractReward['items'][number]={id:'item',n:'one'};
declare const view:Omit<ViewProgramRows,'before'>;
export const missingBefore:ViewProgramRows=view;
MOVER_DRIVER_MODULES.ride='different';`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2322);
 expect(refused).toContain(2741);
 expect(refused).toContain(2540);
});
