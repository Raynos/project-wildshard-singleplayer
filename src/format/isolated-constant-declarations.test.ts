// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["materialGraph", "contentBounds", "wireLimits", "admissionLimits", "scriptAbiV1", "scriptAbi", "stillImage"])test(`${name} emits isolated constant declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{
  fileName:`${name}.ts`,reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(name==='materialGraph'?24_000:8_000);
});

test('format constants retain literal, readonly and function signatures',()=>{
 const consumer=resolve('src/format/t4-constant-consumer.ts');
 let source="import {GRAPH_FOG_ID,GRAPH_ATTRIBUTE_NAME,GRAPH_ADMISSION_LIMITS,graphAdmissionErrors} from './materialGraph';\nimport {CONTENT_CAPS,MEMORY_GATES,crossroadsConfig,textureMipBytes} from './contentBounds';\nimport {WIRE_CELL,WIRE_TILE_SIZES,CLIENT_SCRIPT_LIMITS} from './wireLimits';\nimport {SHARDFILE_ADMISSION_LIMITS} from './admissionLimits';\nimport {SCRIPT_V1_EVENTS,SCRIPT_V1_LAYOUT,type ScriptV1EventName} from './scriptAbiV1';\nimport {SCRIPT_ABI} from './scriptAbi';\nimport {IMAGE_ASSET_LIMITS,STILL_IMAGE_LIMITS} from './stillImage';\nexport const regex:RegExp=GRAPH_FOG_ID;\nexport const attribute:RegExp=GRAPH_ATTRIBUTE_NAME;\nexport const bytes:64000=GRAPH_ADMISSION_LIMITS.bytes;\nexport const graphErrors:(input:unknown,nodeLimit?:number)=>string[]=graphAdmissionErrors;\nexport const caps:62.5=CONTENT_CAPS.l0.size;\nexport const report:boolean=MEMORY_GATES.reportOnly;\nexport const n0:29=crossroadsConfig().n0;\nexport const resident:number=textureMipBytes(16,16,1,false);\nexport const cell:250=WIRE_CELL.half;\nexport const entry:8=WIRE_CELL.entryWidth;\nexport const tile:62.5=WIRE_TILE_SIZES.l0;\nexport const binding:128=CLIENT_SCRIPT_LIMITS.bindings;\nexport const source:2000000=SHARDFILE_ADMISSION_LIMITS.sourceBytes;\nexport const start:1=SCRIPT_V1_EVENTS.start;\nexport const event:ScriptV1EventName='tick';\nexport const hz:60=SCRIPT_V1_LAYOUT.fixedHz;\nexport const compiler:'0.28.20'=SCRIPT_ABI.assemblyscript;\nexport const image:8192=IMAGE_ASSET_LIMITS.dimension;\nexport const title:4096=STILL_IMAGE_LIMITS.dimension;\n";
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
 source+="WIRE_CELL.half=251;\nSCRIPT_V1_EVENTS.start=2;\nSCRIPT_ABI.version=1;\nIMAGE_ASSET_LIMITS.dimension=4096;\nCONTENT_CAPS.l0.size=125;\nexport const wrongEvent:ScriptV1EventName='missing';\nexport const wrongSize:typeof WIRE_TILE_SIZES.l0=125;\nexport const unknown=GRAPH_ADMISSION_LIMITS.unknown;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2540)).toHaveLength(5);
 expect(refused.filter(code=>code===2322)).toHaveLength(2);
 expect(refused).toContain(2339);
 expect(refused).toHaveLength(8);
});
