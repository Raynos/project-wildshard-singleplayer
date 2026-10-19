import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const COLOSSUS_NATIVE_CANDIDATE = 'art/driftwood-isle/lowpoly-colossus/runtime-admission/arena-candidate1';
const original = 'art/driftwood-isle/lowpoly-colossus/runtime-admission/v4-skin1';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const COLOSSUS_NATIVE_INPUTS = [
  ...['payload.bin', 'metadata.json', 'colossus-v4-native.json', 'mesh-map.json', 'rig-provenance.json', 'source-materials.json'].map(name => `${original}/${name}`),
  ...['metadata.json', 'dimension-measurement.json', 'measure.py'].map(name => `${COLOSSUS_NATIVE_CANDIDATE}/${name}`),
  'art/driftwood-isle/lowpoly-colossus/build_colossus_v4.py',
  'src/shards/driftwood-isle/generators/colossusNativeClips.ts',
  'src/shards/driftwood-isle/generators/colossusNativePreview.ts',
  'src/shards/driftwood-isle/generators/tidalGiantsCombat.ts',
  'src/shards/driftwood-isle/behaviour/tide-root-colossus.as',
  'scripts/colossus-native-admission.mjs', 'scripts/build-colossus-native-preview.mjs',
  'vite/colossus-native-preview.config.ts',
];
export function admitColossusNative(root) {
  const read = path => readFileSync(resolve(root, path));
  const receipt = JSON.parse(read(`${COLOSSUS_NATIVE_CANDIDATE}/admission.json`));
  if (receipt.schema !== 'wildshard.colossus.arena-candidate.v1' || receipt.candidate !== 'V4-skin1-native22-motion1'
    || receipt.visualAcceptance !== false || receipt.colliderAcceptance !== false || receipt.runtimeAcceptance !== false
    || receipt.worldCorpseContactAccepted !== false || receipt.rootFlinch !== 'authored-pose') throw new Error('Invalid Colossus admission');
  if (JSON.stringify(Object.keys(receipt.files).sort()) !== JSON.stringify([...COLOSSUS_NATIVE_INPUTS].sort())) throw new Error('Incomplete or foreign Colossus tuple');
  for (const path of COLOSSUS_NATIVE_INPUTS) {
    const bytes = read(path), pin = receipt.files[path];
    if (pin.sha256 !== hash(bytes) || pin.bytes !== bytes.length) throw new Error(`Colossus tuple mismatch: ${path}`);
  }
  if (receipt.files[`${original}/payload.bin`].sha256 !== 'bfb9cd8333fb8ba2b17209a51126e26cc5c1e56a521627fc68910af86b506e46'
    || receipt.files['art/driftwood-isle/lowpoly-colossus/build_colossus_v4.py'].sha256 !== 'f10cdec46537f8d579fa7af687890aebe6c2f0e9d82c962e64a478567e3a0218') throw new Error('Wrong protected Colossus source');
  const metadata = JSON.parse(read(`${COLOSSUS_NATIVE_CANDIDATE}/metadata.json`));
  const before = JSON.parse(read(`${original}/metadata.json`));
  const measure = JSON.parse(read(`${COLOSSUS_NATIVE_CANDIDATE}/dimension-measurement.json`));
  before.bodies[0].dims = measure.dimensions;
  if (measure.colliderAcceptance !== false || measure.worldCorpseContactAccepted !== false || JSON.stringify(before) !== JSON.stringify(metadata)) throw new Error('Colossus changed beyond measured dimensions');
  const names = ['body', 'head', ...[-1, 1].flatMap(side => ['arm', 'forearm', 'hand', 'outer', 'middle', 'inner', 'thumb', 'leg', 'shin', 'foot'].map(name => `${name}${side}`))];
  if (metadata.bodies.length !== 1 || metadata.bodies[0].kind !== 'tideRootColossus' || metadata.bodies[0].variant !== 'tide-root-colossus'
    || JSON.stringify(metadata.bodies[0].bones.map(row => row.name)) !== JSON.stringify(names)) throw new Error('Wrong Colossus rig');
  return { receipt, metadata, payload: read(`${original}/payload.bin`) };
}
