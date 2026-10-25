// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten schema consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

test('weather witness composition keeps typed modules and optional fields',()=>{
 const consumer=resolve('src/format/t4-weather-composition-consumer.ts');
 let source="import * as v from 'valibot';\nimport {WeatherReactionsSchema,type WeatherReactionRows} from './weatherProgram';\nimport {DecisionScriptsSchema} from './decisionScripts';\nconst composed=v.object({...WeatherReactionsSchema.entries,script:DecisionScriptsSchema.pipe[2].item});\ndeclare const input:unknown;\nexport const witness=v.parse(composed,input);\nexport const moduleName:string=witness.script.module;\nexport const bytes:string=witness.bytes;\nexport const rate:number=witness.hz;\nexport const random:boolean=witness.steps[0]?.random??false;\nexport const optionalActions:WeatherReactionRows['actions']=witness.actions;\nexport function withModule<T extends {program:{script:{module:string};bytes:string}}>(row:T){\n return {...row,program:{...row.program,bytes:witness.bytes}};\n}\nexport const copied=withModule({program:witness});\nexport const copiedModule:string=copied.program.script.module;\nexport const opaque:WeatherReactionRows['script']={unadmitted:true};\n";
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
 source+="export const wrongModule:number=witness.script.module;\nexport const wrongBytes:number=copied.program.bytes;\nexport const extra=witness.undeclared;\n";
 expect(diagnostics().map(diagnostic=>diagnostic.code).sort((left,right)=>left-right)).toEqual([2322,2322,2339]);
});
