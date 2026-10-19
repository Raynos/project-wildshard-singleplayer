import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { CONCH_ORIGINAL, CONCH_CANDIDATE, prepareConchFrame, conchCanonicalPoint, conchNativePoint } from './conch-native-frame.mjs';

const result = prepareConchFrame(process.cwd());
const original = JSON.parse(readFileSync(`${CONCH_ORIGINAL}/metadata.json`));
const before = inflateSync(readFileSync(`${CONCH_ORIGINAL}/payload.bin`));
const after = inflateSync(result.payload);
test('candidate exactly reproduces, centers root and faces +Z without reflection', () => {
  assert.deepEqual(JSON.parse(readFileSync(`${CONCH_CANDIDATE}/metadata.json`)), result.metadata);
  assert.deepEqual(readFileSync(`${CONCH_CANDIDATE}/payload.bin`), result.payload);
  assert.deepEqual(result.metadata.bodies[0].bones[0].pos, [0,1.04,0]);
  assert.equal(result.transform.determinant, 1);
  assert.deepEqual(conchCanonicalPoint([0,0,-1]).map((v,i) => v-conchCanonicalPoint([0,0,0])[i]), [0,0,1]);
  for (const bone of original.bodies[0].bones) conchNativePoint(conchCanonicalPoint(bone.pos)).forEach((v,i) => { assert.ok(Math.abs(v-bone.pos[i])<1e-14); });
});
test('every vertex transforms once; every other packed byte stays unchanged', () => {
  const restored = Buffer.from(after); let count = 0;
  for (const part of original.bodies[0].hard) for (let vertex = 0; vertex < part.row.count; vertex++) {
    const at = part.offsets[0]+vertex*12;
    const point = [0,1,2].map(axis => before.readFloatLE(at+axis*4));
    conchCanonicalPoint(point).forEach((v,i) => { assert.equal(after.readFloatLE(at+i*4), Math.fround(v)); });
    before.copy(restored, at, at, at+12); count++;
  }
  assert.equal(count,7338); assert.deepEqual(restored,before);
});
test('parents, diagnostic radii and native foot identity persist', () => {
  const a=original.bodies[0], b=result.metadata.bodies[0];
  assert.deepEqual(a.bones.map(({name,parent})=>({name,parent})),b.bones.map(({name,parent})=>({name,parent})));
  for (const key of ['bodyY','bodyRadius','headRadius','legLen','halfWidth','capsuleAxis']) assert.equal(a.dims[key],b.dims[key]);
  assert.ok(b.dims.feet[0][0]<0 && b.dims.feet[1][0]>0);
  assert.equal(result.transform.runtimeAcceptance,false);
});
