import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { admitMantisPrecontact } from '../../scripts/mantis-precontact-admission.mjs';
import { admitConchReviewedBuild } from '../../scripts/conch-readable-build-pin.mjs';
import { admitColossusNative } from '../../scripts/colossus-native-admission.mjs';
import { V70_GAIT5_INPUT } from '../../scripts/puffer-gait-admission.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const pins = JSON.parse(readFileSync(new URL('../../practice/shared-arena/pins.json', import.meta.url), 'utf8'));
// JSON serialization maps authored negative zero to zero; preserve all other values and structure.
function normalizeJsonNumbers(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonNumbers);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeJsonNumbers(entry)]));
  return Object.is(value, -0) ? 0 : value;
}
/** Exact published WIP tuples only. Refuses substitutions, edited payloads, stale source admission, and extra species. */
export function admitSharedArena(root, hostRoot) {
  const admitted = { mantis: admitMantisPrecontact(root), conch: admitConchReviewedBuild(root), colossus: admitColossusNative(root) };
  const rows = [];
  const contentKeys = new Set();
  for (const [id, pin] of Object.entries(pins.enemies)) {
    const host = resolve(hostRoot, `${id}-engine`);
    for (const [file, expected] of Object.entries(pin.files)) {
      if (file.startsWith('/') || file.split('/').includes('..')) throw new Error('Unsafe arena pin path');
      const path = resolve(host, file);
      if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink() || digest(readFileSync(path)) !== expected) throw new Error(`Arena pin mismatch: ${id}/${file}`);
    }
    const read = path => JSON.parse(readFileSync(resolve(host, path), 'utf8'));
    const preview = read(`${id}-preview.json`), index = read('practice-product/shard.json'), validation = read('practice-product/validation.json');
    if (preview.candidate !== pin.candidate || preview.mode !== pin.mode || index.build.sourceHash !== pin.sourceHash || validation.indexHash !== digest(readFileSync(resolve(host, 'practice-product/shard.json')))) throw new Error(`Arena identity mismatch: ${id}`);
    const json = name => { const entry = index.files.find(file => file.name === name); if (entry === undefined) throw new Error(`Missing arena file ${name}`); return read(`practice-product/${entry.path}`); };
    const bodies = json('practice/bodies.json'), looks = json('practice/looks.json');
    if (bodies.bodies.length !== 1 || bodies.bodies[0].kind !== pin.kind || looks.looks.length !== 1 || looks.looks[0].kind !== pin.kind || bodies.file !== preview.bodyFile) throw new Error(`Arena species mismatch: ${id}`);
    if (id !== 'puffer' && (!isDeepStrictEqual(normalizeJsonNumbers(admitted[id].metadata), bodies) || !isDeepStrictEqual(admitted[id].receipt, preview.admission))) throw new Error(`Arena admission differs: ${id}`);
    if (id === 'puffer') {
      const p = V70_GAIT5_INPUT;
      if (preview.sourceSha256 !== p.sourceSha256 || preview.dimensionsSha256 !== p.dimensionsSha256 || preview.measurementSha256 !== p.measurementSha256 || preview.visualAdapterSha256 !== p.visualAdapterSha256) throw new Error('Unadmitted Puffer tuple');
      for (const [path, expected] of [[p.source,p.sourceSha256],[p.originalSource,p.originalSourceSha256],[p.equivalence,p.equivalenceSha256],['src/pufferGaitContinuityPreview.ts',p.visualAdapterSha256],['src/shards/driftwood-isle/generators/pufferNativeClips.ts',p.poseSha256],['src/shards/driftwood-isle/generators/pufferNativeGait4Clips.ts',p.gaitSha256]]) if (digest(readFileSync(resolve(root,path))) !== expected) throw new Error(`Puffer source pin mismatch: ${path}`);
    }
    for (const look of looks.looks) for (const key of [`look:${look.id}`, `species:${look.species}`, `kind:${look.kind}`]) {
      if (contentKeys.has(key)) throw new Error(`Duplicate arena content key: ${key}`);
      contentKeys.add(key);
    }
    rows.push({ id, host, index, validation, preview, bodies, looks });
  }
  if (rows.length !== 4 || rows.some(row => row.id === 'bellback')) throw new Error('Arena catalogue must contain exactly four admitted enemies');
  return rows;
}
