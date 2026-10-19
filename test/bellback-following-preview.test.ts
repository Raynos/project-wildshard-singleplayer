// oxlint-disable-next-line import/no-nodejs-modules -- Exact canonical candidate input, no browser or filesystem mutation.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { rigidCorpseSchema } from '../src/format/rigidCorpse';
import { validateRigidCorpse } from '../src/engine/physics/rigidCorpse';
import { createBellbackFollowingPreviewSource, createBellbackFollowingPreviewOutput, BELLBACK_FOLLOWING_PREVIEW_DECISION_MEMORY } from '../src/shards/driftwood-isle/generators/bellbackFollowingPreview';
import { createBellbackTuckedPreviewSource, createBellbackTuckedPreviewOutput } from '../src/shards/driftwood-isle/generators/bellbackTuckedPreview';

const candidate = 'art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/metadata.json';
const readMetadata = (): unknown => JSON.parse(readFileSync(candidate, 'utf8'));
test('candidate-native packed admission loads exact original geometry with exact following hulls', async () => {
  const bytes = readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/payload.bin');
  const bodies = packedCreatureBodies(readMetadata(), undefined, () => Promise.resolve(bytes));
  await bodies.preload();
  const first = bodies.copy('bellback', 'bellback'), second = bodies.copy('bellback', 'bellback');
  const recipe = v.parse(rigidCorpseSchema, first.dims.rigidCorpse); validateRigidCorpse(recipe);
  expect(recipe.parts.map(p => p.points.length)).toEqual([86,49,86,29,43,42,50,50]);
  expect(first.dims.rigidCorpse).toEqual(second.dims.rigidCorpse);
  expect(first.dims.rigidCorpse?.parts[0]?.points[0]).not.toBe(second.dims.rigidCorpse?.parts[0]?.points[0]);
  const before = packedCreatureBodies(JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate3/metadata.json', 'utf8')), undefined, () => Promise.resolve(bytes));
  await before.preload(); const original = before.copy('bellback', 'bellback');
  const { rigidCorpse: _recipe, ...living } = first.dims;
  expect(living).toEqual(original.dims);
});
test('candidate4 isolated source retains anatomy3 world, guest, timings, storage, and source budgets', () => {
  const before = createBellbackTuckedPreviewSource('neutral-gray-v2');
  const after = createBellbackFollowingPreviewSource('neutral-gray-v2');
  expect(JSON.stringify(after)).toBe(JSON.stringify(before).replaceAll('Bellback Frame2 Tucked WIP Preview', 'Bellback Frame2 Runtime Candidate4 WIP Preview'));
  expect(BELLBACK_FOLLOWING_PREVIEW_DECISION_MEMORY).toBe(131072);
  expect(after.quests).toEqual({flags:[],quests:[],triggers:[],dialogue:[]});
  expect(after.encounters).toEqual([]); expect(after.ledger).toEqual([]);
});
test('candidate4 emitter preserves every named blob and combat section with identical metadata', () => {
  // Candidate identity is preview provenance, never an AI/combat catalogue change.
  const input = readMetadata();
  const before = createBellbackTuckedPreviewOutput(input), after = createBellbackFollowingPreviewOutput(input);
  expect(after).toEqual(before);
});
