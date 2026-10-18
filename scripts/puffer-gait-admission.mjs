import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { previewHash } from './puffer-preview-input.mjs';

const directory = 'art/driftwood-isle/approved-puffer/';
export const V70_GAIT5_INPUT = Object.freeze({
  candidate: 'V70', mode: 'gait5',
  originalSource: `${directory}unaccepted-native-v70.json`,
  originalSourceSha256: '3d0606971754f7788e899fe31214748fd38f43b38b363f2d2b291be588de48dc',
  source: `${directory}unaccepted-v70-motion-rig1-native.json`,
  sourceSha256: 'b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762',
  dimensionsSha256: 'aac576c8ab54b45ef2beff42ceee591aeb41e70ac764fb1911bc51f7e59fd39e',
  measurementSha256: 'a923ca6c0ca4ba7d853da3b871d536e2b2a3106202a21c3673f22a8eaa6c6f27',
  equivalence: `${directory}v70-motion-rig1-equivalence.json`,
  equivalenceSha256: '5cb9e2b3128f5b87ef4ed7c89816c324d79bd57bc6b947d25b23c46bea567b06',
  poseSha256: '2936bdd0072f05b2d41785333719fd9a9f1237d1fbf182d953d395bfa403bac0',
  gaitSha256: '501c9c6a16fa29a7f87780e263cb4ed1df9c9c2ac53077455f6a2eee08fdb4f0',
  visualAdapterSha256: '54662e9d697533877bb2c7cbe0a29ae415769416d6db3223558a1ab67feeb15d',
});

/** New candidates require explicit immutable admission; the V57 rig1 path stays pinned. */
export function assertPufferGaitAdmission(root, input, mode) {
  const sourceHash = previewHash(input.sourceBytes), dims = JSON.parse(input.dimensionBytes.toString('utf8'));
  if (Math.abs(dims.legLen - .24 / (2 * Math.sin(.36))) > 1e-9 || !Number.isFinite(dims.legLen))
    throw new Error('gait4 requires pinned rig1 and explicit phase calibration');
  if (input.candidate === 'V57' && (mode === 'gait4' || mode === 'gait5')
    && sourceHash === '7d27737df2bd9b1c7b81fd8eff97fbf5fc4fa02f9eba85faeeacd646cc481dcb') return null;
  const pin = V70_GAIT5_INPUT;
  if (input.candidate !== pin.candidate || mode !== pin.mode || input.sourceRelative !== pin.source
    || sourceHash !== pin.sourceSha256 || previewHash(input.dimensionBytes) !== pin.dimensionsSha256
    || input.measurementSha256 !== pin.measurementSha256) throw new Error('Unadmitted Puffer gait candidate tuple');
  const files = [
    [pin.originalSource, pin.originalSourceSha256], [pin.equivalence, pin.equivalenceSha256],
    ['src/shards/driftwood-isle/generators/pufferNativeClips.ts', pin.poseSha256],
    ['src/shards/driftwood-isle/generators/pufferNativeGait4Clips.ts', pin.gaitSha256],
    ['src/pufferGaitContinuityPreview.ts', pin.visualAdapterSha256],
  ];
  for (const [file, expected] of files) {
    if (previewHash(readFileSync(resolve(root, file))) !== expected) throw new Error(`V70 gait admission dependency mismatch: ${file}`);
  }
  return { profile: 'v70-rig1-gait5', originalSourceSha256: pin.originalSourceSha256,
    equivalenceSha256: pin.equivalenceSha256, poseSha256: pin.poseSha256, gaitSha256: pin.gaitSha256 };
}
