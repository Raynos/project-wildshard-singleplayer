import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { admitMantisNative, MANTIS_CANDIDATE } from './mantis-native-admission.mjs';

const root = resolve(import.meta.dirname, '..');
await test('exact V7 tuple admits only Mantis and explicit FL FR RL RR diagnostic foot order', () => {
  const { receipt, metadata, payload } = admitMantisNative(root);
  assert.equal(receipt.visualAcceptance, false); assert.equal(receipt.runtimeAcceptance, false);
  assert.deepEqual(receipt.footOrder, [0, 2, 1, 3]);
  assert.equal(metadata.bodies.length, 1); assert.equal(metadata.bodies[0].bones.length, 22);
  assert.equal(payload.length, 28370);
  const feet = metadata.bodies[0].dims.feet;
  assert.ok(feet[0][0] < 0 && feet[0][1] > 0); assert.ok(feet[1][0] > 0 && feet[1][1] > 0);
  assert.ok(feet[2][0] < 0 && feet[2][1] < 0); assert.ok(feet[3][0] > 0 && feet[3][1] < 0);
});
await test('tampered candidate bytes are refused rather than becoming an engine exemption', () => {
  const scratch = resolve(root, `tmp/mantis-admission-test-${process.pid}`);
  const receiptPath = `${MANTIS_CANDIDATE}/admission.json`;
  const receipt = JSON.parse(readFileSync(resolve(root, receiptPath), 'utf8'));
  try {
    for (const path of [receiptPath, ...Object.keys(receipt.files)]) {
      const output = resolve(scratch, path); mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, readFileSync(resolve(root, path)));
    }
    writeFileSync(resolve(scratch, MANTIS_CANDIDATE, 'metadata.json'), '{}');
    assert.throws(() => admitMantisNative(scratch), /tuple mismatch/u);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
