// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining declarations without generated products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ["inputDeclarations", "nativePhysics", "worldPhysics", "discoveryValues", "shardSchema", "outputIndex", "platformDataSections", "outputFields"])test(`${name} emits bounded isolated declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{fileName:`${name}.ts`,reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(50_000);
});

test("native disk and input contracts preserve closed keys and original composition",()=>{
 const consumer=resolve("src/format/t4-isolated-native-disk-declarations-consumer.ts");
 let source="import * as v from 'valibot';\nimport {InputActionSchema,InputKeysSchema,InputExtraEntries,type InputWhen} from './inputDeclarations';\nimport {nativeBodySchema,type NativeBody} from './nativePhysics';\nimport type {WorldPhysics} from './worldPhysics';\nimport type {DiscoveryValues} from './discoveryValues';\nimport {LOOK_LUT_BYTES,type Shardfile} from './shardSchema';\nimport {OutputIndexSchema,type OutputIndex} from './outputIndex';\nimport {CLIENT_ENVELOPE_SECTIONS} from './platformDataSections';\nimport type {OutputHostSectionName} from './outputFields';\nexport const custom=InputActionSchema.options[1];\nexport const regex=InputKeysSchema.pipe[0].item.pipe[1];\nexport const describe=InputExtraEntries.describe;\nexport const admittedBody:v.GenericSchema<unknown,NativeBody>=nativeBodySchema('axis');\nexport function nativeKind(value:WorldPhysics):string{return value.actors[0]?.spec.kind??'';}\nexport function discovery(value:DiscoveryValues):number{return Object.keys(value.poses??{}).length;}\nexport function version(value:Shardfile):'0.1'{return value.version;}\nexport const lut:number=LOOK_LUT_BYTES;\nexport const sections=v.parse(OutputIndexSchema.entries.sections,[]);\nexport function sectionName():string{return sections[0]?.name??'';}\nexport const transport:OutputIndex['formatVersion']=2;\nexport const section:OutputHostSectionName='world/navigation';\nexport const source=v.parse(CLIENT_ENVELOPE_SECTIONS['world/movers'].schema,[]);\nexport const mode:InputWhen['mode']='foot';\n";
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
 source+="export const wrongAction:v.InferOutput<typeof InputActionSchema>='invented';\nexport const wrongRig:WorldPhysics['rig']='jet';\nexport const wrongFeet:NativeBody['dims']['feet']=[[1]];\nexport const wrongTransport:OutputIndex['formatVersion']=1;\nexport const wrongMode:InputWhen['mode']='jet';\nCLIENT_ENVELOPE_SECTIONS['world/movers'].schema=CLIENT_ENVELOPE_SECTIONS['world/movers'].schema;\nexport const wrongSection:OutputHostSectionName='custom/extra';\nexport const absent=sections[0]?.undeclared;\n";
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused.filter(code=>code===2322)).toHaveLength(6);
 expect(refused).toContain(2540);
 expect(refused).toContain(2339);
 expect(refused).toHaveLength(8);
});
