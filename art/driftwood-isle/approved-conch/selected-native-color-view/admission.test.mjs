import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admitSelectedNative } from './admission.mjs';
import { buildInputs, validateBuildPin, ROOT } from './build.mjs';
test('exact color source admitted without build or visual acceptance',()=>{
 const a=admitSelectedNative();assert.equal(a.manifest.buildAllowed,false);assert.equal(a.manifest.visualAcceptance,false);
 assert.equal(a.metadata.bodies[0].hard.length,15);assert.equal(a.payload.length,47157);
});
test('missing or forged reviewed permission fails closed',()=>{
 const a=admitSelectedNative();for(const pin of [null,{}, {buildAllowed:true}])assert.throws(()=>validateBuildPin(ROOT,a.manifest,pin));
});
test('input closure includes original, candidate, camera and renderer sources',()=>{
 const files=buildInputs(); for(const path of ['src/engine/render/graph/compile.ts','art/driftwood-isle/approved-conch/selected-native-color/graph.json','art/driftwood-isle/approved-conch/selected-native-color-view/comparison.mjs','art/driftwood-isle/approved-conch/selected-native-view/comparison.mjs'])assert.match(files[path],/^[a-f0-9]{64}$/u);
});
