import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const directory = 'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-admission/';
export const CLOSED_ANATOMY_INPUT = Object.freeze({
  schema: 'wildshard.puffer.closed-anatomy-preview-input.v1',
  candidate: 'puffer-closed-anatomy-98c4855852fc',
  sourceIdentity: 'puffer-closed-anatomy-98c4855852fc',
  rigProfile: 'closed-anatomy-rig1', profile: 'closed-anatomy-rig1-gait5',
  descriptor: `${directory}candidate.json`,
  descriptorSha256: 'd673e96976998fa54d880ef97df28856aa5682f78a8265544d1ed187a5454496',
  source: 'art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/closed-anatomy-rig1-native.json',
  sourceSha256: '38e0ad4de8a25827ace7a366e70c3c21a860ce9221de64f4b4afaf0c27ec2b61',
  parentSourceSha256: '98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006',
  weightReferenceSha256: 'b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762',
  dimensions: `${directory}dimensions.json`,
  dimensionsSha256: 'aac576c8ab54b45ef2beff42ceee591aeb41e70ac764fb1911bc51f7e59fd39e',
  measurement: `${directory}measurement.json`,
  measurementSha256: 'a87d0da3c967cd1cac2b4481d6039268fa8cba47957a5a857c9a1971ec31e5e6',
  dependencies: `${directory}dependencies.json`,
  dependenciesSha256: '3d929b38f6cf30869e6b4c505637a6ebc7b1c9c623cd84512c6e2a8553a5edbb',
  metadataSha256: '8eb0eba8d200d99dd5056e9d7ebb866e7c80419536f7915858c438353ebbd338',
  packedSha256: 'c1901ca16cd8efecaf839117ce9efef3b128008d571c89d586896e7f10220bb8',
  lightingSha256: 'b0871ebc6bb4b1584cc3b970861dd9d577dd1d6f03c59b752f4d937571c29101',
  transferReceiptSha256: '69a53b57ff6b4cf60ac732c5419db651ab84b8433de957d52aee3ddd106a1652',
  poseSha256: '2936bdd0072f05b2d41785333719fd9a9f1237d1fbf182d953d395bfa403bac0',
  gaitSha256: '501c9c6a16fa29a7f87780e263cb4ed1df9c9c2ac53077455f6a2eee08fdb4f0',
  visualAdapterSha256: '54662e9d697533877bb2c7cbe0a29ae415769416d6db3223558a1ab67feeb15d',
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function pinned(root, file, expected) {
  const bytes = readFileSync(resolve(root, file));
  if (hash(bytes) !== expected) throw new Error(`Closed-anatomy admission dependency mismatch: ${file}`);
  return bytes;
}

/** Exactly one named derivative. No generic descriptive-ID or schema exemption. */
export function resolveClosedAnatomyInput(root, descriptorBytes, dimensions) {
  const pin = CLOSED_ANATOMY_INPUT;
  if (hash(descriptorBytes) !== pin.descriptorSha256) throw new Error('Unadmitted closed-anatomy descriptor');
  const sourceBytes = pinned(root, pin.source, pin.sourceSha256);
  const dimensionBytes = readFileSync(dimensions);
  if (hash(dimensionBytes) !== pin.dimensionsSha256) throw new Error('Closed-anatomy dimensions mismatch');
  pinned(root, pin.measurement, pin.measurementSha256);
  return { candidate: pin.candidate, sourceIdentity: pin.sourceIdentity, rigProfile: pin.rigProfile,
    descriptorSha256: pin.descriptorSha256, source: resolve(root, pin.source), sourceRelative: pin.source,
    sourceBytes, dimensionBytes, measurementSha256: pin.measurementSha256 };
}

/** Source admission is only a reproducible diagnostic tuple, never physical or visual acceptance. */
export function assertClosedAnatomyGaitAdmission(root, input, mode) {
  const pin = CLOSED_ANATOMY_INPUT;
  if (input.candidate !== pin.candidate || input.sourceIdentity !== pin.sourceIdentity
    || input.rigProfile !== pin.rigProfile || input.descriptorSha256 !== pin.descriptorSha256
    || mode !== 'gait5' || input.sourceRelative !== pin.source
    || hash(input.sourceBytes) !== pin.sourceSha256 || hash(input.dimensionBytes) !== pin.dimensionsSha256
    || input.measurementSha256 !== pin.measurementSha256) throw new Error('Unadmitted closed-anatomy gait candidate tuple');
  pinned(root, pin.measurement, pin.measurementSha256);
  pinned(root, pin.descriptor, pin.descriptorSha256);
  pinned(root, pin.dimensions, pin.dimensionsSha256);
  const dependencies = JSON.parse(pinned(root, pin.dependencies, pin.dependenciesSha256).toString('utf8'));
  for (const [file, expected] of Object.entries(dependencies.files)) pinned(root, file, expected);
  return { profile: pin.profile, sourceIdentity: pin.sourceIdentity, rigProfile: pin.rigProfile,
    sourceSha256: pin.sourceSha256, parentSourceSha256: pin.parentSourceSha256,
    weightReferenceSha256: pin.weightReferenceSha256, transferReceiptSha256: pin.transferReceiptSha256,
    dependenciesSha256: pin.dependenciesSha256, poseSha256: pin.poseSha256,
    gaitSha256: pin.gaitSha256, visualAdapterSha256: pin.visualAdapterSha256,
    colliderAcceptance: false, physicalAcceptance: false, physicalDeathAcceptance: false,
    visualAcceptance: false, animationAcceptance: false };
}

/** The named candidate has one exact renderer policy; historical V70 policy is separate. */
export function assertClosedAnatomyPreviewPolicy(admission, mode, arenaLighting, arenaOcclusion) {
  if (admission?.profile !== CLOSED_ANATOMY_INPUT.profile || mode !== 'gait5'
    || arenaLighting !== 'neutral-gray-v2' || arenaOcclusion !== 'contact-v1')
    throw new Error('Closed-anatomy preview requires exact gait5/authored-pose/neutral-gray-v2/contact-v1 policy');
  return 'authored-pose';
}

/** App receipt admission preserves the legacy identity gate and adds only this exact source tuple. */
export function resolvePufferAppCandidate(root, receipt, productIndex) {
  const pin = CLOSED_ANATOMY_INPUT;
  if (receipt === null || typeof receipt !== 'object' || typeof receipt.candidate !== 'string')
    throw new Error('Invalid Puffer candidate identity');
  if (receipt.candidate !== pin.candidate) {
    if (receipt.sourceIdentity === pin.sourceIdentity || receipt.sourceSha256 === pin.sourceSha256
      || receipt.rigAdmission?.profile === pin.profile) throw new Error('Closed-anatomy app candidate identity mismatch');
    if (!/^V[0-9]+(?: · UNACCEPTED WIP)?$/u.test(receipt.candidate)) throw new Error('Invalid Puffer candidate identity');
    return String(receipt.candidate).split(' ')[0] ?? '';
  }
  const input = resolveClosedAnatomyInput(root, pinned(root, pin.descriptor, pin.descriptorSha256), resolve(root, pin.dimensions));
  const admission = assertClosedAnatomyGaitAdmission(root, input, receipt.mode);
  assertClosedAnatomyPreviewPolicy(admission, receipt.mode, receipt.arenaLighting, receipt.arenaOcclusion);
  const expected = {
    schema: 'wildshard.puffer.native-preview.v1', candidate: pin.candidate,
    sourceIdentity: pin.sourceIdentity, rigProfile: pin.rigProfile, mode: 'gait5',
    rigAdmission: admission, source: pin.source, sourceSha256: pin.sourceSha256,
    dimensionsSha256: pin.dimensionsSha256, measurementSha256: pin.measurementSha256,
    metadataSha256: pin.metadataSha256, packedSha256: pin.packedSha256,
    bodyFile: `/assets/driftwood-isle/puffer-native-${pin.packedSha256}.bin`,
    rootFlinch: 'authored-pose', arenaLighting: 'neutral-gray-v2', arenaOcclusion: 'contact-v1',
    arenaLightingProfileSha256: pin.lightingSha256,
    visualAdapter: 'puffer-gait5-continuity', visualAdapterSha256: pin.visualAdapterSha256,
    colliderAcceptance: false, physicalAcceptance: false, physicalDeathAcceptance: false,
    visualAcceptance: false, animationAcceptance: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (!isDeepStrictEqual(receipt[key], value)) throw new Error(`Closed-anatomy app receipt mismatch: ${key}`);
  }
  if (typeof receipt.sourceHash !== 'string' || !/^[a-f0-9]{64}$/u.test(receipt.sourceHash)
    || receipt.sourceHash !== productIndex?.build?.sourceHash) throw new Error('Closed-anatomy app product sourceHash mismatch');
  return pin.candidate;
}

/** Check deterministic codec output before the SDK product author is invoked. */
export function assertClosedAnatomyPackedOutput(metadataBytes, payloadBytes) {
  if (hash(metadataBytes) !== CLOSED_ANATOMY_INPUT.metadataSha256 || hash(payloadBytes) !== CLOSED_ANATOMY_INPUT.packedSha256)
    throw new Error('Closed-anatomy deterministic native pack mismatch');
}
