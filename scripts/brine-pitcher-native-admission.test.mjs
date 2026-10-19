import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { BRINE_PITCHER_NATIVE, admitBrinePitcherNative } from './brine-pitcher-native-admission.mjs';

const root=resolve(import.meta.dirname,'..');
function fixture(fn){
 mkdirSync(resolve(root,'tmp/brine-pitcher-admission-tests'),{recursive:true});
 const dir=mkdtempSync(resolve(root,'tmp/brine-pitcher-admission-tests/case-'));
 const receipt=JSON.parse(readFileSync(resolve(root,BRINE_PITCHER_NATIVE,'admission.json'),'utf8'));
 try {for(const path of [...Object.keys(receipt.files),`${BRINE_PITCHER_NATIVE}/admission.json`]){mkdirSync(dirname(resolve(dir,path)),{recursive:true});writeFileSync(resolve(dir,path),readFileSync(resolve(root,path)));}fn(dir,receipt);}finally{rmSync(dir,{recursive:true,force:true});}
}
await test('complete frozen source tuple passes structural admission only',()=>{const r=admitBrinePitcherNative(root);assert.equal(r.metadata.bodies[0].bones.length,7);assert.equal(r.receipt.runtimeAcceptance,false);});
await test('changed native metadata is refused',()=>fixture(dir=>{writeFileSync(resolve(dir,BRINE_PITCHER_NATIVE,'metadata.json'),'{}');assert.throws(()=>admitBrinePitcherNative(dir),/mismatch/);}));
await test('missing required behavior hash is refused',()=>fixture((dir,receipt)=>{delete receipt.files['src/shards/driftwood-isle/behaviour/brine-pitcher.as'];writeFileSync(resolve(dir,BRINE_PITCHER_NATIVE,'admission.json'),JSON.stringify(receipt));assert.throws(()=>admitBrinePitcherNative(dir),/Missing/);}));
await test('false promotion and traversal are refused',()=>fixture((dir,receipt)=>{receipt.runtimeAcceptance=true;writeFileSync(resolve(dir,BRINE_PITCHER_NATIVE,'admission.json'),JSON.stringify(receipt));assert.throws(()=>admitBrinePitcherNative(dir),/Invalid/);receipt.runtimeAcceptance=false;receipt.files['../outside']='x';writeFileSync(resolve(dir,BRINE_PITCHER_NATIVE,'admission.json'),JSON.stringify(receipt));assert.throws(()=>admitBrinePitcherNative(dir),/Foreign/);}));
