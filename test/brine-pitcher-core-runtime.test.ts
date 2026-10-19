// oxlint-disable-next-line import/no-nodejs-modules -- Read exact source study fixtures without a browser or engine mutation.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { packedCreatureBodies } from '../src/game/plugin/geometry';
import { rigidCorpseSchema } from '../src/format/rigidCorpse';
import { validateRigidCorpse } from '../src/engine/physics/rigidCorpse';
import { supportsRigidCorpseAnimation } from '../src/engine/entities/rigidCorpsePose';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { brinePitcherNativeClips } from '../src/shards/driftwood-isle/generators/brinePitcherNativeClips';

const root = 'art/driftwood-isle/approved-brine-pitcher';
const read = (path: string): unknown => JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
test('core-only live volumes and seven following corpse parts pass the unchanged native consumer', async () => {
  const bytes = readFileSync(`${root}/v3/payload.bin`);
  const candidate = packedCreatureBodies(read('core-runtime-study/metadata.json'), undefined, () => Promise.resolve(bytes));
  const original = packedCreatureBodies(read('v3/metadata.json'), undefined, () => Promise.resolve(bytes));
  await Promise.all([candidate.preload(), original.preload()]);
  const body = candidate.copy('brine-pitcher-matriarch', 'brine-pitcher-matriarch');
  const before = original.copy('brine-pitcher-matriarch', 'brine-pitcher-matriarch');
  expect(body.bones).toEqual(before.bones);
  const recipe = v.parse(rigidCorpseSchema, body.dims.rigidCorpse);
  validateRigidCorpse(recipe);
  expect(recipe.parts).toHaveLength(7);
  expect(recipe.parts.reduce((sum, part) => sum + part.points.length, 0)).toBe(455);
  expect(body.dims.capsuleAxis).toBe('z');
  expect(body.dims.bodyY).toBe(.7);
  expect(body.dims.bodyY - body.dims.bodyRadius).toBeCloseTo(.1);
  expect(body.dims.headRadius).toBe(.75);
  const second = candidate.copy('brine-pitcher-matriarch', 'brine-pitcher-matriarch');
  expect(second.dims.rigidCorpse).toEqual(body.dims.rigidCorpse);
  expect(second.dims.rigidCorpse?.parts[0]?.points[0]).not.toBe(body.dims.rigidCorpse?.parts[0]?.points[0]);
});
test('existing numeric death evaluator is supported without a custom callback', () => {
  expect(supportsRigidCorpseAnimation(numericCreaturePose(brinePitcherNativeClips()))).toBe(true);
});
test('source study explicitly retains all acceptance gates and intentional living coverage limits', () => {
  const audit = v.parse(v.object({ productBuilt: v.boolean(), runtimeAcceptance: v.boolean(), contactAcceptance: v.boolean(), visualAcceptance: v.boolean(), geometryChanged: v.boolean(), rootLift: v.number(), livingHitPolicy: v.string() }), read('core-runtime-study/audit.json'));
  expect(audit.productBuilt || audit.runtimeAcceptance || audit.contactAcceptance || audit.visualAcceptance || audit.geometryChanged).toBe(false);
  expect(audit.rootLift).toBe(0);
  expect(audit.livingHitPolicy).toContain('Side mouths are attack emitters');
});
