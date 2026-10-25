// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without authored product generation.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten manifest metadata consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

test('manifest metadata emits bounded isolated declarations without validator expansion',()=>{
 const emitted=ts.transpileDeclaration(readFileSync('src/format/minimap.ts','utf8'),{
  fileName:'minimap.ts',reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(40_000);
 expect(emitted.outputText).toContain('readonly captureProbes: v.ExactOptionalSchema<v.ArraySchema<');
 expect(emitted.outputText).not.toContain('ObjectWithRestSchema');
});

test('manifest consumers retain sky pick and optional capture-probe item metadata',()=>{
 const consumer=resolve('src/format/t4-manifest-metadata-consumer.ts');
 let source=`import * as v from 'valibot';
import {ManifestMetadataSchema,type ManifestMetadata,type ManifestMetadataInput,type FixedForestQueriesRows,type CapturePoseRows} from './minimap';
export const sky=v.pick(ManifestMetadataSchema,['sky','grade','atmosphere']);
export const probe=ManifestMetadataSchema.entries.captureProbes.wrapped.item;
declare const metadata:ManifestMetadata;
export const authored:ManifestMetadataInput=metadata;
export const raw:Record<string,unknown>=metadata;
export const controls=v.parse(sky,{sky:metadata.sky,grade:metadata.grade,atmosphere:metadata.atmosphere});
export const brightness:number=controls.grade.brightness;
export const sample:v.InferOutput<typeof probe>={name:'site',x:0,z:0,yaw:0,pitch:0};
export const queries:FixedForestQueriesRows={platform:'fixed',density:1};
export const poses:CapturePoseRows={site:{eye:[0,0,0],yaw:0,pitch:0,mockup:'site',frame:'site'}};
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual manifest metadata consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const missingProbe:v.InferOutput<typeof probe>={name:'site',x:0,z:0};
export const unexpected:ManifestMetadata['unknownField']='no';
export const badPlatform:FixedForestQueriesRows={platform:'other',density:1};
export const badPoses:CapturePoseRows={site:{eye:[0,0],yaw:0,pitch:0,mockup:'site',frame:'site'}};`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2739);
 expect(refused).toContain(2339);
 expect(refused).toContain(2322);
});
