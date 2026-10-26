// oxlint-disable-next-line import/no-nodejs-modules -- Read the actual production compiler project and schema source.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep emitted declarations virtual, beside their defining modules.
import {basename,resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

function formatProject():ts.ParsedCommandLine {
 const path=resolve('tsconfig.format.json'),config=ts.readConfigFile(path,file=>ts.sys.readFile(file));
 if(config.error!==undefined)throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText,' '));
 return ts.parseJsonConfigFileContent(config.config,ts.sys,'.',undefined,path);
}

test('format production requires isolated declarations without owning tests',()=>{
 const project=formatProject();
 expect(project.errors).toEqual([]);
 expect(project.options.isolatedDeclarations).toBe(true);
 expect(project.options.declaration).toBe(true);
 expect(project.options.types).toEqual([]);
 expect(project.fileNames.some(file=>file.endsWith('.test.ts'))).toBe(false);
 const emitted=ts.transpileDeclaration('export const codes:Readonly<{ready:1}>=Object.freeze({ready:1});',{
  fileName:'explicit.ts',reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 const missing=ts.transpileDeclaration('export const codes=Object.freeze({ready:1});',{
  fileName:'inferred.ts',reportDiagnostics:true,compilerOptions:{isolatedDeclarations:true},
 });
 expect((missing.diagnostics??[]).map(row=>row.code)).toContain(9010);
});

test('every isolated format declaration remains strictly checked by browser consumers',()=>{
 const project=formatProject(),files=project.fileNames.filter(file=>file.endsWith('.ts')&&!file.endsWith('.d.ts'));
 const virtuals=new Map<string,string>(),names=new Map(files.map(file=>[
  resolve(file),resolve(`src/format/t4-emitted-${basename(file).replace(/\.ts$/u,'.d.ts')}`),
 ]));
 const options:ts.CompilerOptions={...project.options,composite:false,incremental:false,noEmit:true,
  skipLibCheck:false,isolatedDeclarations:false,rootDir:process.cwd(),
  lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts']};
 delete options.tsBuildInfoFile;
 for(const file of files){
  const emitted=ts.transpileDeclaration(readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,
   compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true}});
  expect(emitted.diagnostics,file).toEqual([]);
  const source=ts.createSourceFile(file,emitted.outputText,ts.ScriptTarget.Latest,true),edits:{start:number;end:number;text:string}[]=[];
  const visit=(node:ts.Node):void=>{
   if(ts.isStringLiteral(node)&&(ts.isImportDeclaration(node.parent)||ts.isImportTypeNode(node.parent.parent))){
    const target=ts.resolveModuleName(node.text,file,options,ts.sys).resolvedModule;
    const importedName=target===undefined?undefined:names.get(resolve(target.resolvedFileName));
    if(importedName!==undefined)edits.push({start:node.getStart(source),end:node.end,
     text:JSON.stringify(`./${basename(importedName).replace(/\.d\.ts$/u,'')}`)});
   }
   ts.forEachChild(node,visit);
  };
  visit(source);
  let output=emitted.outputText;
  for(const edit of edits.sort((left,right)=>right.start-left.start))output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);
  const name=names.get(resolve(file));
  if(name===undefined)throw new Error('Missing virtual output');
  virtuals.set(name,output);
 }
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.readFile=file=>virtuals.get(resolve(file))??read(file);
 host.fileExists=file=>virtuals.has(resolve(file))||exists(file);
 const roots=[...virtuals.keys()];
 const check=(paths:readonly string[]):readonly ts.Diagnostic[]=>ts.getPreEmitDiagnostics(ts.createProgram([...paths],options,host));
 expect(check(roots)).toEqual([]);
 const consumer=resolve('src/format/t4-emitted-invalid.ts');
 virtuals.set(consumer,"import type * as v from 'valibot';\nimport {AudioNodeSchema} from './t4-emitted-audioProfiles';\nexport const invalid:v.InferOutput<typeof AudioNodeSchema>={id:'emitter',panner:[1,2]};\n");
 const refused=check([...roots,consumer]);
 expect(refused.map(row=>row.code)).toEqual([2322]);
});
