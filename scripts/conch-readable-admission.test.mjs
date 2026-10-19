import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { admitConchReadable } from './conch-readable-admission.mjs';

test('source freeze preserves motion3 admission and forbids build acceptance', () => {
  const { manifest, metadata } = admitConchReadable(resolve(import.meta.dirname, '..'));
  assert.equal(manifest.buildAllowed, false);
  assert.equal(manifest.visualAcceptance, false);
  assert.equal(manifest.runtimeAcceptance, false);
  assert.equal(metadata.bodies[0].bones.length, 15);
});
