import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { admitConchPlanted, conchHash } from './conch-planted-admission.mjs';

export const CONCH_READABLE_CANDIDATE = 'art/driftwood-isle/approved-conch/runtime-admission/arena-motion4';
/** Source freeze only. No output product or runtime acceptance is implied. */
export function admitConchReadable(root) {
  const baseline = admitConchPlanted(root);
  const manifest = JSON.parse(readFileSync(resolve(root, CONCH_READABLE_CANDIDATE, 'freeze-manifest.json')));
  if (manifest.schema !== 'wildshard.conch.motion4.source-freeze.v1' || manifest.buildAllowed !== false
    || manifest.visualAcceptance !== false || manifest.runtimeAcceptance !== false) throw new Error('Invalid source-only Conch freeze');
  for (const [path, hash] of Object.entries(manifest.files)) {
    if (path.startsWith('/') || path.split('/').includes('..')) throw new Error('Unsafe freeze path');
    if (conchHash(readFileSync(resolve(root, path))) !== hash) throw new Error(`Conch motion4 source mismatch: ${path}`);
  }
  for (const path of ['src/shards/driftwood-isle/generators/conchReadableClips.ts',
    'src/shards/driftwood-isle/generators/conchReadablePreview.ts', 'test/conch-readable-contact.test.ts']) {
    if (typeof manifest.files[path] !== 'string') throw new Error('Incomplete Conch motion4 freeze');
  }
  return { ...baseline, manifest };
}
