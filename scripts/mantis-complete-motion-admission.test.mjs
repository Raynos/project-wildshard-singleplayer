import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { admitMantisCompleteMotionSource } from './mantis-complete-motion-admission.mjs';

const root=resolve(import.meta.dirname,'..'), receiptPath='docs/reviews/mantis-complete-motion-plan/source-freeze.json';
test('source-only tuple preserves exact candidate7 and never claims a built product',()=>{
  const {receipt,original}=admitMantisCompleteMotionSource(root);
  assert.equal(receipt.productBuilt,false);assert.equal(receipt.visualAcceptance,false);assert.equal(original.receipt.candidate,'V7-native22-motion7');
});
test('changed adapter and self-authorizing receipt edits are refused',()=>{
  const scratch=resolve(root,`tmp/mantis-complete-motion-admission-${process.pid}`);
  const receipt=JSON.parse(readFileSync(resolve(root,receiptPath),'utf8'));
  const oldPath='art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate7/admission.json';
  const old=JSON.parse(readFileSync(resolve(root,oldPath),'utf8'));
  try {
    for(const path of new Set([receiptPath,oldPath,...Object.keys(old.files),...Object.keys(receipt.files)])){
      const output=resolve(scratch,path);mkdirSync(dirname(output),{recursive:true});writeFileSync(output,readFileSync(resolve(root,path)));
    }
    assert.doesNotThrow(()=>admitMantisCompleteMotionSource(scratch));
    const target='src/game/plugin/channelPrograms.ts';writeFileSync(resolve(scratch,target),'tampered');
    assert.throws(()=>admitMantisCompleteMotionSource(scratch),/source tuple mismatch/u);
    writeFileSync(resolve(scratch,target),readFileSync(resolve(root,target)));
    const changed=structuredClone(receipt);changed.runtimeAcceptance=true;writeFileSync(resolve(scratch,receiptPath),JSON.stringify(changed));
    assert.throws(()=>admitMantisCompleteMotionSource(scratch),/exact source receipt mismatch/u);
  }finally{rmSync(scratch,{recursive:true,force:true});}
});
test('the unchanged strict source gate refuses the preserved failed motion',async()=>{
  const {motionSourceGate,requireMotionSourceGate}=await import('../docs/reviews/mantis-complete-motion-plan/gate.mjs');
  const motion=JSON.parse(readFileSync(resolve(root,'docs/reviews/mantis-complete-motion-plan/motion-results.json'),'utf8'));
  const stance=JSON.parse(readFileSync(resolve(root,'docs/reviews/mantis-complete-motion-plan/stance-results.json'),'utf8'));
  assert.equal(motionSourceGate(motion,stance),false);
  assert.throws(()=>requireMotionSourceGate(motion,stance),/Rejected Mantis source motion/u);
});
