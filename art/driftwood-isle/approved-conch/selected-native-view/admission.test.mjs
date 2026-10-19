import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { safeRead, verifyPins, admitSelectedNative } from './admission.mjs';
import { verifyHostReceipt } from './identity.mjs';
import { FREEZE_SHA256 } from './build.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');
function fixture(fn) {
  mkdirSync('tmp/conch-selected-view-test', {recursive:true});
  const root=mkdtempSync('tmp/conch-selected-view-test/unit-');
  try { const pins={}; for(let i=0;i<20;i++) { const name=`file-${i}`;writeFileSync(join(root,name),name);pins[name]={bytes:Buffer.byteLength(name),sha256:hash(name)}; } fn(root,pins); }
  finally { rmSync(root,{recursive:true,force:true}); }
}
test('exact pins reject altered weights, normals, materials or any native/source bytes',()=>fixture((root,pins)=>{
  verifyPins(root,pins);writeFileSync(join(root,'file-4'),'tampered');assert.throws(()=>verifyPins(root,pins),/changed/u);
}));
test('pin reads refuse source symlinks and path traversal',()=>fixture((root,pins)=>{
  symlinkSync('file-0',join(root,'link'));assert.throws(()=>safeRead(root,'link'),/symlink/u);
  assert.throws(()=>safeRead(root,'../file'),/Unsafe/u);delete pins['file-0'];assert.throws(()=>verifyPins(root,pins),/Missing/u);
}));
test('host inventory rejects stale fallback, additions, missing files and receipt mutation',()=>{
  const bytes=Buffer.from('new candidate'), files={'index.html':hash('host')};
  const receipt={schema:'wildshard.conch.selected-view.host-files.v1',sourceFreezeSha256:FREEZE_SHA256,previewSha256:hash(bytes),files,visualAcceptance:false,runtimeAcceptance:false,colliderAcceptance:false};
  verifyHostReceipt(receipt,files,bytes);
  assert.throws(()=>verifyHostReceipt(receipt,{...files,oldAsset:'stale'},bytes),/inventory/u);
  assert.throws(()=>verifyHostReceipt(receipt,{},bytes),/inventory/u);
  assert.throws(()=>verifyHostReceipt(receipt,files,Buffer.from('old candidate')),/receipt/u);
});
test('exact candidate admission or explicit pending-checkpoint refusal, never old assets',()=>{
  const source=readFileSync('art/driftwood-isle/approved-conch/selected-native-view/admission.mjs','utf8');
  if(source.includes("= 'PENDING_ROOT_CHECKPOINT'")) assert.throws(()=>admitSelectedNative(),/checkpoint pending/u);
  else { const admitted=admitSelectedNative();assert.equal(admitted.metadata.file,'/assets/driftwood-isle/conch-selected-normals-cfd4a13e900eaea9675c047b73759411eaa6d2f484d2bc110fb32669d9e3d544.bin');assert.equal(admitted.manifest.buildAllowed,false); }
});
