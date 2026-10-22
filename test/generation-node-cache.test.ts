import {afterEach,expect,it} from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated producer processes exercise Node's actual code-cache validation.
import {execFileSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned, bounded scratch trees and portable cache fixtures.
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Scratch paths stay inside this checkout.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute the same Node runtime as this focused test.
import process from 'node:process';
import {generationNodeEnvironment} from '../scripts/generation-node-cache.mjs';

const owned:string[]=[];
afterEach(()=>{for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture() {const root=mkdtempSync(resolve('tmp','generation-node-cache-'));owned.push(root);return root;}
function files(directory:string):string[] {return readdirSync(directory,{withFileTypes:true}).flatMap(row=>row.isDirectory()?files(resolve(directory,row.name)):[resolve(directory,row.name)]);}
function stage(root:string,name:string) {const tree=resolve(root,name);mkdirSync(resolve(tree,'node_modules'),{recursive:true});return tree;}

it('shares bounded entries across paths while validating changed and corrupt source caches',()=>{
 const root=fixture(),cache=resolve(root,'cache'),source='export const value: number = 17; export const where = import.meta.url;';
 const run=(name:string,text=source)=>{
  const tree=stage(root,name);writeFileSync(resolve(tree,'value.ts'),text);
  writeFileSync(resolve(tree,'entry.mjs'),"import {value,where} from './value.ts';if(where!==new URL('./value.ts',import.meta.url).href)throw new Error('Wrong module origin');console.log(value);");
  const env=generationNodeEnvironment(tree,{NODE_COMPILE_CACHE:cache});
  return execFileSync(process.execPath,[resolve(tree,'entry.mjs')],{env,encoding:'utf8'}).trim();
 };
 expect(run('first')).toBe('17');
 const storage=resolve(cache,'generation-portable'),before=files(storage),bytes=before.map(path=>readFileSync(path));
 expect(before.length).toBeGreaterThan(0);
 expect(run('second')).toBe('17');
 expect(files(storage)).toEqual(before);
 expect(before.map(path=>readFileSync(path))).toEqual(bytes);
 // Same length with different code cannot inherit the cached value.
 expect(run('changed',source.replace('17','29'))).toBe('29');
 expect(files(storage)).toEqual(before);
 for(const path of before)writeFileSync(path,'corrupt V8 cache');
 expect(run('corrupt')).toBe('17');
 expect(files(storage)).toEqual(before);
});

it('preserves explicit disable, coverage and an absent cache configuration',()=>{
 const root=fixture(),tree=stage(root,'stage'),cache=resolve(root,'cache');
 for(const env of [{}, {NODE_COMPILE_CACHE:cache,NODE_DISABLE_COMPILE_CACHE:'1'}, {NODE_COMPILE_CACHE:cache,NODE_DISABLE_COMPILE_CACHE:'0'}, {NODE_COMPILE_CACHE:cache,NODE_V8_COVERAGE:resolve(root,'coverage')}]) {
  expect(generationNodeEnvironment(tree,env)).toEqual({...env,NODE_DISABLE_COMPILE_CACHE:'1'});
 }
 expect(readdirSync(resolve(tree,'node_modules'))).toEqual([]);
});

it('falls back cold without replacing unavailable storage or an existing alias',()=>{
 const root=fixture(),cache=resolve(root,'cache');writeFileSync(cache,'unavailable');
 const first=stage(root,'first');
 expect(generationNodeEnvironment(first,{NODE_COMPILE_CACHE:cache})['NODE_DISABLE_COMPILE_CACHE']).toBe('1');
 expect(readFileSync(cache,'utf8')).toBe('unavailable');
 const second=stage(root,'second'),alias=resolve(second,'node_modules','.generation-node-compile');writeFileSync(alias,'preserve');
 expect(generationNodeEnvironment(second,{NODE_COMPILE_CACHE:resolve(root,'valid')})['NODE_DISABLE_COMPILE_CACHE']).toBe('1');
 expect(readFileSync(alias,'utf8')).toBe('preserve');
});
