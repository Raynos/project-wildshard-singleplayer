// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["app/resources", "app/runtime", "blocks", "core/fixedStep", "core/crossroads", "script/queries", "script/state", "script/host", "script/effects", "saves/slots", "render/desktopReference", "practice/dummyMetadata", "sim/snapshotPhysics", "ui/authoredDebugRows"])test(`${name} emits isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/engine/${name}.ts`,'utf8'),{fileName:`${name}.ts`,reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(100_000);
});

test('engine constants retain borrowed owner and literal contracts',()=>{
 const consumer=resolve('src/engine/t4-engine-constant-consumer.ts');
 let source="import * as v from 'valibot';\nimport type {Scope} from './app/scope';\nimport type {App} from './app/app';\nimport {pageScope} from './app/resources';\nimport {app} from './app/runtime';\nimport {blocks} from './blocks';\nimport {melee} from './combat/blocks/melee';\nimport {FIXED_STEP} from './core/fixedStep';\nimport {CROSSROADS_CONFIG} from './core/crossroads';\nimport {SCRIPT_QUERY} from './script/queries';\nimport {SCRIPT_STATE_OP} from './script/state';\nimport {SCRIPT_LIMITS} from './script/host';\nimport {jsonRecord,type Json} from './saves/slots';\nimport {DESKTOP_REFERENCE} from './render/desktopReference';\nimport {TRAINING_DUMMY_SCALE} from './practice/dummyMetadata';\nimport {MAX_REFERENCE_BYTES} from './sim/snapshotPhysics';\nimport {authoredRows} from './ui/authoredDebugRows';\nimport type {DebugRow} from './ui/debugOptions';\nexport const owner:Scope=pageScope;\nexport const page:App=app;\nexport const block:typeof melee=blocks.melee;\nexport const step:number=FIXED_STEP;\nexport const n0:29=CROSSROADS_CONFIG.n0;\nexport const ray:1=SCRIPT_QUERY.raycast;\nexport const shared:5=SCRIPT_STATE_OP.shared;\nexport const limits=SCRIPT_LIMITS;\ndeclare const input:unknown;\nexport const saved:Record<string,Json>=v.parse(jsonRecord,input);\nexport const reference:number=DESKTOP_REFERENCE.k3060;\nexport const scale:number=TRAINING_DUMMY_SCALE;\nexport const bytes:number=MAX_REFERENCE_BYTES;\nexport const rows:Set<DebugRow>=authoredRows;\n";
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
 source+="blocks.melee=blocks.melee;\nSCRIPT_QUERY.raycast=2;\nSCRIPT_STATE_OP.shared=6;\nCROSSROADS_CONFIG.n0=30;\nexport const wrong:typeof SCRIPT_QUERY.raycast=5;\nexport const badJson:v.InferOutput<typeof jsonRecord>={bad:()=>1};\nexport const missing=blocks.undeclared;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2540)).toHaveLength(4);
 expect(refused.filter(code=>code===2322)).toHaveLength(2);
 expect(refused).toContain(2339);
 expect(refused).toHaveLength(7);
});
