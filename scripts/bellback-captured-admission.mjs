import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const BELLBACK_CAPTURED_CANDIDATE = 'art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate5';
export const bellbackHash = bytes => createHash('sha256').update(bytes).digest('hex');
// Immutable candidate4 and canonical native inputs. Updating a mutable receipt cannot bless altered inputs.
const inheritedPins = {
  "art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/metadata.json": "bb6c8304f93430701e67f8d3944d08b619aae476fb028bc84650c07d931be082",
  "art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/canonical-proof.json": "700b3d9a90302021bf2274dd08999cdd61554b4715c39c60bf5e48f31cfedb40",
  "art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate3/metadata.json": "7102c5ba2084311c55bfeeee832ca7e6868410c6962cd3e443f9e2505aa82475",
  "art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate3/admission.json": "936809d26f06109fdc32006ab12965f3101183086c316acfd44a7e2a94facd3a",
  "art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/payload.bin": "b97a9df5437062aa2eb490340663c2b35ecf22ba83c83b834082d8ffe7ae7e9c",
  "art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/bellback-v6-native.json": "32e78a1677765c511645905ca7c48ad3e60d0cf7fac4a8dbd830d39e9f343d44",
  "docs/reviews/bellback-corpse-shape-study/posed-parts-proposal.json": "8cb4df8dd29ab33c06e15f905a1e9b1901f23b6c3e7a2c79376411eed119640b",
  "src/shards/driftwood-isle/generators/bellbackTuckedClips.ts": "c23219a2ee36d6a0fa56d647aec2f2926c37b143a896061e4aa789290ebdfe1d",
  "src/shards/driftwood-isle/generators/bellbackFollowingPreview.ts": "6dde48831ce5519d5e039cfc33824eac92e1b53135d44bf34d66c8288df80a7f",
  "src/shards/driftwood-isle/behaviour/bellback.as": "69c546e693e372b29332c0b0b6376ba234d08181eb7596ee3febd9050c680e2a",
  "src/shards/driftwood-isle/generators/tidalGiantsCombat.ts": "a94b7d52f9df2f43eab6e98dfe645f5093d1db3a6d8398098230549c5585946e",
  "scripts/bellback-following-admission.mjs": "e0bea69ce243ecbb933c6af5f68d5d4284cd875c2bbb7045a0ae631ce1d8eb5f",
  "scripts/bellback-following-admission.test.mjs": "4199fff61ba4093100b3bda4a429b2982252f52b7f7d785bfe7ffd1f5eea741a",
  "scripts/build-bellback-following-preview.mjs": "bc1e08902a39ec37bd707246e730930e26f8f028b215b90ab5f982e9a80cbf66",
  "vite/bellback-following-preview.config.ts": "f132573908e3c42cb86ad747159fe3afbaba756f80d3e96c2a67f7002aab6b8c",
  "test/bellback-following-preview.test.ts": "a6cff73c402a9c0181d6d9420969abf8257987c6a785bb33c26d7cb021e8c5c9",
  "docs/reviews/bellback-runtimecandidate4-source/verify-canonical.py": "cd0f87269fb9c3f47a3b998e436df279310191df9da245dcfc41ac92ef1deccc",
  "art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/admission.json": "1879adbef7ef3e4f28a88e4740f58aee995c62098ec92cf23256a99f398763da",
  "docs/reviews/bellback-runtimecandidate4-source/source-review.md": "d520fad4f3a87ebaaf99c26d585e42226e8f23d9b366e56c98f9f2fed670ba18",
  "docs/reviews/bellback-runtimecandidate4-source/manifest.json": "72af1a5a8da116404585f068cc783bf846d72fcf2d4101247f38060710ba751b"
};
export const BELLBACK_CAPTURED_REQUIRED = [
  ...Object.keys(inheritedPins),
  `${BELLBACK_CAPTURED_CANDIDATE}/metadata.json`,
  'src/shards/driftwood-isle/generators/bellbackCapturedPreview.ts',
  'scripts/bellback-captured-admission.mjs', 'scripts/bellback-captured-admission.test.mjs',
  'scripts/build-bellback-captured-preview.mjs', 'vite/bellback-captured-preview.config.ts',
  'test/bellback-captured-preview.test.ts',
  'docs/reviews/bellback-runtimecandidate5-source/verify-source.mjs',
  'docs/reviews/bellback-runtimecandidate5-source/source-review.md',
];
/** Exactly one opt-in field over pinned candidate4; no new geometry, living tuning or acceptance. */
export function admitBellbackCaptured(root) {
  const read = path => readFileSync(resolve(root, path));
  const json = path => JSON.parse(read(path));
  const receipt = json(`${BELLBACK_CAPTURED_CANDIDATE}/admission.json`);
  const receiptKeys = ['schema', 'candidate', 'visualAcceptance', 'colliderAcceptance', 'runtimeAcceptance', 'contactAcceptance', 'rootFlinch', 'posePolicy', 'files'];
  if (JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(receiptKeys.sort())
    || receipt.schema !== 'wildshard.bellback.arena-candidate.v1'
    || receipt.candidate !== 'V6-frame2-native8-runtimecandidate5'
    || receipt.visualAcceptance !== false || receipt.colliderAcceptance !== false
    || receipt.runtimeAcceptance !== false || receipt.contactAcceptance !== false
    || receipt.rootFlinch !== 'authored-pose' || receipt.posePolicy !== 'captured') throw new Error('Invalid Bellback captured admission');
  if (JSON.stringify(Object.keys(receipt.files).sort()) !== JSON.stringify([...BELLBACK_CAPTURED_REQUIRED].sort())) throw new Error('Incomplete or foreign Bellback tuple');
  for (const path of BELLBACK_CAPTURED_REQUIRED) {
    if (bellbackHash(read(path)) !== receipt.files[path]) throw new Error(`Bellback tuple mismatch: ${path}`);
  }
  for (const [path, pin] of Object.entries(inheritedPins)) {
    if (receipt.files[path] !== pin) throw new Error(`Changed canonical Bellback input: ${path}`);
  }
  const metadata = json(`${BELLBACK_CAPTURED_CANDIDATE}/metadata.json`);
  const before = json('art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/metadata.json');
  before.bodies[0].dims.rigidCorpse.posePolicy = 'captured';
  if (JSON.stringify(before) !== JSON.stringify(metadata)) throw new Error('Bellback changed beyond exact captured pose policy');
  const body = metadata.bodies[0], recipe = body.dims.rigidCorpse;
  if (metadata.bodies.length !== 1 || body.hard.length !== 8 || body.bones.length !== 8
    || body.hard.reduce((n, row) => n + row.row.count, 0) !== 13374 || recipe.parts.length !== 8
    || recipe.parts.reduce((n, part) => n + part.points.length, 0) !== 435
    || JSON.stringify(recipe.parts.map(p => p.bone)) !== JSON.stringify(body.bones.map(b => b.name))) throw new Error('Wrong Bellback canonical counts');
  return { receipt, metadata, payload: read('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/payload.bin') };
}
