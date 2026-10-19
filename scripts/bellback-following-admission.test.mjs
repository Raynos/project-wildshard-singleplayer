import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { admitBellbackFollowing, BELLBACK_FOLLOWING_CANDIDATE, BELLBACK_FOLLOWING_REQUIRED, bellbackHash } from './bellback-following-admission.mjs';

const root = resolve(import.meta.dirname, '..');
await test('exact unchanged Frame2 bytes admit candidate4 with eight following hulls', () => {
  const { receipt, metadata, payload } = admitBellbackFollowing(root);
  assert.equal(receipt.runtimeAcceptance, false); assert.equal(receipt.colliderAcceptance, false);
  assert.equal(payload.length, 38768); assert.equal(metadata.bytes, 695448);
  assert.deepEqual(metadata.bodies[0].dims.rigidCorpse.parts.map(p => p.points.length), [86,49,86,29,43,42,50,50]);
  const before = JSON.parse(readFileSync(resolve(root, 'art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate3/metadata.json')));
  delete metadata.bodies[0].dims.rigidCorpse; assert.deepEqual(metadata, before);
});
for (const [name, mutate] of [
  ['living dimensions', m => { m.bodies[0].dims.bodyY += .1; }],
  ['recipe inflation', m => { m.bodies[0].dims.rigidCorpse.parts[0].points[0][0] += .1; }],
  ['axis trick', m => { m.bodies[0].dims.capsuleAxis = 'y'; }],
  ['rig edit', m => { m.bodies[0].bones[0].pos[1] += .1; }],
  ['unknown metadata', m => { m.rootLift = 1; }],
]) await test(`refuse ${name} even with updated receipt hash`, () => {
  const scratch = resolve(root, `tmp/bellback-following-admission-${process.pid}-${name.replaceAll(' ', '-')}`);
  const receiptPath = `${BELLBACK_FOLLOWING_CANDIDATE}/admission.json`;
  try {
    for (const path of [receiptPath, ...BELLBACK_FOLLOWING_REQUIRED]) {
      const destination = resolve(scratch, path); mkdirSync(dirname(destination), {recursive:true}); writeFileSync(destination, readFileSync(resolve(root, path)));
    }
    const metadataPath = `${BELLBACK_FOLLOWING_CANDIDATE}/metadata.json`, metadata = JSON.parse(readFileSync(resolve(scratch, metadataPath)));
    mutate(metadata); const bytes = JSON.stringify(metadata); writeFileSync(resolve(scratch, metadataPath), bytes);
    const receipt = JSON.parse(readFileSync(resolve(scratch, receiptPath))); receipt.files[metadataPath] = bellbackHash(bytes); writeFileSync(resolve(scratch, receiptPath), JSON.stringify(receipt));
    assert.throws(() => admitBellbackFollowing(scratch), /changed beyond exact rigidCorpse/u);
  } finally { rmSync(scratch, {recursive:true,force:true}); }
});
