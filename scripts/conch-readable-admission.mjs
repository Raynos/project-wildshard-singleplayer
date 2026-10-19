import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { admitConchPlanted, conchHash } from './conch-planted-admission.mjs';

export const CONCH_READABLE_CANDIDATE = 'art/driftwood-isle/approved-conch/runtime-admission/arena-motion4';
/** Source freeze only. No output product or runtime acceptance is implied. */
export function admitConchReadable(root) {
  const baseline = admitConchPlanted(root);
  const manifest = JSON.parse(readFileSync(resolve(root, CONCH_READABLE_CANDIDATE, 'freeze-manifest.json')));
  if (manifest.schema !== 'wildshard.conch.motion4.source-freeze.v1' || manifest.buildAllowed !== false
    || manifest.visualAcceptance !== false || manifest.runtimeAcceptance !== false
    || manifest.interruptedContinuityAcceptance !== false) throw new Error('Invalid source-only Conch freeze');
  for (const [path, hash] of Object.entries(manifest.files)) {
    if (path.startsWith('/') || path.split('/').includes('..')) throw new Error('Unsafe freeze path');
    if (conchHash(readFileSync(resolve(root, path))) !== hash) throw new Error(`Conch motion4 source mismatch: ${path}`);
  }
  for (const path of ['src/shards/driftwood-isle/generators/conchReadableClips.ts',
    'src/shards/driftwood-isle/generators/conchReadablePreview.ts', 'test/conch-readable-contact.test.ts',
    'test/conch-readable-preview.test.ts', 'src/engine/ai/strikes.ts', 'src/engine/ai/hfsm.ts',
    'src/engine/core/fixedStep.ts', 'src/engine/entities/AnimalSim.ts', 'src/engine/entities/animalPose.ts',
    'src/game/plugin/channelPrograms.ts', 'src/game/plugin/channels.ts', 'src/format/clientChannels.ts',
    'src/sdk/clientChannels.ts', 'src/shards/driftwood-isle/behaviour/conchDuelist.as',
    'src/shards/driftwood-isle/generators/driftwoodRegularCombat.ts']) {
    if (typeof manifest.files[path] !== 'string') throw new Error('Incomplete Conch motion4 freeze');
  }
  const rejected = `${CONCH_READABLE_CANDIDATE}/rejected-attempts/attempt4-original-freeze/freeze-manifest.json`;
  if (manifest.files[rejected] !== '3e4b3f77dd7597ac0d9ae40d3377b00c149a7cdca708ca3ad71ab8f5262eebd3')
    throw new Error('Missing exact rejected Conch freeze');
  return { ...baseline, manifest };
}
