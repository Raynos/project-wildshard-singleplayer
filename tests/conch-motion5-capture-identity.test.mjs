// oxlint-disable-next-line import/no-nodejs-modules -- Explicit bytes for this Node-only receipt test.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only capture identity test needs real filesystem and test runner.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only capture identity test needs real filesystem and test runner.
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only capture identity test needs real filesystem and test runner.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Node-only capture identity test needs real filesystem and test runner.
import { test } from 'node:test';
import { exactInventory, verifyHostReceipt, hash } from '../scripts/qa-conch-motion5-identity.mjs';
import { FREEZE_SHA256 } from '../scripts/build-conch-motion5-preview.mjs';
import { analyzeMotion5Coverage } from '../scripts/qa-conch-motion5-coverage.mjs';

const preview=Buffer.from('test-preview');
const receipt={schema:'wildshard.conch.motion5.host-files.v1',sourceFreezeSha256:FREEZE_SHA256,
  previewSha256:hash(preview),visualAcceptance:false,runtimeAcceptance:false,colliderAcceptance:false,
  files:{'index.html':'a','conch-preview.json':hash(preview)}};
const actual={...receipt.files,'motion5-host-files.json':'manifest'};
await test('host accepts exactly matching receipt; rejects additions, deletions, altered bytes and old identity',()=>{
  verifyHostReceipt(receipt,actual,preview);
  for(const changed of [{...actual,extra:'b'},{'index.html':'a'},{...actual,'index.html':'b'}])
    assert.throws(()=>verifyHostReceipt(receipt,changed,preview),/inventory mismatch/u);
  assert.throws(()=>verifyHostReceipt({...receipt,schema:'motion4'},actual,preview),/Invalid/u);
  assert.throws(()=>verifyHostReceipt(receipt,actual,Buffer.from('changed')),/Invalid/u);
});
await test('inventory includes node_modules-looking directories and refuses symlinks',()=>{
  mkdirSync('tmp',{recursive:true}); const root=mkdtempSync(resolve('tmp/conch-motion5-capture-test-'));
  try {mkdirSync(join(root,'node_modules'));writeFileSync(join(root,'node_modules','evidence'),'data');
    assert.deepEqual(Object.keys(exactInventory(root)),['node_modules/evidence']);
    symlinkSync('evidence',join(root,'node_modules','alias'));
    assert.throws(()=>exactInventory(root),/Symlink/u);
  } finally {rmSync(root,{recursive:true,force:true});}
});
const row=(phase,time,stage=1)=>({bout:1,frame:time,sampleIndex:time,wallTime:time,stage,clock:time,
  strike:{phase,elapsed:time},bones:{},alive:true,poseInput:null});
await test('coverage never substitutes a press or a late collision for required early guarded hits',()=>{
  const late={...row('windup',.4),kind:'enemy-damage-before-presentation',guard:1};
  const coverage=analyzeMotion5Coverage([], [late]);
  assert.equal(coverage.targets[0].status,'not-observed');assert.equal(coverage.targets[1].status,'not-observed');
  const early={...late,clock:.2,poseInput:{clock:.19,stage:1,poseIndex:3}};
  assert.equal(analyzeMotion5Coverage([], [early]).targets[1].status,'observed-at-real-collision');
});
await test('whole cycles require ordered windup, active, recover and idle within one bout',()=>{
  const trace=['windup','active','recover','idle'].map((phase,i)=>row(phase,i));
  assert.equal(analyzeMotion5Coverage(trace,[]).ordinaryWholeCycles,1);
  assert.equal(analyzeMotion5Coverage(trace.slice(0,3),[]).ordinaryWholeCycles,0);
  assert.equal(analyzeMotion5Coverage(trace,[{...trace[1],kind:'enemy-damage-before-presentation'}]).ordinaryWholeCycles,0);
  trace[3].bout=2;assert.equal(analyzeMotion5Coverage(trace,[]).ordinaryWholeCycles,0);
});
await test('new observer owns motion5 label and retains pose clocks, floor and local/world transforms',()=>{
  const source=readFileSync('scripts/qa-conch-motion5-observation.mjs','utf8');
  for(const token of ['CONCH MOTION5','poseIndex','tg-state','groundHeight','bone.matrixWorld','bone.rotation','c.attack','c.flinch']) assert.ok(source.includes(token));
  assert.ok(!source.includes('CONCH MOTION4'));
});
