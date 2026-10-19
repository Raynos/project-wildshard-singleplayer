import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const BELLBACK_FOLLOWING_CANDIDATE = 'art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4';
export const bellbackHash = bytes => createHash('sha256').update(bytes).digest('hex');
const original = 'art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native';
const prior = 'art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate3';
const proposal = 'docs/reviews/bellback-corpse-shape-study/posed-parts-proposal.json';
export const BELLBACK_FOLLOWING_REQUIRED = [
  `${BELLBACK_FOLLOWING_CANDIDATE}/metadata.json`, `${BELLBACK_FOLLOWING_CANDIDATE}/canonical-proof.json`,
  `${prior}/metadata.json`, `${prior}/admission.json`, `${original}/payload.bin`, `${original}/bellback-v6-native.json`,
  proposal, 'src/shards/driftwood-isle/generators/bellbackTuckedClips.ts',
  'src/shards/driftwood-isle/generators/bellbackFollowingPreview.ts',
  'src/shards/driftwood-isle/behaviour/bellback.as', 'src/shards/driftwood-isle/generators/tidalGiantsCombat.ts',
  'scripts/bellback-following-admission.mjs', 'scripts/bellback-following-admission.test.mjs',
  'scripts/build-bellback-following-preview.mjs', 'vite/bellback-following-preview.config.ts',
  'test/bellback-following-preview.test.ts', 'docs/reviews/bellback-runtimecandidate4-source/verify-canonical.py',
];
/** Only the exact proposed recipe may augment unchanged anatomy3 metadata. No product acceptance implied. */
export function admitBellbackFollowing(root) {
  const read = path => readFileSync(resolve(root, path));
  const json = path => JSON.parse(read(path));
  const receipt = json(`${BELLBACK_FOLLOWING_CANDIDATE}/admission.json`);
  if (receipt.schema !== 'wildshard.bellback.arena-candidate.v1' || receipt.candidate !== 'V6-frame2-native8-runtimecandidate4'
    || receipt.visualAcceptance !== false || receipt.colliderAcceptance !== false || receipt.runtimeAcceptance !== false
    || receipt.rootFlinch !== 'authored-pose') throw new Error('Invalid Bellback following admission');
  if (JSON.stringify(Object.keys(receipt.files).sort()) !== JSON.stringify([...BELLBACK_FOLLOWING_REQUIRED].sort())) throw new Error('Incomplete or foreign Bellback tuple');
  for (const path of BELLBACK_FOLLOWING_REQUIRED) {
    if (bellbackHash(read(path)) !== receipt.files[path]) throw new Error(`Bellback tuple mismatch: ${path}`);
  }
  const pins = {
    [`${original}/payload.bin`]: 'b97a9df5437062aa2eb490340663c2b35ecf22ba83c83b834082d8ffe7ae7e9c',
    [`${original}/bellback-v6-native.json`]: '32e78a1677765c511645905ca7c48ad3e60d0cf7fac4a8dbd830d39e9f343d44',
    [`${prior}/metadata.json`]: '7102c5ba2084311c55bfeeee832ca7e6868410c6962cd3e443f9e2505aa82475',
    'src/shards/driftwood-isle/generators/bellbackTuckedClips.ts': 'c23219a2ee36d6a0fa56d647aec2f2926c37b143a896061e4aa789290ebdfe1d',
    'src/shards/driftwood-isle/behaviour/bellback.as': '69c546e693e372b29332c0b0b6376ba234d08181eb7596ee3febd9050c680e2a',
    'src/shards/driftwood-isle/generators/tidalGiantsCombat.ts': 'a94b7d52f9df2f43eab6e98dfe645f5093d1db3a6d8398098230549c5585946e',
    [proposal]: '8cb4df8dd29ab33c06e15f905a1e9b1901f23b6c3e7a2c79376411eed119640b',
  };
  for (const [path, pin] of Object.entries(pins)) if (receipt.files[path] !== pin) throw new Error(`Changed canonical Bellback input: ${path}`);
  const metadata = json(`${BELLBACK_FOLLOWING_CANDIDATE}/metadata.json`), before = json(`${prior}/metadata.json`);
  before.bodies[0].dims.rigidCorpse = json(proposal).rigidCorpse;
  if (JSON.stringify(before) !== JSON.stringify(metadata)) throw new Error('Bellback changed beyond exact rigidCorpse recipe');
  const body = metadata.bodies[0], recipe = body.dims.rigidCorpse;
  if (body.hard.reduce((n, row) => n + row.row.count, 0) !== 13374 || recipe.parts.length !== 8
    || recipe.parts.reduce((n, part) => n + part.points.length, 0) !== 435
    || JSON.stringify(recipe.parts.map(p => p.bone)) !== JSON.stringify(body.bones.map(b => b.name))) throw new Error('Wrong Bellback canonical counts');
  return { receipt, metadata, payload: read(`${original}/payload.bin`) };
}
