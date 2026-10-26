// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["ai/huntPattern","boot/steps","combat/view/ranged","entities/species/loft","entities/species/rigs","models/hoverboard","models/place","models/swimHands","render/programRetention","saves/runtime","script/client","sim/dayClock","sim/snapshot","ui/haptics","ui/hudSlots","ui/review"])test(`${name} emits isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/engine/${name}.ts`,'utf8'),{fileName:`${name}.ts`,reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(100_000);
});

test('shared values retain model, phase and literal contracts',()=>{
 const consumer=resolve('src/engine/t4-engine-shared-value-consumer.ts');
 let source="import {MathUtils} from 'three';\nimport {clamp} from './entities/species/rigs';\nimport {DAY_CLOCK_PHASES} from './sim/dayClock';\nimport {HAPTIC} from './ui/haptics';\nimport {CLIENT_SCRIPT_OP,CLIENT_SCRIPT_LIMITS} from './script/client';\nimport {INBOX_URL} from './ui/review';\nimport {hoverboard} from './models/hoverboard';\nimport {swimHands,type SwimHandsParams} from './models/swimHands';\nimport type {ModelDef} from './models/model';\nimport type {BootStep} from './boot/steps';\nexport const board:ModelDef<object>=hoverboard;\nexport const hands:ModelDef<SwimHandsParams>=swimHands;\nexport const phase:'dawn'=DAY_CLOCK_PHASES[0];\nexport const duration:22=HAPTIC.kill[0];\nexport const offset:101=CLIENT_SCRIPT_OP.offset;\nexport const fields:24=CLIENT_SCRIPT_LIMITS.fields;\nexport const step:BootStep='renderer';\nexport const math:typeof MathUtils.clamp=clamp;\nexport const wideInbox:typeof INBOX_URL='another endpoint';\n";
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
 source+="DAY_CLOCK_PHASES[0]='dawn';\nHAPTIC.hit=14;\nCLIENT_SCRIPT_OP.offset=101;\nexport const wrongPhase:typeof DAY_CLOCK_PHASES[0]='day';\nexport const wrongStep:BootStep='not-a-step';\nexport const missing=hoverboard.undeclared;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2540)).toHaveLength(3);
 expect(refused.filter(code=>code===2322)).toHaveLength(2);
 expect(refused).toContain(2339);
 expect(refused).toHaveLength(6);
});
