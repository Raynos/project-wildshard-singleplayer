import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, symlinkSync, unlinkSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { CLOSED_ANATOMY_INPUT as pin, assertClosedAnatomyPreviewPolicy, resolvePufferAppCandidate, assertClosedAnatomyPackedOutput } from './puffer-closed-anatomy-admission.mjs';
import { resolvePufferPreviewInput, previewHash } from './puffer-preview-input.mjs';
import { assertPufferGaitAdmission } from './puffer-gait-admission.mjs';

const root = resolve('.');
const study = 'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/';
const original = 'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/closed-anatomy-native.json';
const reference = 'art/driftwood-isle/approved-puffer/unaccepted-v70-motion-rig1-native.json';
const input = () => resolvePufferPreviewInput(root, pin.descriptor, pin.dimensions);
const json = file => JSON.parse(readFileSync(resolve(root, file), 'utf8'));

await test('one named derivative resolves with exact historical dimensions and no acceptance claim', () => {
  const exact = input(), admission = assertPufferGaitAdmission(root, exact, 'gait5');
  assert.equal(exact.candidate, pin.sourceIdentity);
  assert.equal(exact.rigProfile, 'closed-anatomy-rig1');
  assert.equal(admission.profile, pin.profile);
  assert.equal(previewHash(exact.dimensionBytes), pin.dimensionsSha256);
  assert.deepEqual(exact.dimensionBytes, readFileSync('art/driftwood-isle/approved-puffer/v70-gait5-dimensions.json'));
  for (const field of ['colliderAcceptance', 'physicalAcceptance', 'physicalDeathAcceptance', 'visualAcceptance', 'animationAcceptance']) {
    assert.equal(admission[field], false); assert.equal(json(pin.measurement)[field], false);
  }
  assert.equal(json(pin.measurement).measuredDimensions.bodyRadius, .9631455207963731);
  assert.equal(json(pin.measurement).dimensions.bodyRadius, .8693322053090293);
});

await test('independent source comparison proves exactly 552 fin rows, immutable non-skin and exact reference fins', () => {
  const source = json(original), derivative = json(pin.source), public70 = json(reference);
  const receipt = json(`${study}transfer-receipt.json`);
  assert.deepEqual(source.bones, public70.bones);
  const stripSkin = model => ({ ...model, parts: model.parts.map(({ skinIndices: _skinIndices, skinWeights: _skinWeights, ...rest }) => rest) });
  assert.deepEqual(stripSkin(derivative), stripSkin(source));
  assert.deepEqual(derivative.parts.slice(0, 3), source.parts.slice(0, 3));
  let total = 0;
  for (const name of ['finL', 'finR', 'rearL', 'rearR']) {
    const label = `Volumetric connected ${name}`;
    const before = source.parts.find(part => part.name === label), after = derivative.parts.find(part => part.name === label);
    assert.deepEqual(after, public70.parts.find(part => part.name === label));
    const changed = [];
    for (let i = 0; i < before.positions.length / 3; i++) {
      if (JSON.stringify([before.skinIndices.slice(i * 4, i * 4 + 4), before.skinWeights.slice(i * 4, i * 4 + 4)])
        !== JSON.stringify([after.skinIndices.slice(i * 4, i * 4 + 4), after.skinWeights.slice(i * 4, i * 4 + 4)])) changed.push(i);
    }
    assert.equal(changed.length, 138); total += changed.length;
    assert.deepEqual(changed, receipt.parts.find(part => part.name === label).changedWeightRowIndices);
  }
  assert.equal(total, 552); assert.equal(receipt.changedWeightRows, total);
  assert.equal(previewHash(readFileSync(pin.source)), receipt.derivativeSha256);
  assert.equal(previewHash(readFileSync(`${study}transfer_weights.py`)), receipt.recipeSha256);
});

await test('identity, profile, source, weights, dimensions, receipt and mode mutations fail closed', () => {
  const exact = input(), weights = JSON.parse(exact.sourceBytes);
  weights.parts[3].skinWeights[0] += .001;
  for (const change of [{ candidate: 'V70' }, { candidate: 'puffer-closed-anatomy-other' },
    { sourceIdentity: 'puffer-closed-anatomy-other' }, { rigProfile: 'closed-anatomy-rig2' },
    { descriptorSha256: '0'.repeat(64) }, { sourceRelative: original },
    { sourceBytes: readFileSync(original) }, { sourceBytes: Buffer.from(JSON.stringify(weights)) },
    { dimensionBytes: Buffer.from(JSON.stringify({ ...JSON.parse(exact.dimensionBytes), bodyRadius: 1 })) },
    { measurementSha256: '0'.repeat(64) }]) {
    assert.throws(() => assertPufferGaitAdmission(root, { ...exact, ...change }, 'gait5'), /Unadmitted/u);
  }
  for (const mode of ['rest', 'inflate-105', 'inflate-110', 'attack', 'gait4', 'gait6'])
    assert.throws(() => assertPufferGaitAdmission(root, exact, mode), /Unadmitted/u);
});

await test('the complete source and renderer tuple cannot opt out of gray-v2 or contact-v1', () => {
  const admitted = assertPufferGaitAdmission(root, input(), 'gait5');
  assert.equal(assertClosedAnatomyPreviewPolicy(admitted, 'gait5', 'neutral-gray-v2', 'contact-v1'), 'authored-pose');
  for (const lighting of [null, undefined, 'neutral-studio-v1', 'neutral-gray-v3'])
    assert.throws(() => assertClosedAnatomyPreviewPolicy(admitted, 'gait5', lighting, 'contact-v1'), /exact/u);
  for (const contact of [null, undefined, 'contact-v2'])
    assert.throws(() => assertClosedAnatomyPreviewPolicy(admitted, 'gait5', 'neutral-gray-v2', contact), /exact/u);
  assert.throws(() => assertClosedAnatomyPreviewPolicy({ profile: 'v70-rig1-gait5' }, 'gait5', 'neutral-gray-v2', 'contact-v1'), /exact/u);
});

await test('descriptor and every critical dependency are pinned, including transfer proof, numeric consumer and SDK', () => {
  mkdirSync(resolve(root, 'tmp'), { recursive: true });
  const temp = mkdtempSync(resolve(root, 'tmp/puffer-closed-admission-test-'));
  const manifest = json(pin.dependencies);
  const files = new Set([...Object.keys(manifest.files), pin.descriptor, pin.dimensions, pin.measurement, pin.dependencies]);
  try {
    // File-level read-only links avoid copying a checkout. Mutations replace only owned scratch links.
    for (const file of files) { const target = resolve(temp, file); mkdirSync(dirname(target), { recursive: true }); symlinkSync(resolve(root, file), target); }
    assert.equal(assertPufferGaitAdmission(temp, input(), 'gait5').profile, pin.profile);
    const critical = [pin.descriptor, pin.measurement, pin.dependencies, pin.dimensions, pin.source, original, reference,
      `${study}transfer-receipt.json`, `${study}transfer_weights.py`, `${study}runtime-envelope-results.json`,
      `${study}semantic-envelope-audit.json`, 'art/driftwood-isle/approved-puffer/native_export.py',
      'src/shards/driftwood-isle/generators/pufferNativeClips.ts', 'src/shards/driftwood-isle/generators/pufferNativeGait4Clips.ts',
      'src/pufferGaitContinuityPreview.ts', 'src/game/plugin/channelPrograms.ts', 'src/game/plugin/geometry.ts',
      'src/sdk/outputProduct.ts', 'src/shards/driftwood-isle/data/practiceNeutralGrayLighting.json',
      'src/shards/driftwood-isle/data/practiceLighting.json', 'src/shards/driftwood-isle/behaviour/brinePuffer.as'];
    for (const file of critical) {
      assert.ok(files.has(file), `missing dependency pin: ${file}`);
      const target = resolve(temp, file); unlinkSync(target);
      writeFileSync(target, Buffer.concat([readFileSync(resolve(root, file)), Buffer.from('\n')]));
      assert.throws(() => assertPufferGaitAdmission(temp, input(), 'gait5'), /dependency mismatch/u, file);
      unlinkSync(target); symlinkSync(resolve(root, file), target);
    }
    const descriptor = resolve(temp, pin.descriptor); unlinkSync(descriptor);
    for (const change of [{ sourceIdentity: 'other' }, { schema: 'wildshard.puffer.closed-anatomy-preview-input.v2' },
      { sourceSha256: '0'.repeat(64) }, { candidate: 'V70' }, { measurement: '../foreign.json' }]) {
      writeFileSync(descriptor, JSON.stringify({ ...json(pin.descriptor), ...change }));
      assert.throws(() => resolvePufferPreviewInput(temp, descriptor, resolve(root, pin.dimensions)), /descriptor/u);
    }
  } finally { rmSync(temp, { recursive: true }); }
});

await test('builder gates named sources even in non-gait modes and writes the explicit identity', () => {
  const builder = readFileSync('scripts/build-puffer-native-preview.mjs', 'utf8');
  assert.match(builder, /closedAnatomy \|\| mode === 'gait4'/u);
  assert.match(builder, /assertClosedAnatomyPreviewPolicy\(rigAdmission, mode, arenaLighting, arenaOcclusion\)/u);
  assert.match(builder, /sourceIdentity: input.sourceIdentity, rigProfile: input.rigProfile/u);
  assert.ok(builder.indexOf('assertClosedAnatomyPreviewPolicy(rigAdmission') < builder.indexOf('mkdirSync(destination'));
});


await test('deterministic metadata and payload pins are independently reproduced in memory, without a product build', () => {
  const output = JSON.parse(execFileSync('python3', ['-c', `
import sys,json,base64
sys.dont_write_bytecode=True
sys.path.insert(0,'art/driftwood-isle/approved-puffer')
from native_export import pack_native_puffer
source=json.load(open('${pin.source}')); dims=json.load(open('${pin.dimensions}'))
metadata,payload=pack_native_puffer(source,dims)
print(json.dumps({'metadata':json.dumps(metadata,separators=(',',':')),'payload':base64.b64encode(payload).decode()}))
`], { cwd: root, maxBuffer: 1000000 }).toString());
  const metadata = Buffer.from(output.metadata), payload = Buffer.from(output.payload, 'base64');
  assert.doesNotThrow(() => assertClosedAnatomyPackedOutput(metadata, payload));
  assert.throws(() => assertClosedAnatomyPackedOutput(Buffer.concat([metadata, Buffer.from(' ')]), payload), /pack mismatch/u);
  assert.throws(() => assertClosedAnatomyPackedOutput(metadata, Buffer.concat([payload, Buffer.from(' ')])), /pack mismatch/u);
});

await test('app identity gate preserves legacy identities and admits only the fully pinned named receipt', () => {
  for (const candidate of ['V23', 'V57', 'V70', 'V70 · UNACCEPTED WIP'])
    assert.equal(resolvePufferAppCandidate(root, { candidate }, {}), candidate.split(' ')[0]);
  const sourceHash = '1'.repeat(64), product = { build: { sourceHash } };
  const receipt = {
    schema: 'wildshard.puffer.native-preview.v1', candidate: pin.candidate,
    sourceIdentity: pin.sourceIdentity, rigProfile: pin.rigProfile, mode: 'gait5',
    rigAdmission: assertPufferGaitAdmission(root, input(), 'gait5'),
    source: pin.source, sourceSha256: pin.sourceSha256, sourceHash,
    dimensionsSha256: pin.dimensionsSha256, measurementSha256: pin.measurementSha256,
    metadataSha256: pin.metadataSha256, packedSha256: pin.packedSha256,
    bodyFile: `/assets/driftwood-isle/puffer-native-${pin.packedSha256}.bin`,
    rootFlinch: 'authored-pose', arenaLighting: 'neutral-gray-v2', arenaOcclusion: 'contact-v1',
    arenaLightingProfileSha256: pin.lightingSha256,
    visualAdapter: 'puffer-gait5-continuity', visualAdapterSha256: pin.visualAdapterSha256,
    colliderAcceptance: false, physicalAcceptance: false, physicalDeathAcceptance: false,
    visualAcceptance: false, animationAcceptance: false,
  };
  assert.equal(resolvePufferAppCandidate(root, receipt, product), pin.candidate);
  for (const [key, value] of Object.entries(receipt)) {
    const mutation = typeof value === 'boolean' ? true : typeof value === 'object' ? { profile: pin.profile } : `${value}-tampered`;
    assert.throws(() => resolvePufferAppCandidate(root, { ...receipt, [key]: mutation }, product), /identity|receipt|tuple|policy|sourceHash/u, key);
  }
  assert.throws(() => resolvePufferAppCandidate(root, { ...receipt, candidate: 'V70' }, product), /identity mismatch/u);
  assert.throws(() => resolvePufferAppCandidate(root, receipt, { build: { sourceHash: '2'.repeat(64) } }), /sourceHash/u);
  assert.throws(() => resolvePufferAppCandidate(root, { candidate: 'puffer-other', rigAdmission: receipt.rigAdmission }, product), /identity/u);
  const config = readFileSync('vite/puffer-preview.config.ts', 'utf8');
  assert.match(config, /resolvePufferAppCandidate\(resolve\('\.'\), receiptPreview, JSON.parse\(indexBytes.toString\('utf8'\)\)\)/u);
});
