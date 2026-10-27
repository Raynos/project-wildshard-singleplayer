// oxlint-disable-next-line import/no-nodejs-modules -- Preserve original owned source/output mutation fixtures.
import {mkdirSync,mkdtempSync,readFileSync,realpathSync,rmSync,statSync,utimesSync,writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the owned fixture paths.
import {resolve} from 'node:path';
import {afterEach,expect,it} from 'vitest';
import {InputHashMemo,bakeInputHashes} from '../scripts/bake-input-hashes.mjs';
import {sourceSnapshotIdentity,publishSourceSnapshot,verifiedSourceSnapshot,committedSourceFiles} from '../scripts/source-input-proof.mjs';

const owned:string[]=[];
afterEach(()=>{for(const root of owned.splice(0))rmSync(root,{recursive:true,force:true});});

it('uses a root-matched mirror inventory without Git and refuses crossed, partial or invalid capabilities',()=>{
  const {root}=fixture(),base=realpathSync(root),inventory=resolve(root,'mirror-files.json');
  const env={WS_GENERATION_TREE_ROOT:base,WS_GENERATION_TREE_FILES:inventory};
  const files:[string,string]=['source/input.txt','source/output.txt'];
  writeFileSync(inventory,JSON.stringify({root:base,files}));
  expect(committedSourceFiles(root,env)).toEqual(files);
  expect(()=>committedSourceFiles(root,{...env,WS_GENERATION_TREE_ROOT:resolve(root,'foreign')})).toThrow('Crossed');
  expect(()=>committedSourceFiles(root,{WS_GENERATION_TREE_ROOT:base})).toThrow('Crossed');
  for(const row of [{root:resolve(root,'foreign'),files},{root:base,files:[...files,files[0]]},{root:base,files:['../escape']},{root:base,files,extra:true}]){
    writeFileSync(inventory,JSON.stringify(row));
    expect(()=>committedSourceFiles(root,env)).toThrow();
  }
});

function fixture() {
  mkdirSync('tmp',{recursive:true});const root=mkdtempSync(resolve('tmp/generation-snapshot-'));owned.push(root);
  mkdirSync(resolve(root,'source'));writeFileSync(resolve(root,'source/input.txt'),'input');writeFileSync(resolve(root,'source/output.txt'),'output');
  const memo=new InputHashMemo(root);memo.enableSnapshot(file=>file==='source/output.txt');bakeInputHashes(root,memo.paths('source'),memo);
  const receipt=resolve(root,'.cache/phase.json'),identity=sourceSnapshotIdentity({runtime:'fixture',recipe:['producer']});
  publishSourceSnapshot(receipt,identity,memo,{'source/output.txt':memo.hash('source/output.txt',true)});
  const valid=()=>{const current=new InputHashMemo(root);current.enableSnapshot(file=>file==='source/output.txt');return verifiedSourceSnapshot(receipt,identity,current,['source/output.txt']);};
  return {root,receipt,identity,valid};
}

it('checks current source bytes, broad-root additions, output bytes and negative output evidence',()=>{
  const {root,valid}=fixture();expect(valid()).toBe(true);
  writeFileSync(resolve(root,'source/added.txt'),'new');expect(valid()).toBe(false);rmSync(resolve(root,'source/added.txt'));expect(valid()).toBe(true);
  const input=resolve(root,'source/input.txt'),before=statSync(input);writeFileSync(input,'other');utimesSync(input,before.atime,before.mtime);expect(valid()).toBe(false);
  writeFileSync(input,'input');expect(valid()).toBe(true);
  writeFileSync(resolve(root,'source/output.txt'),'edited');expect(valid()).toBe(false);
  rmSync(resolve(root,'source/output.txt'));expect(valid()).toBe(false);
  writeFileSync(resolve(root,'source/output.txt'),'output');expect(valid()).toBe(true);
});

it('refuses crossed roots, recipe changes, incomplete receipts and modified seals',()=>{
  const {root,receipt,identity,valid}=fixture(),other=fixture();
  expect(verifiedSourceSnapshot(receipt,identity,new InputHashMemo(other.root),['source/output.txt'])).toBe(false);
  expect(verifiedSourceSnapshot(receipt,identity,new InputHashMemo(root),['source/output.txt','missing.txt'])).toBe(false);
  expect(verifiedSourceSnapshot(receipt,sourceSnapshotIdentity({runtime:'changed'}),new InputHashMemo(root),['source/output.txt'])).toBe(false);
  const bytes=readFileSync(receipt,'utf8');writeFileSync(receipt,bytes.replace('output.txt','changed.txt'));expect(valid()).toBe(false);
  writeFileSync(receipt,'{}');expect(valid()).toBe(false);rmSync(receipt);expect(valid()).toBe(false);
});

it('refuses to publish changed source bytes or an unverified local output',()=>{
  const {root,receipt,identity}=fixture(),memo=new InputHashMemo(root);memo.enableSnapshot(file=>file==='source/output.txt');bakeInputHashes(root,memo.paths('source'),memo);
  const output=memo.hash('source/output.txt',true);writeFileSync(resolve(root,'source/input.txt'),'other');
  expect(()=>publishSourceSnapshot(receipt,identity,memo,{'source/output.txt':output})).toThrow('Generation input changed');
  const fresh=new InputHashMemo(root);fresh.enableSnapshot(()=>false);
  expect(()=>publishSourceSnapshot(receipt,identity,fresh,{'source/output.txt':'0'.repeat(64)})).toThrow('Generation input changed');
});
