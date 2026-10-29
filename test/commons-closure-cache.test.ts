// oxlint-disable-next-line import/no-nodejs-modules -- own only this source-closure fixture under repository tmp
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- resolve the bounded fixture's actual import graph
import {dirname,resolve} from 'node:path';
import {expect,test} from 'vitest';
import {runtimeCommonsClosure} from '../lint/commons-closure.mjs';

test('commons memo observes changed transitive files, new paths and package exports',()=>{
 mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/commons-cache-'));
 const put=(path:string,text:string):void=>{const file=resolve(root,path);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,text);};
 const from=resolve(root,'src/engine/caller.ts'), second=resolve(root,'src/engine/second.ts');
 try{
  put('src/engine/a.ts',"import './b';");put('src/engine/b.ts','export const value=1;');
  expect(runtimeCommonsClosure(from,'./a')).toBeNull();
  expect(runtimeCommonsClosure(from,'./a')).toBeNull();
  expect(runtimeCommonsClosure(second,'./a')).toBeNull();
  put('src/engine/b.ts',"import '@wildshard/commons/bake/value';");
  expect(runtimeCommonsClosure(from,'./a')).toBe('@wildshard/commons/bake/value');
  expect(runtimeCommonsClosure(second,'./a')).toBe('@wildshard/commons/bake/value');
  put('src/engine/b.ts',"import './missing';");
  expect(runtimeCommonsClosure(from,'./a')).toBeNull();
  put('src/engine/missing.ts',"import '@wildshard/commons/bake/new';");
  expect(runtimeCommonsClosure(from,'./a')).toBe('@wildshard/commons/bake/new');
  put('src/sdk/package.json',JSON.stringify({exports:{'./value':'./clean.ts'}}));
  put('src/sdk/clean.ts','export const value=1;');
  expect(runtimeCommonsClosure(from,'@wildshard/sdk/value')).toBeNull();
  put('src/sdk/package.json',JSON.stringify({exports:{'./value':'./bad.ts'}}));
  put('src/sdk/bad.ts',"import '@wildshard/commons/bake/value';");
  expect(runtimeCommonsClosure(from,'@wildshard/sdk/value')).toBe('@wildshard/commons/bake/value');
 }finally{rmSync(root,{recursive:true,force:true});}
});
