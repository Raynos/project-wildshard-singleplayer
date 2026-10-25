// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the defining schema declarations without products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten type-contract consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ['worldSceneWeld','forestPage','eliteEntryRows'])test(`${name} emits bounded isolated data declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{
  fileName:`${name}.ts`,reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(50_000);
 expect(emitted.outputText).not.toContain('VariantSchema');
 expect(emitted.outputText).toContain('v.GenericSchema<');
});

test('weld entries retain omit, exact optional inputs and required admitted defaults',()=>{
 const consumer=resolve('src/format/t4-weld-page-consumer.ts');
 let source=`import * as v from 'valibot';
import {WorldSceneWeldMaterialSchema,type WorldSceneDistanceRows,type WorldSceneDistanceRowsInput} from './worldSceneWeld';
import type {ForestPageRows} from './forestPage';
import {ELITE_BODY_COLUMNS,type EliteEntryRows} from './eliteEntryRows';
const mapped=v.omit(WorldSceneWeldMaterialSchema,['id']);
declare const material:v.InferOutput<typeof mapped>;
export const kind:'standard'|'basic'=material.kind;
export const sky:boolean=material.sky;
export const fog:boolean|undefined=material.fog;
export const authored:WorldSceneDistanceRowsInput={knob:'view.range'};
export const admitted:WorldSceneDistanceRows={knob:'view.range',multiply:1,add:0};
declare const forest:ForestPageRows;
export const size:number=forest.ground.cells.size;
declare const entry:EliteEntryRows;
export const version:1=entry.version;
export const firstColumn:'playerCrouched'=ELITE_BODY_COLUMNS[0].name;
export const columnCount:6=ELITE_BODY_COLUMNS.length;
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual weld/page consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const missingDefaults:WorldSceneDistanceRows={knob:'view.range'};
export const omittedId:string=material.id;
export const wrongColumnCount:5=ELITE_BODY_COLUMNS.length;
export const wrongVersion:EliteEntryRows['version']=2;`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2322);
 expect(refused).toContain(2339);
});
