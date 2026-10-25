// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated encounter products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual metadata consumer without a source file.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

test('encounter declarations bound validator metadata while retaining admitted data',()=>{
 const emitted=ts.transpileDeclaration(readFileSync('src/format/encounterRows.ts','utf8'),{
  fileName:'encounterRows.ts',reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(28_000);
 expect(emitted.outputText).not.toContain('VariantSchema');
 expect(emitted.outputText).toContain('readonly puffs: v.StrictObjectSchema');
});

test('arena consumers retain schedule omit and nested cloud-puff entries',()=>{
 const consumer=resolve('src/format/t4-encounter-consumer.ts');
 let source=`import * as v from 'valibot';
import {EncounterScheduleSchema,CloudBodySchema,type EncounterSitesRowsInput,type EncounterSitesRows,type TimedEncountersRows,type EncounterMaterialRows} from './encounterRows';
export const frame=v.omit(EncounterScheduleSchema,['signal']);
export const body=v.omit(CloudBodySchema,['poses','puffs']);
export const puffs=v.omit(CloudBodySchema.entries.puffs,['rows']);
export const rows=CloudBodySchema.entries.puffs.entries.rows;
declare const cloud:v.InferOutput<typeof rows>;
export const radius:number|undefined=cloud[0]?.r;
declare const site:EncounterSitesRows;
export const tilt:number|undefined=site.sites[0]?.tilt;
export const authoredSite:EncounterSitesRowsInput['sites'][number]={x:0,z:0,yaw:0,scale:1};
declare const timed:TimedEncountersRows;
export const extra:unknown=timed.extra;
export function colour(row:EncounterMaterialRows):number|[number,number,number]{return row.colour;}
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual encounter consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const missingDefault:EncounterSitesRows['sites'][number]={x:0,z:0,yaw:0,scale:1};
export const removed:v.InferOutput<typeof frame>['signal']='step';
export const badMaterial:EncounterMaterialRows={kind:'unknown',colour:0};`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2741);
 expect(refused).toContain(2339);
 expect(refused).toContain(2322);
});
