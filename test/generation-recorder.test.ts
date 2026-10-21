// oxlint-disable-next-line import/no-nodejs-modules -- Owned isolated producer fixtures.
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync,existsSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned fixture paths.
import {resolve} from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real Node preload/load and filesystem boundaries.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact executable for the child producer.
import process from 'node:process';
import {afterEach,expect,it} from 'vitest';
import * as v from 'valibot';

const owned:string[]=[];
afterEach(()=>{for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});
function fixture(source:string) {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-recorder-'));owned.push(root);
  writeFileSync(resolve(root,'entry.mjs'),source);
  writeFileSync(resolve(root,'used.mjs'),'export const value=1;');
  writeFileSync(resolve(root,'raw.ts'),'// raw source data');
  writeFileSync(resolve(root,'unread.ts'),'// unrelated SDK module');
  const receipt=resolve(root,'reads.json');
  const child=spawnSync(process.execPath,['--import',resolve('scripts/generation-recorder.mjs'),'entry.mjs'],{
    cwd:root,env:{...process.env,WS_GENERATION_READ_RECEIPT:receipt},encoding:'utf8',
  });
  return {root,receipt,child,read:()=>v.parse(v.object({schema:v.literal('generation-reads/1'),files:v.array(v.string()),opaque:v.array(v.string()),seal:v.string()}),JSON.parse(readFileSync(receipt,'utf8')))};
}
it('records imports and descriptor-based raw reads without consuming unrelated source modules',()=>{
  const {child,read}=fixture("import{value}from'./used.mjs';import fs from'node:fs';const fd=fs.openSync('raw.ts','r');fs.readSync(fd,Buffer.alloc(1),0,1,null);fs.closeSync(fd);fs.writeFileSync('output.json',JSON.stringify(value));");
  expect(child.status,child.stderr).toBe(0);const trace=read();
  expect(trace.files).toContain('entry.mjs');expect(trace.files).toContain('used.mjs');expect(trace.files).toContain('raw.ts');
  expect(trace.files).not.toContain('unread.ts');expect(trace.opaque).toEqual([]);
});
it.each([
  ["import{spawnSync}from'node:child_process';spawnSync(process.execPath,['-e',\"require('fs').readFileSync('unread.ts')\"]);",'child-process'],
  ["try{process.dlopen({exports:{}},'missing-native-addon.node');}catch{}",'native-addon'],
  ["import'node:worker_threads';",'worker-or-network'],
  ["import'node:http';",'worker-or-network'],
])('marks opaque I/O for the conservative fallback: %s',(source,reason)=>{
  const {child,read}=fixture(source);expect(child.status,child.stderr).toBe(0);expect(read().opaque).toContain(reason);
});
it('does not publish a successful trace when a producer fails',()=>{
  const {child,receipt}=fixture("throw new Error('producer failed');");
  expect(child.status).not.toBe(0);expect(existsSync(receipt)).toBe(false);
});
