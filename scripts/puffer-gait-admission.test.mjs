import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { assertPufferGaitAdmission, V70_GAIT5_INPUT } from './puffer-gait-admission.mjs';
import { resolvePufferPreviewInput } from './puffer-preview-input.mjs';

const root = resolve('.'), directory = 'art/driftwood-isle/approved-puffer/';
const input = () => resolvePufferPreviewInput(root, `${directory}v70-gait5-preview-candidate.json`, `${directory}v70-gait5-dimensions.json`);

await test('exact V70 native, measurement and unchanged motion dependency tuple is admitted', () => {
  const receipt = assertPufferGaitAdmission(root, input(), 'gait5');
  assert.equal(receipt.profile, 'v70-rig1-gait5');
  assert.equal(receipt.originalSourceSha256, V70_GAIT5_INPUT.originalSourceSha256);
});

await test('existing pinned V57 rig1 gait4 and gait5 remain supported', () => {
  const legacy = { candidate: 'V57', sourceBytes: readFileSync(`${directory}unaccepted-v57-motion-rig1-native.json`),
    dimensionBytes: Buffer.from(JSON.stringify({ legLen: .24 / (2 * Math.sin(.36)) })) };
  for (const mode of ['gait4', 'gait5']) assert.equal(assertPufferGaitAdmission(root, legacy, mode), null);
  assert.throws(() => assertPufferGaitAdmission(root, { ...legacy, dimensionBytes: Buffer.from('{}') }, 'gait5'), /phase calibration/u);
  assert.throws(() => assertPufferGaitAdmission(root, { ...legacy, candidate: 'V70' }, 'gait5'), /Unadmitted/u);
});

await test('V70 wrong candidate, mode, source path, source bytes, dimensions or measurement fail closed', () => {
  const exact = input();
  const mutations = [{ candidate: 'V71' }, { sourceRelative: 'renamed-native.json' },
    { sourceBytes: readFileSync(`${directory}unaccepted-native-v70.json`) }, { measurementSha256: '0'.repeat(64) },
    { dimensionBytes: Buffer.from(JSON.stringify({ ...JSON.parse(exact.dimensionBytes), halfWidth: 9 })) }];
  for (const change of mutations) assert.throws(() => assertPufferGaitAdmission(root, { ...exact, ...change }, 'gait5'), /Unadmitted/u);
  assert.throws(() => assertPufferGaitAdmission(root, exact, 'gait4'), /Unadmitted/u);
});

await test('the original candidate, transfer receipt and actual pose sources cannot be substituted', () => {
  const scratch = resolve('tmp'); mkdirSync(scratch, { recursive: true });
  const temp = mkdtempSync(resolve(scratch, 'puffer-v70-admission-test-'));
  const files = [V70_GAIT5_INPUT.originalSource, V70_GAIT5_INPUT.equivalence,
    'src/shards/driftwood-isle/generators/pufferNativeClips.ts',
    'src/shards/driftwood-isle/generators/pufferNativeGait4Clips.ts', 'src/pufferGaitContinuityPreview.ts'];
  try {
    for (const file of files) { mkdirSync(dirname(resolve(temp, file)), { recursive: true }); writeFileSync(resolve(temp, file), readFileSync(file)); }
    assert.equal(assertPufferGaitAdmission(temp, input(), 'gait5').profile, 'v70-rig1-gait5');
    for (const file of files) {
      const original = readFileSync(file); writeFileSync(resolve(temp, file), Buffer.concat([original, Buffer.from('\n')]));
      assert.throws(() => assertPufferGaitAdmission(temp, input(), 'gait5'), /dependency mismatch/u);
      writeFileSync(resolve(temp, file), original);
    }
  } finally { rmSync(temp, { recursive: true }); }
});
