// oxlint-disable-next-line import/no-nodejs-modules -- Inspect schema declarations without products.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten data-contract consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

for(const name of ['figures','speciesBrain','movers'])test(`${name} emits bounded isolated data declarations`,()=>{
 const emitted=ts.transpileDeclaration(readFileSync(`src/format/${name}.ts`,'utf8'),{
  fileName:`${name}.ts`,reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(15_000);
 expect(emitted.outputText).toContain('v.GenericSchema<');
});

test('figure, brain and mover consumers retain discriminants and authored defaults',()=>{
 const consumer=resolve('src/format/t4-figure-mover-consumer.ts');
 let source=`import type {FigureRow,FigureAtlasRow,FigureGroupRows} from './figures';
import type {SpeciesBrainRows} from './speciesBrain';
import type {MoverBakeInput,MoverBake,MoverData} from './movers';
declare const figure:FigureRow;
export const joints:string[]=figure.rig.sockets;
declare const atlas:FigureAtlasRow;
export const columns:number=atlas.columns;
declare const group:FigureGroupRows;
export const category:'people'=group.pieces.still.category;
export function phase(brain:SpeciesBrainRows):number|undefined{if(brain.archetype==='challenge-grazer')return brain.phaseSlots;return undefined;}
export const authored:MoverBakeInput={capture:'capture',modules:[{file:'move.as',driver:'hinge'}]};
declare const bake:MoverBake;
export const output:'typescript'|'json'=bake.output;
declare const movers:MoverData;
export const kinds:('platform'|'chain'|'static'|'channel')[]=movers.map(row=>row.kind);
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual figure/mover consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const missingDefault:MoverBake={capture:'capture',modules:[{file:'move.as',driver:'hinge'}]};
export const badCategory:FigureGroupRows['pieces']['still']['category']='nature';
export function invalidBrain(brain:SpeciesBrainRows):number{return brain.phaseSlots;}`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2741);
 expect(refused).toContain(2322);
 expect(refused).toContain(2339);
});
