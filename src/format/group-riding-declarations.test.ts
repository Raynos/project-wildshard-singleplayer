// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining contracts without compiled group products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten variant/default consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ['groupBrains','riding','heldFinishes'])test(`${name} emits bounded isolated data contracts`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{
  fileName:`${name}.ts`,reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(25_000);
 expect(emitted.outputText).toContain('v.GenericSchema<');
});

test('group variants, exact-optional riding descriptions and cosmetic ids keep their contracts',()=>{
 const consumer=resolve('src/format/t4-group-riding-consumer.ts');
 let source=`import * as v from 'valibot';
import {PackGroupSchema,HerdGroupSchema,StalkerGroupSchema,GrazerGroupSchema,GroupGuestBindingSchema,GUARDED_STALLION_STATES,HERD_DRIVE_PLAN_FIELDS,type ShardPackGroup,type ShardGroupBrain} from './groupBrains';
import type {RidingControls,PageRidingPresetRows} from './riding';
import type {CosmeticFinishesRows} from './heldFinishes';
export const families=v.variant('kind',[PackGroupSchema,HerdGroupSchema,StalkerGroupSchema,GrazerGroupSchema]);
export const guest=v.object({...GroupGuestBindingSchema.entries});
export const states:8=GUARDED_STALLION_STATES.length;
export const first:'kind'=HERD_DRIVE_PLAN_FIELDS[0];
export const cadence:ShardPackGroup['thinkDivisor']=6;
export function pattern(row:ShardGroupBrain):'herd'|'pack'|undefined{if(row.kind==='stalker'||row.kind==='grazer')return row.pattern;return undefined;}
declare const controls:Omit<RidingControls,'describe'>;
export const absent:RidingControls=controls;
declare const preset:PageRidingPresetRows;
export const ride:'ride'=preset.mode.id;
export const effect:CosmeticFinishesRows['skins'][number]['effect']='effect.blue';
export const grant:CosmeticFinishesRows['skins'][number]['grant']='owned.blue';
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual group/riding consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const changedCadence:ShardPackGroup['thinkDivisor']=5;
export const wrongEffect:CosmeticFinishesRows['skins'][number]['effect']='plain';
export const presentUndefined:RidingControls={...controls,describe:undefined};`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2322);
 expect(refused).toContain(2375);
});
