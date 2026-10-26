// oxlint-disable-next-line import/no-nodejs-modules -- Inspect author declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve a virtual author contract consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

test('Nalati ground source emits an isolated declaration',()=>{
 const fileName='src/shards/nalati-grasslands/generators/nalatiGroundSource.ts';
 const emitted=ts.transpileDeclaration(readFileSync(fileName,'utf8'),{fileName,reportDiagnostics:true,compilerOptions:{strict:true,exactOptionalPropertyTypes:true,isolatedDeclarations:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeGreaterThan(0);
});

test('Nalati ground declaration preserves the mutable source contract',()=>{
 const consumer=resolve('src/shards/t4-nalati-ground-consumer.ts');
 let source="import {TERRAIN_PAINT_SOURCE} from './nalati-grasslands/generators/nalatiGroundSource';\nexport const seed:number=TERRAIN_PAINT_SOURCE.seed;\nTERRAIN_PAINT_SOURCE.seed=1;\nexport const colour:typeof TERRAIN_PAINT_SOURCE.groundColor=TERRAIN_PAINT_SOURCE.groundColor;\n";
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  noPropertyAccessFromIndexSignature:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
  moduleResolution:ts.ModuleResolutionKind.Bundler,types:['node'],allowArbitraryExtensions:true,skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer,...ts.sys.readDirectory(resolve('src/game'),['.d.ts'],undefined,['**/*.merge.d.ts'])],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual Nalati ground consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source="import {TERRAIN_PAINT_SOURCE} from './nalati-grasslands/generators/nalatiGroundSource';\nexport const seed:number=TERRAIN_PAINT_SOURCE.seed;\nTERRAIN_PAINT_SOURCE.seed=1;\nexport const colour:typeof TERRAIN_PAINT_SOURCE.groundColor=TERRAIN_PAINT_SOURCE.groundColor;\nTERRAIN_PAINT_SOURCE.seed='bad';\nexport const badColour:typeof TERRAIN_PAINT_SOURCE.groundColor=1;\nTERRAIN_PAINT_SOURCE.missing;\n";
 expect(diagnostics().map(diagnostic=>diagnostic.code)).toEqual([2322,2322,2339]);
});
