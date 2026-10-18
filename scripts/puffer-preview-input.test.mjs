import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { resolvePufferPreviewInput, previewHash } from './puffer-preview-input.mjs';

await test('V23 preserved default retains exact native identity', () => {
  const input = resolvePufferPreviewInput(resolve('.'), undefined, 'art/driftwood-isle/approved-puffer/unaccepted-native-v23-preview-dimensions.json');
  assert.equal(input.candidate, 'V23'); assert.equal(input.measurementSha256, null);
});

await test('explicit candidate is pinned to native and measured dimension bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'puffer-preview-input-'));
  try {
    const native = '{}', dims = '{}', descriptor = join(root, 'candidate.json'), dimensions = join(root, 'dimensions.json');
    writeFileSync(join(root, 'native.json'), native); writeFileSync(dimensions, dims);
    const receipt = { sourceSha256: previewHash(native), dimensionsSha256: previewHash(dims), colliderAcceptance: false, visualAcceptance: false };
    writeFileSync(join(root, 'measurement.json'), JSON.stringify(receipt));
    const candidate = { candidate: 'V38', source: 'native.json', sourceSha256: previewHash(native), measurement: 'measurement.json' };
    writeFileSync(descriptor, JSON.stringify(candidate));
    assert.equal(resolvePufferPreviewInput(root, descriptor, dimensions).candidate, 'V38');
    writeFileSync(dimensions, '{"bodyY":0.6}');
    assert.throws(() => resolvePufferPreviewInput(root, descriptor, dimensions), /dimension receipt mismatch/u);
    writeFileSync(dimensions, dims); writeFileSync(join(root, 'native.json'), '[]');
    assert.throws(() => resolvePufferPreviewInput(root, descriptor, dimensions), /source hash mismatch/u);
    writeFileSync(descriptor, JSON.stringify({ ...candidate, source: '../foreign.json' }));
    assert.throws(() => resolvePufferPreviewInput(root, descriptor, dimensions), /inside this project/u);
  } finally { rmSync(root, { recursive: true }); }
});
