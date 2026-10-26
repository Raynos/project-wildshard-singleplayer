// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["ui/perfLap","ui/Feedback","ui/layers","ui/loadProgress","player/WaterLine","practice/TrainingArena","practice/playground/hud","boot/timeline","app/ui","ai/GroupBrain","ai/view/eliteEntry","combat/Firearm","combat/contactWeapon","combat/view/Bow","combat/view/SweptMelee","combat/view/projectile"])test(`${name} emits isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/engine/${name}.ts`,'utf8'),{fileName:`${name}.ts`,reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(100_000);
});

test('shared fields retain readonly owners and unknown blackboards',()=>{
 const consumer=resolve('src/engine/t4-engine-lifetime-field-consumer.ts');
 let source="import type {GroupBrain} from './ai/GroupBrain';\nimport type {LoadProgress} from './ui/loadProgress';\nimport type {UiLayers} from './ui/layers';\nimport type {AppUi} from './app/ui';\nimport type {HudSlots} from './ui/hudSlots';\nimport type {Bow} from './combat/view/Bow';\nimport {RangedAction} from './combat/Firearm';\nimport type {Group,Vector3} from 'three';\ndeclare const brain:GroupBrain<{alive:boolean}>;\ndeclare const progress:LoadProgress;\ndeclare const layers:UiLayers;\ndeclare const ui:AppUi;\ndeclare const bow:Bow;\nbrain.blackboard.set('value',{alive:true});\nbrain.members.push({alive:true});\nexport const observed:unknown=brain.blackboard.get('value');\nexport const element:HTMLDivElement=progress.element;\nlayers.closedAt=0;\nexport const slots:HudSlots=ui.hud;\nexport const model:Group=bow.model;\nexport const velocity:Vector3=bow.carrierVelocity;\ndeclare const cycle:InstanceType<typeof RangedAction.Cycle>;\nexport const phase:'idle'|'beat'|'cycle'|'reload'=cycle.phase;\nexport const rounds:number=cycle.rounds;\n";
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
 source+="brain.blackboard=new Map<string,unknown>();\nprogress.element=document.createElement('div');\nui.hud=slots;\nexport const untrustedNumber:number=brain.blackboard.get('value');\nlayers.closedAt='time';\nexport const missing=bow.model.undeclared;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2540)).toHaveLength(3);
 expect(refused.filter(code=>code===2322)).toHaveLength(2);
 expect(refused).toContain(2339);
 expect(refused).toHaveLength(6);
});
