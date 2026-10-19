import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const MANTIS_CANDIDATE = 'art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate1';
export const mantisHash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Admit exactly the declared V7 native tuple. No identity wildcard or shared engine exemption. */
export function admitMantisNative(root) {
  const receipt = JSON.parse(readFileSync(resolve(root, MANTIS_CANDIDATE, 'admission.json'), 'utf8'));
  if (receipt.schema !== 'wildshard.mantis.arena-candidate.v1' || receipt.candidate !== 'V7-native22-motion1'
    || receipt.visualAcceptance !== false || receipt.colliderAcceptance !== false || receipt.runtimeAcceptance !== false
    || receipt.rootFlinch !== 'authored-pose' || JSON.stringify(receipt.footOrder) !== '[0,2,1,3]') throw new Error('Invalid Mantis candidate admission');
  for (const [path, expected] of Object.entries(receipt.files)) {
    if (!path.startsWith('art/driftwood-isle/lowpoly-mantis/') && !path.startsWith('src/shards/driftwood-isle/')) throw new Error('Foreign Mantis admission path');
    if (path.split('/').includes('..') || mantisHash(readFileSync(resolve(root, path))) !== expected) throw new Error(`Mantis tuple mismatch: ${path}`);
  }
  const originalPath = 'art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/metadata.json';
  const candidatePath = `${MANTIS_CANDIDATE}/metadata.json`;
  if (receipt.files[originalPath] !== 'f6354fa3ca75a30fdddd428fd81152884e96a27a246107e98ffcc5801281a73a'
    || receipt.files['art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/payload.bin'] !== 'dff33ee217c763612d0ce3fad9c3627ea4414454e074fc092e1c86775ba192d2'
    || !receipt.files[candidatePath] || !receipt.files['src/shards/driftwood-isle/generators/mantisNativeClips.ts']
    || !receipt.files['src/shards/driftwood-isle/generators/mantisNativePreview.ts']) throw new Error('Incomplete Mantis tuple');
  const original = JSON.parse(readFileSync(resolve(root, originalPath), 'utf8'));
  const metadata = JSON.parse(readFileSync(resolve(root, candidatePath), 'utf8'));
  original.bodies[0].dims.feet = receipt.footOrder.map(index => original.bodies[0].dims.feet[index]);
  if (JSON.stringify(original) !== JSON.stringify(metadata)) throw new Error('Mantis candidate changed more than explicit foot order');
  if (metadata.bodies.length !== 1 || metadata.bodies[0].kind !== 'splinter-mantis'
    || metadata.bodies[0].variant !== 'splinter-mantis' || metadata.bodies[0].bones.length !== 22) throw new Error('Wrong Mantis rig');
  return { receipt, metadata, payload: readFileSync(resolve(root, 'art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/payload.bin')) };
}
