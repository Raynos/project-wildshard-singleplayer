// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["boot/contentCacheProtocol"])test(`${name} emits isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/engine/${name}.ts`,'utf8'),{fileName:`${name}.ts`,reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(100_000);
});

test('cache commands retain pin entries, operation keys and typed replies',()=>{
 const consumer=resolve('src/engine/t4-isolated-engine-cache-wire-declarations-consumer.ts');
 let source="import * as v from 'valibot';\nimport {CachePinCommandSchema,CacheCommandSchema,CacheValueSchemas,type CacheCommand} from './boot/contentCacheProtocol';\nconst pin:v.InferOutput<typeof CachePinCommandSchema>={id:1,op:'pin',lease:1,hashes:[]};\nexport const id:number=v.parse(CachePinCommandSchema.entries.id,2);\nexport const op:'pin'=v.parse(CachePinCommandSchema.entries.op,'pin');\nexport const command:CacheCommand=pin;\nexport const input:v.InferInput<typeof CacheCommandSchema>={id:1,op:'flush'};\nexport const has:boolean=v.parse(CacheValueSchemas.has,true);\nexport const bytes:Uint8Array|null=v.parse(CacheValueSchemas.get,null);\nexport const fetched=v.parse(CacheValueSchemas.fetch,{});\nexport const stored:boolean=fetched.stored;\n";
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
 source+="pin.id='id';\npin.op='get';\npin.hashes[0]=0;\nexport const wrong:number=v.parse(CacheValueSchemas.fetch,{});\nexport const missing=CacheValueSchemas.undeclared;\nexport const absent=CachePinCommandSchema.entries.undeclared;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2322)).toHaveLength(4);
 expect(refused.filter(code=>code===2339)).toHaveLength(2);
 expect(refused).toHaveLength(6);
});
