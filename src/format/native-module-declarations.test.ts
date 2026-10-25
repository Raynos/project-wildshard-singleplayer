// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining contracts without compiled products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten contract consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ['clientNative','questHost','questInteractions','heldMelee','heldArms','toonLook','plumbing','scriptContract','speciesLooks'])test(`${name} emits bounded isolated data declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{
  fileName:`${name}.ts`,reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(30_000);
});

test('native variants, defaults, module revisions and readonly look contracts stay precise',()=>{
 const consumer=resolve('src/format/t4-native-module-consumer.ts');
 let source=`import * as v from 'valibot';
import {ClientPlayerEnterSchema,ClientHeldMeleeSchema,ClientSpeciesProgramSchema,ClientQuestPageSchema,ClientPopulationSchema,ClientBossTelegraphSchema,ClientHeldBossSchema,ClientSpawnedBossSchema,type ClientHeldMeleeRowsInput,type ClientHeldMeleeRows} from './clientNative';
import {ToonArmsLookSchema,HeldArmsSchema} from './heldArms';
import {ScriptV2ContractSchema,ViewModuleSchema,type ScriptV2ContractRows} from './scriptContract';
import {SCRIPT_V2_REVISIONS} from './scriptAdmissionV2';
import type {PolearmRows,ArcWeaponRows} from './heldMelee';
import type {NativeQuestPropsRowsInput,NativeQuestPropsRows} from './questInteractions';
import type {QuestHostRow} from './questHost';
import {PlumbingSchema} from './plumbing';
import {TOON_DAY_PRESET,type ToonDayRow} from './toonLook';
import type {HullSpeciesRows} from './speciesLooks';
export const variants=v.variant('kind',[ClientPlayerEnterSchema,ClientHeldMeleeSchema,ClientSpeciesProgramSchema,ClientQuestPageSchema,ClientPopulationSchema,ClientBossTelegraphSchema,ClientHeldBossSchema,ClientSpawnedBossSchema]);
export const authored:ClientHeldMeleeRowsInput={kind:'held.melee',item:'sword',stage:'kit',targets:'scan'};
export const admitted:ClientHeldMeleeRows=v.parse(ClientHeldMeleeSchema,authored);
export const composed:boolean=admitted.composed;
export const look=v.object({...ToonArmsLookSchema.entries});
export const held=v.parse(HeldArmsSchema.options[0],{});
export const weaponName:string|undefined=held.weapons[0]?.item;
export const toolCheck=HeldArmsSchema.options[1].entries.tools.pipe[2];
export const plumbingInput=PlumbingSchema.pipe[2].entries.input.pipe[0].item.entries.id;
export const plumbingAsk=PlumbingSchema.pipe[2].entries.debug.pipe[0].item.entries.ask;
export const namespaceRegex=PlumbingSchema.pipe[2].entries.namespace.pipe[1];
export const reviewRegex=PlumbingSchema.pipe[2].entries.debug.pipe[0].item.entries.reviewBy.pipe[1];
export const plumbingCheck=PlumbingSchema.pipe[3];
export const module=v.object({...ViewModuleSchema.entries});
export const withoutLane=v.omit(ScriptV2ContractSchema,['lane']);
export const compiler:ScriptV2ContractRows['compilerRevision']=SCRIPT_V2_REVISIONS.compiler;
export const abi:ScriptV2ContractRows['abi']=2;
export const cue:PolearmRows['profile']['cues']['fire']='cue.fire';
export const weapon:ArcWeaponRows['item']='weapon.sword';
export const props:NativeQuestPropsRowsInput={floors:[],gates:[]};
declare const host:QuestHostRow;
export const raw:Record<string,unknown>=host;
export const light:'colour'=TOON_DAY_PRESET.light;
declare const day:ToonDayRow;
export const start:number=day.start;
export const clips:HullSpeciesRows['rigContract']['clips']=[];
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual native/module consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const missingDefault:ClientHeldMeleeRows={kind:'held.melee',item:'sword',stage:'kit',targets:'scan'};
export const missingArrays:NativeQuestPropsRows={floors:[],gates:[]};
export const wrongCue:PolearmRows['profile']['cues']['fire']='fire';
export const wrongWeapon:ArcWeaponRows['item']='sword';
export const wrongAbi:ScriptV2ContractRows['abi']=1;
day.start=0;
export const unknownHost:QuestHostRow['unknownField']='no';
export const wrongClips:HullSpeciesRows['rigContract']['clips']=['walk'];`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2741);
 expect(refused).toContain(2739);
 expect(refused).toContain(2322);
 expect(refused).toContain(2540);
 expect(refused).toContain(2339);
});
