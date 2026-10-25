// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["scriptActionsV2", "scriptQueriesV2", "scriptWireV2", "scriptFuelV2", "meshCollisionBytes"])test(`${name} emits bounded isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{fileName:`${name}.ts`,reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(50_000);
});

test("ABI constants retain exact codes and readonly descriptors",()=>{
 const consumer=resolve("src/format/t4-isolated-v2-constant-declarations-consumer.ts");
 let source="import {V2_ACTION_OPS} from './scriptActionsV2';\nimport {V2_QUERY_OPS} from './scriptQueriesV2';\nimport {V2_HEADER_BYTES,V2_DIRECTORY_BYTES,V2_REGION_STRIDES} from './scriptWireV2';\nimport {V2_WORK_ENTRIES} from './scriptFuelV2';\nimport {MESH_COLLISION_LIMITS} from './meshCollisionBytes';\nexport const impulse:14=V2_ACTION_OPS.impulse;\nexport const dismount:23=V2_ACTION_OPS.dismount;\nexport const walkable:4=V2_QUERY_OPS.walkable;\nexport const path:5=V2_QUERY_OPS.path;\nexport const header:128=V2_HEADER_BYTES;\nexport const directory:number=V2_DIRECTORY_BYTES;\nexport const stride:readonly number[]=V2_REGION_STRIDES;\nexport const step:'ws_step'=V2_WORK_ENTRIES.sim;\nexport const project:'ws_project'=V2_WORK_ENTRIES.project;\nexport const view:'ws_view'=V2_WORK_ENTRIES.view;\nexport const vertices:120000=MESH_COLLISION_LIMITS.vertices;\nexport const triangles:40000=MESH_COLLISION_LIMITS.triangles;\nexport const coordinate:250=MESH_COLLISION_LIMITS.coordinate;\n";
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
 source+="V2_ACTION_OPS.impulse=15;\nV2_QUERY_OPS.path=6;\nV2_REGION_STRIDES[0]=8;\nV2_WORK_ENTRIES.sim='ws_other';\nMESH_COLLISION_LIMITS.vertices=1;\nexport const wrongCode:typeof V2_ACTION_OPS.dismount=24;\nexport const wrongStride:128=V2_REGION_STRIDES[0];\nexport const absent=V2_ACTION_OPS.undeclared;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2540)).toHaveLength(4);
 expect(refused).toContain(2542);
 expect(refused.filter(code=>code===2322)).toHaveLength(2);
 expect(refused).toContain(2339);
 expect(refused).toHaveLength(8);
});
