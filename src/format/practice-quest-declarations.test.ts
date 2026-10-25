// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining schema declarations without products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten default-contract consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ['practiceCourseRows','quests','questFigures','modes'])test(`${name} emits bounded isolated data contracts`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{
  fileName:`${name}.ts`,reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(20_000);
 expect(emitted.outputText).toContain('v.GenericSchema<');
});

test('quests retain admitted defaults and traversal retains authored optional speeds',()=>{
 const consumer=resolve('src/format/t4-practice-quest-consumer.ts');
 let source=`import * as v from 'valibot';
import {QuestDataSchema,type QuestData} from './quests';
import type {PracticeScene,PracticeControllerRows} from './practiceCourseRows';
import type {QuestFigureRowsInput,QuestFigureRows} from './questFigures';
import {ModesSchema,type ModeRowsInput,type ModeRows} from './modes';
export const section=v.object({quests:v.optional(QuestDataSchema,{flags:[],quests:[],triggers:[],dialogue:[]})});
export const admitted=v.parse(section,{});
export const flags:string[]=admitted.quests.flags;
export const authored:ModeRowsInput={};
export const empty:ModeRows=v.parse(ModesSchema,{});
export const traversal:ModeRows['traverse']=empty.traverse;
declare const scene:PracticeScene;
export const parts:number=scene.parts.length;
export function center(row:PracticeControllerRows):number|undefined{if(row.center.kind==='fixed')return row.center.x;return undefined;}
export const figure:QuestFigureRowsInput={id:'person',kit:'person',feet:{poi:'world',x:0,z:0},parts:{},system:{id:'person',before:[]}};
declare const figureOutput:QuestFigureRows;
export const objects:number=figureOutput.objects.length;
declare const quest:QuestData;
export const quests:number=quest.quests.length;
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual practice/quest consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const missingTraverse:ModeRows={};
export const missingFigureDefaults:QuestFigureRows=figure;
export const badPart:PracticeScene['parts'][number]={kind:'unknown'};`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2741);
 expect(refused).toContain(2322);
});
