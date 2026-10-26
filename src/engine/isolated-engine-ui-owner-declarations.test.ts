// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["ui/BossBar","ui/Combat","ui/DeathFade","ui/EliteBar","ui/HUD","ui/HurtArc","ui/Loading","ui/LockOn","ui/Map","ui/Menu","ui/Minimap","ui/Perf","ui/Resume","ui/SpeedLines","ui/ToastStack","ui/WeaponStrip","ui/WindupWarn","ui/perfHud"])test(`${name} emits isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/engine/${name}.ts`,'utf8'),{fileName:`${name}.ts`,reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(100_000);
});

test('UI scope owners retain readonly lifetime contracts',()=>{
 const consumer=resolve('src/engine/t4-engine-ui-owner-consumer.ts');
 let source="import type {Scope} from './app/scope';\nimport type {BossBar} from './ui/BossBar';\nimport type {HUD} from './ui/HUD';\nimport type {Loading} from './ui/Loading';\nimport type {Perf} from './ui/Perf';\nimport type {GameMenu} from './ui/Menu';\nimport type {PerfHud} from './ui/perfHud';\ndeclare const boss:BossBar;\ndeclare const hud:HUD;\ndeclare const loading:Loading;\ndeclare const perf:Perf;\ndeclare const menu:GameMenu;\ndeclare const perfHud:PerfHud;\nexport const owners:Scope[]=[boss.scope,hud.scope,loading.scope,perf.scope,menu.scope,perfHud.scope];\nexport const retired:boolean=boss.scope.disposed;\nexport const scope:Scope=loading.scope;\n";
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
 source+="boss.scope=hud.scope;\nloading.scope=perf.scope;\nmenu.scope.disposed=false;\nexport const wrongOwner:number=perf.scope;\nexport const wrongRetired:number=boss.scope.disposed;\nexport const missing=perfHud.scope.undeclared;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2540)).toHaveLength(3);
 expect(refused.filter(code=>code===2322)).toHaveLength(2);
 expect(refused).toContain(2339);
 expect(refused).toHaveLength(6);
});
