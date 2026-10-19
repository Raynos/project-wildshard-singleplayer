import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { admitMantisEarlyKnee, MANTIS_EARLY_KNEE_CANDIDATE } from './mantis-early-knee-admission.mjs';

const root = resolve(import.meta.dirname, '..');
await test('exact V7 tuple admits only Mantis and explicit FL FR RL RR diagnostic foot order', () => {
  const { receipt, metadata, payload } = admitMantisEarlyKnee(root);
  assert.equal(receipt.visualAcceptance, false); assert.equal(receipt.runtimeAcceptance, false);
  assert.deepEqual(receipt.footOrder, [0, 2, 1, 3]);
  assert.equal(metadata.bodies.length, 1); assert.equal(metadata.bodies[0].bones.length, 22);
  assert.equal(payload.length, 28370);
  assert.equal(metadata.bodies[0].dims.bodyRadius, .4);
  assert.equal(metadata.bodies[0].dims.bodyHalfLen, 1.27);
  assert.equal(metadata.bodies[0].dims.headRadius, .5);
  const feet = metadata.bodies[0].dims.feet;
  assert.ok(feet[0][0] < 0 && feet[0][1] > 0); assert.ok(feet[1][0] > 0 && feet[1][1] > 0);
  assert.ok(feet[2][0] < 0 && feet[2][1] < 0); assert.ok(feet[3][0] > 0 && feet[3][1] < 0);
});
await test('tampered candidate bytes are refused rather than becoming an engine exemption', () => {
  const scratch = resolve(root, `tmp/mantis-early-knee-admission-test-${process.pid}`);
  const receiptPath = `${MANTIS_EARLY_KNEE_CANDIDATE}/admission.json`;
  const receipt = JSON.parse(readFileSync(resolve(root, receiptPath), 'utf8'));
  try {
    for (const path of [receiptPath, ...Object.keys(receipt.files)]) {
      const output = resolve(scratch, path); mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, readFileSync(resolve(root, path)));
    }
    writeFileSync(resolve(scratch, MANTIS_EARLY_KNEE_CANDIDATE, 'metadata.json'), '{}');
    assert.throws(() => admitMantisEarlyKnee(scratch), /tuple mismatch/u);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

await test('receipt edits cannot self-authorize changed, missing or additional tuple members', () => {
  const scratch = resolve(root, `tmp/mantis-early-knee-receipt-test-${process.pid}`);
  const path = resolve(scratch, MANTIS_EARLY_KNEE_CANDIDATE, 'admission.json');
  const original = JSON.parse(readFileSync(resolve(root, MANTIS_EARLY_KNEE_CANDIDATE, 'admission.json'), 'utf8'));
  try {
    mkdirSync(dirname(path), { recursive: true });
    for (const mutate of [
      receipt => { delete receipt.files['src/shards/driftwood-isle/behaviour/splinterMantis.as']; },
      receipt => { receipt.files['src/engine/exemption.ts'] = '0'.repeat(64); },
      receipt => { receipt.files['src/shards/driftwood-isle/generators/mantisEarlyKneeClips.ts'] = '0'.repeat(64); },
      receipt => { receipt.visualAcceptance = true; },
      receipt => { receipt.candidate = 'V7-native22-motion4'; },
      receipt => { receipt.observation.cadenceHz = 60; },
    ]) {
      const receipt = structuredClone(original); mutate(receipt);
      writeFileSync(path, JSON.stringify(receipt));
      assert.throws(() => admitMantisEarlyKnee(scratch), /exact admission mismatch/u);
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
