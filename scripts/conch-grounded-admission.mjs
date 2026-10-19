import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const CONCH_GROUNDED_CANDIDATE = 'art/driftwood-isle/approved-conch/runtime-admission/arena-motion2';
const canonical = 'art/driftwood-isle/approved-conch/runtime-admission/arena-candidate1';
export const conchHash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Exact isolated tuple; canonical vertices and authored motion remain immutable. */
export function admitConchGrounded(root) {
  const read = path => readFileSync(resolve(root, path));
  if (conchHash(read(`${canonical}/closure.json`)) !== 'ceaa0fc71297d9f7462519b66cb2550d89def38050abcc305e7c7b0205ed1d75') throw new Error('Conch canonical closure mismatch');
  const closure = JSON.parse(read(`${canonical}/closure.json`));
  for (const [path, expected] of Object.entries(closure.files)) {
    const bytes = read(path);
    if (bytes.length !== expected.bytes || conchHash(bytes) !== expected.sha256) throw new Error(`Conch canonical tuple mismatch: ${path}`);
  }
  const receipt = JSON.parse(read(`${CONCH_GROUNDED_CANDIDATE}/admission.json`));
  if (receipt.schema !== 'wildshard.conch.arena-candidate.v1' || receipt.candidate !== 'character-native15-motion2'
    || receipt.visualAcceptance !== false || receipt.colliderAcceptance !== false || receipt.runtimeAcceptance !== false
    || receipt.rootFlinch !== 'authored-pose') throw new Error('Invalid Conch candidate admission');
  const required = [`${CONCH_GROUNDED_CANDIDATE}/metadata.json`, `${CONCH_GROUNDED_CANDIDATE}/dimension-measurement.json`,
    'src/shards/driftwood-isle/generators/conchGroundedPreview.ts', 'src/shards/driftwood-isle/generators/conchGroundedClips.ts'];
  for (const path of required) if (typeof receipt.files[path] !== 'string') throw new Error('Incomplete Conch tuple');
  for (const [path, expected] of Object.entries(receipt.files)) {
    if ((!path.startsWith('art/driftwood-isle/approved-conch/') && !path.startsWith('src/shards/driftwood-isle/')) || path.split('/').includes('..')) throw new Error('Foreign Conch admission path');
    if (conchHash(read(path)) !== expected) throw new Error(`Conch tuple mismatch: ${path}`);
  }
  const original = JSON.parse(read(`${canonical}/metadata.json`));
  const metadata = JSON.parse(read(`${CONCH_GROUNDED_CANDIDATE}/metadata.json`));
  const measured = JSON.parse(read(`${CONCH_GROUNDED_CANDIDATE}/dimension-measurement.json`));
  if (measured.colliderAcceptance !== false || measured.parts.join(',') !== 'body' || measured.vertices !== 1512) throw new Error('Invalid central body measurement');
  original.bodies[0].dims = measured.dimensions;
  if (JSON.stringify(original) !== JSON.stringify(metadata)) throw new Error('Conch candidate changed more than measured dimensions');
  if (metadata.bodies.length !== 1 || metadata.bodies[0].kind !== 'conch-duelist' || metadata.bodies[0].bones.length !== 15) throw new Error('Wrong Conch rig');
  const payload = read(`${canonical}/payload.bin`);
  if (conchHash(payload) !== 'a820f64e2252058c7a02fe3ce551e704e4262990c59b6d28a9b323ee1356d610') throw new Error('Conch packed payload mismatch');
  return { receipt, metadata, payload };
}
