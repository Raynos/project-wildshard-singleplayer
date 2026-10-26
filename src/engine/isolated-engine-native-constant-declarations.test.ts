// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["ui/debugOptions","world/interact/types","native/ota-config","world/interact/kit","render/nodes/planeBiasShadowFilter","render/nodes/tentShadowFilter","world/HorizonMatte","native/updates","physics/bodies","world/blenderArea","world/interact/barrel"])test(`${name} emits isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/engine/${name}.ts`,'utf8'),{fileName:`${name}.ts`,reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(100_000);
});

test('native constants retain literals, ownership and callable filters',()=>{
 const consumer=resolve('src/engine/t4-engine-native-constant-consumer.ts');
 let source="import {TITLE_SKIPPERS} from './ui/debugOptions';\nimport {TRANSIENT_PREFIXES} from './world/interact/types';\nimport {OTA_CHANNELS} from './native/ota-config';\nimport {interactParts} from './world/interact/kit';\nimport {lit} from './models/interact';\nimport {planeBiasShadowFilter} from './render/nodes/planeBiasShadowFilter';\nimport {tentShadowFilter} from './render/nodes/tentShadowFilter';\nimport {HORIZON_RADIUS,type PaintedHorizon} from './world/HorizonMatte';\nimport {DROP_BODY,type Bodies} from './physics/bodies';\nimport {BARREL_BODY} from './world/interact/barrel';\nimport {CELL,STEP} from './world/blenderArea';\nimport type {Vector2} from 'three';\nTITLE_SKIPPERS.push('test'); TRANSIENT_PREFIXES.push('test:');\nexport const ios:'https://wildshard-updates.vercel.app/ios/v1/manifest.json'=OTA_CHANNELS.ios;\nexport const radius:2300=HORIZON_RADIUS;\nexport const part:typeof lit=interactParts.lit;\nexport const filter:typeof planeBiasShadowFilter=tentShadowFilter;\ndeclare const painted:PaintedHorizon;\nexport const veil:Vector2=painted.veil.value; painted.veil.value.set(0,1);\nexport const material:'wood'=DROP_BODY.material;\nexport const cylinder:0.38=BARREL_BODY.shape.cylinder.radius;\nexport const spacing:number=CELL+STEP;\ndeclare const bodies:Bodies; bodies.pre(); bodies.pre(0.016);\n";
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
 source+="TITLE_SKIPPERS.push(0);\nOTA_CHANNELS.ios='other';\npainted.veil={value:veil};\nBARREL_BODY.shape.cylinder.radius=0.4;\nexport const wrongMaterial:'metal'=DROP_BODY.material;\nexport const wrongRadius:4=HORIZON_RADIUS;\nexport const missing=planeBiasShadowFilter.undeclared;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2345)).toHaveLength(1);
 expect(refused.filter(code=>code===2540)).toHaveLength(3);
 expect(refused.filter(code=>code===2322)).toHaveLength(2);
 expect(refused).toContain(2339);
 expect(refused).toHaveLength(7);
});
