import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { admitConchGrounded, CONCH_GROUNDED_CANDIDATE } from './conch-grounded-admission.mjs';

const root = resolve(import.meta.dirname, '..');
await test('exact canonical native15 admits only isolated measured torso dimensions', () => {
  const { receipt, metadata, payload } = admitConchGrounded(root);
  assert.equal(receipt.runtimeAcceptance, false); assert.equal(receipt.colliderAcceptance, false);
  assert.equal(payload.length, 25392); assert.equal(metadata.bodies.length, 1);
  assert.equal(metadata.bodies[0].dims.capsuleAxis, 'y');
  assert.ok(metadata.bodies[0].dims.bodyRadius < .51);
  assert.equal(metadata.bodies[0].bones.length, 15);
});
await test('changed candidate is rejected while the frozen tuple remains pinned', () => {
  const scratch = resolve(root, `tmp/conch-admission-test-${process.pid}`);
  const canonical = 'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
  const receiptPath = `${CONCH_GROUNDED_CANDIDATE}/admission.json`;
  const receipt = JSON.parse(readFileSync(resolve(root, receiptPath)));
  const closure = JSON.parse(readFileSync(resolve(root, canonical, 'closure.json')));
  try {
    for (const path of new Set([receiptPath, `${canonical}/closure.json`, ...Object.keys(receipt.files), ...Object.keys(closure.files)])) {
      const output = resolve(scratch, path); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, readFileSync(resolve(root, path)));
    }
    writeFileSync(resolve(scratch, CONCH_GROUNDED_CANDIDATE, 'metadata.json'), '{}');
    assert.throws(() => admitConchGrounded(scratch), /tuple mismatch/u);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});
