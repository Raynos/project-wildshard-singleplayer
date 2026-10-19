import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { admitBellbackCaptured, BELLBACK_CAPTURED_CANDIDATE, BELLBACK_CAPTURED_REQUIRED, bellbackHash } from './bellback-captured-admission.mjs';

const root = resolve(import.meta.dirname, '..');
const receiptPath = `${BELLBACK_CAPTURED_CANDIDATE}/admission.json`;
const metadataPath = `${BELLBACK_CAPTURED_CANDIDATE}/metadata.json`;
function fixture(name, run) {
  const scratch = resolve(root, `tmp/bellback-captured-admission-${process.pid}-${name.replaceAll(' ', '-')}`);
  try {
    for (const path of [receiptPath, ...BELLBACK_CAPTURED_REQUIRED]) {
      const destination = resolve(scratch, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, readFileSync(resolve(root, path)));
    }
    const receipt = JSON.parse(readFileSync(resolve(scratch, receiptPath)));
    const replace = (path, bytes) => {
      writeFileSync(resolve(scratch, path), bytes);
      receipt.files[path] = bellbackHash(bytes);
    };
    run({ scratch, receipt, replace, save: () => writeFileSync(resolve(scratch, receiptPath), JSON.stringify(receipt)) });
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
await test('candidate5 admits the exact captured-only metadata delta and unchanged Frame2 payload', () => {
  const { receipt, metadata, payload } = admitBellbackCaptured(root);
  for (const key of ['visualAcceptance', 'colliderAcceptance', 'runtimeAcceptance', 'contactAcceptance']) assert.equal(receipt[key], false);
  assert.equal(payload.length, 38768); assert.equal(metadata.bytes, 695448);
  assert.equal(metadata.bodies[0].dims.rigidCorpse.posePolicy, 'captured');
  assert.deepEqual(metadata.bodies[0].dims.rigidCorpse.parts.map(p => p.points.length), [86,49,86,29,43,42,50,50]);
  const before = JSON.parse(readFileSync(resolve(root, 'art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/metadata.json')));
  delete metadata.bodies[0].dims.rigidCorpse.posePolicy;
  assert.deepEqual(metadata, before);
});
for (const [name, mutate] of [
  ['missing policy', m => { delete m.bodies[0].dims.rigidCorpse.posePolicy; }],
  ['animated policy', m => { m.bodies[0].dims.rigidCorpse.posePolicy = 'animated'; }],
  ['null policy', m => { m.bodies[0].dims.rigidCorpse.posePolicy = null; }],
  ['unknown policy', m => { m.bodies[0].dims.rigidCorpse.posePolicy = 'callback'; }],
  ['living dimensions', m => { m.bodies[0].dims.bodyY += .1; }],
  ['recipe inflation', m => { m.bodies[0].dims.rigidCorpse.parts[0].points[0][0] += .1; }],
  ['axis trick', m => { m.bodies[0].dims.capsuleAxis = 'y'; }],
  ['rig edit', m => { m.bodies[0].bones[0].pos[1] += .1; }],
  ['root lift', m => { m.rootLift = 1; }],
  ['callback', m => { m.bodies[0].dims.rigidCorpse.samplePose = 'custom'; }],
  ['padding', m => { m.bodies[0].dims.rigidCorpse.padding = .1; }],
  ['payload location', m => { m.file = '/assets/other.bin'; }],
]) await test(`refuse ${name} even with updated receipt hash`, () => fixture(name, ({ replace, save, scratch }) => {
  const metadata = JSON.parse(readFileSync(resolve(scratch, metadataPath)));
  mutate(metadata); replace(metadataPath, JSON.stringify(metadata)); save();
  assert.throws(() => admitBellbackCaptured(scratch), /changed beyond exact captured pose policy/u);
}));
for (const path of [
  'art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/metadata.json',
  'art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/payload.bin',
  'art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json',
  'src/shards/driftwood-isle/generators/bellbackTuckedClips.ts',
  'src/shards/driftwood-isle/behaviour/bellback.as',
  'src/shards/driftwood-isle/generators/tidalGiantsCombat.ts',
]) await test(`canonical pin refuses rehashed ${path}`, () => fixture('canonical', ({ replace, save, scratch }) => {
  replace(path, Buffer.concat([readFileSync(resolve(scratch, path)), Buffer.from(' ')])); save();
  assert.throws(() => admitBellbackCaptured(scratch), /Changed canonical Bellback input/u);
}));
for (const [name, mutate, message] of [
  ['missing tuple', r => { delete r.files[metadataPath]; }, /Incomplete or foreign/u],
  ['foreign tuple', r => { r.files.foreign = '0'.repeat(64); }, /Incomplete or foreign/u],
  ['acceptance claim', r => { r.runtimeAcceptance = true; }, /Invalid Bellback captured/u],
  ['foreign receipt', r => { r.rootLift = 1; }, /Invalid Bellback captured/u],
]) await test(`refuse ${name}`, () => fixture(name, ({ receipt, save, scratch }) => {
  mutate(receipt); save(); assert.throws(() => admitBellbackCaptured(scratch), message);
}));
await test('refuse metadata tampering without an updated receipt', () => fixture('stale-hash', ({ scratch }) => {
  writeFileSync(resolve(scratch, metadataPath), '{}');
  assert.throws(() => admitBellbackCaptured(scratch), /Bellback tuple mismatch/u);
}));
