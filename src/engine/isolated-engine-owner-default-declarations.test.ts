// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["app/sceneOwnership","boot/lastEnd","core/deflate","physics/navmeshLoad","render/precompile","script/inputInboxV2","world/geometryKit","ui/ownership","entities/AnimalManager","audio/AmbienceBeds","audio/Audio","audio/Stems","core/worldDepth","input/InputService","render/graph/compile"])test(`${name} emits isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/engine/${name}.ts`,'utf8'),{fileName:`${name}.ts`,reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(100_000);
});

test('owner defaults retain DOM, promise and unshared output laws',()=>{
 const consumer=resolve('src/engine/t4-engine-owner-default-consumer.ts');
 let source="import {unshuffleLanes} from './core/deflate';\nimport {boundedLinkWait} from './render/precompile';\nimport {uiScope,mountUi} from './ui/ownership';\nimport type {Scope} from './app/scope';\ndeclare const owner:Scope;\ndeclare const lanes:Uint8Array;\nexport const restored:Uint8Array=unshuffleLanes(lanes);\nexport const explicit:Uint8Array=unshuffleLanes(lanes,new Uint8Array(16),0,4);\nexport const linked:Promise<boolean>=boundedLinkWait(()=>true,async()=>{});\nexport const timed:Promise<boolean>=boundedLinkWait(()=>true,async()=>{},100);\nexport const child:Scope=uiScope('child',owner);\nexport const implicit:Scope=uiScope('child');\nexport const element:HTMLElement=document.createElement('div');\nmountUi(element,child);\nmountUi(element,child,document.body);\n";
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
 source+="unshuffleLanes(lanes,new Uint8Array(new SharedArrayBuffer(16)));\nboundedLinkWait(()=>true,async()=>{},'time');\nuiScope('child',0);\nmountUi(element,child,'parent');\nexport const wrong:number=boundedLinkWait(()=>true,async()=>{});\nexport const missing=child.undeclared;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2345)).toHaveLength(4);
 expect(refused.filter(code=>code===2322)).toHaveLength(1);
 expect(refused).toContain(2339);
 expect(refused).toHaveLength(6);
});
