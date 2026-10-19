import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { admitColossusNative, COLOSSUS_NATIVE_CANDIDATE } from './colossus-native-admission.mjs';

const root = resolve(import.meta.dirname, '..');
await test('exact original payload admits only native22 candidate, with every acceptance flag false', () => {
  const { receipt, metadata, payload } = admitColossusNative(root);
  assert.equal(receipt.visualAcceptance, false); assert.equal(receipt.runtimeAcceptance, false);
  assert.equal(metadata.bodies.length, 1); assert.equal(metadata.bodies[0].bones.length, 22);
  assert.equal(payload.length, 76711); assert.equal(metadata.bodies[0].dims.bodyY, 2.28);
  assert.ok(metadata.bodies[0].dims.bodyRadius < 2.28); assert.ok(metadata.bodies[0].dims.headRadius < 1.12);
});
await test('incomplete, foreign, accepted and tampered tuples fail closed', () => {
  const scratch = resolve(root, `tmp/colossus-admission-test-${process.pid}`);
  const receiptPath = `${COLOSSUS_NATIVE_CANDIDATE}/admission.json`;
  const receipt = JSON.parse(readFileSync(resolve(root, receiptPath), 'utf8'));
  try {
    for (const path of [receiptPath, ...Object.keys(receipt.files)]) {
      const output = resolve(scratch, path); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, readFileSync(resolve(root, path)));
    }
    for (const mutate of [r => { delete r.files[Object.keys(r.files)[0]]; }, r => { r.files['../foreign'] = { sha256: 'x', bytes: 0 }; }, r => { r.runtimeAcceptance = true; }]) {
      const bad = structuredClone(receipt); mutate(bad); writeFileSync(resolve(scratch, receiptPath), JSON.stringify(bad));
      assert.throws(() => admitColossusNative(scratch), /Invalid|Incomplete/u);
    }
    writeFileSync(resolve(scratch, receiptPath), JSON.stringify(receipt));
    writeFileSync(resolve(scratch, COLOSSUS_NATIVE_CANDIDATE, 'metadata.json'), '{}');
    assert.throws(() => admitColossusNative(scratch), /tuple mismatch/u);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
