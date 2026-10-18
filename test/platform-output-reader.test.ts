import {expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated output-admission fixture files.
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Paths remain within this test's fixture.
import {join} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Small disposable fixture, never a repository copy.
import {tmpdir} from 'node:os';
import {outputRuntime} from '../scripts/shard-platform-output.mjs';
import {platformOutput} from './fixtures/platformOutputs';
import {parseOutputIndex} from '../src/format/outputIndex';
import {nameBlob} from '../src/sdk/blobs';

it('verifies every emitted TS copy and reports custom sections independently',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-output-reader-'));
 try{
  platformOutput(root,'_template',{'runtime/index.ts':'export const X=1;','runtime/types.d.ts':'export interface Item { id:string }'},{'custom/rows':'{"key":1}'});
  expect(outputRuntime(root,'_template')).toMatchObject({runtime:['out/_template/runtime/index.ts','out/_template/runtime/types.d.ts'],customSectionBytes:9,customSections:[{name:'custom/rows',bytes:9}]});
  writeFileSync(join(root,'out/_template/runtime/index.ts'),'export const X=2;');
  expect(()=>outputRuntime(root,'_template')).toThrow('runtime hash/size mismatch');
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('charges named JSON beside custom sections and refuses corrupt blob bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-output-json-'));
 try{
  platformOutput(root,'_template',{}, {'custom/rows':'{"key":1}'});
  const indexPath=join(root,'out/_template/shard.json');
  const index=parseOutputIndex(JSON.parse(readFileSync(indexPath,'utf8')));
  const blob=nameBlob('private.json','json',new TextEncoder().encode('{"n":2}'));
  mkdirSync(join(root,'out/_template/blobs/json'),{recursive:true});
  writeFileSync(join(root,'out/_template',blob.file.path),blob.bytes);
  writeFileSync(indexPath,JSON.stringify({...index,files:[blob.file]}));
  expect(outputRuntime(root,'_template')).toMatchObject({customSectionBytes:16,customSections:[{name:'custom/rows',bytes:9},{name:'private.json',bytes:7}]});
  writeFileSync(join(root,'out/_template',blob.file.path),'{"n":3}');
  expect(()=>outputRuntime(root,'_template')).toThrow('named JSON hash/size mismatch');
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('refuses missing copies, partial inventories, escapes and changed source',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-output-refusals-'));
 try{
  expect(()=>outputRuntime(root,'_template')).toThrow('built output missing');
  platformOutput(root,'_template',{'runtime/index.ts':'export const X=1;'});
  const indexPath=join(root,'out/_template/shard.json');
  const index:unknown=JSON.parse(readFileSync(indexPath,'utf8'));
  if(typeof index!=='object'||index===null||!('runtime'in index))throw new Error('Fixture index missing runtime');
  writeFileSync(indexPath,JSON.stringify({...index,runtime:{entry:'runtime/index.ts',trust:'first-party',files:[],lines:0}}));
  expect(()=>outputRuntime(root,'_template')).toThrow('missing output runtime entry');
  platformOutput(root,'_template',{'runtime/index.ts':"import X from '../data/rows'; export default X;"});
  expect(()=>outputRuntime(root,'_template')).toThrow('not standalone');
  platformOutput(root,'_template',{'runtime/index.ts':'export const X=1;'});
  writeFileSync(join(root,'src/shards/_template/runtime/index.ts'),'export const X=2;');
  expect(()=>outputRuntime(root,'_template')).toThrow('not a verbatim');
  platformOutput(root,'_template',{'runtime/index.ts':'export const X=1;'});
  writeFileSync(join(root,'out/_template/runtime/extra.ts'),'export const EXTRA=1;');
  expect(()=>outputRuntime(root,'_template')).toThrow('unlisted output runtime');
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('refuses section corruption and omitted source runtimes instead of reporting zero',()=>{
 const root=mkdtempSync(join(tmpdir(),'platform-output-sections-'));
 try{
  platformOutput(root,'_template',{}, {'custom/rows':'{"key":1}'});
  writeFileSync(join(root,'out/_template/sections/custom/rows.json'),'{}');
  expect(()=>outputRuntime(root,'_template')).toThrow('section hash/size mismatch');
  platformOutput(root,'_template',{'runtime/index.ts':'export const X=1;'});
  platformOutput(root,'_template');
  rmSync(join(root,'out/_template/runtime/index.ts'));
  expect(()=>outputRuntime(root,'_template')).toThrow('output omits authored runtime');
 }finally{rmSync(root,{recursive:true,force:true});}
});
