import { expect, expectTypeOf, test } from 'vitest';
import type { AnimalDims, AnimalSpecies, BoneDef, VariantDef } from '../src/sdk/bake/species';
import type { AnimalDims as NativeDims, AnimalSpecies as NativeSpecies, BoneDef as NativeBone, VariantDef as NativeVariant } from '../src/engine/entities/species/registry';
import { bakeNalatiBodies } from '../src/shards/nalati-grasslands/generators/bodies';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from '../src/shards/nalati-grasslands/data/bodies.json' with { type: 'json' };

test('author body ports retain native rig, dimension and complete geometry-input fields', () => {
  expectTypeOf<AnimalDims>().toEqualTypeOf<NativeDims>();
  expectTypeOf<AnimalSpecies>().toEqualTypeOf<NativeSpecies>();
  expectTypeOf<BoneDef>().toEqualTypeOf<NativeBone>();
  // Presentation and gameplay modifiers remain on bodySpecies metadata; the
  // geometry recipe reads only these declared shape/palette variant fields.
  expectTypeOf<VariantDef>().toEqualTypeOf<Pick<NativeVariant, keyof VariantDef>>();
});

test('owned noise and RNG inputs retain all 27 original bodies and every native byte', () => {
  const baked = bakeNalatiBodies();
  expect(baked.rows.bodies).toHaveLength(27);
  expect(baked.bin.byteLength).toBe(8729328);
  expect(hashImmutableBytes(baked.bin)).toBe('42448bde496ea13fc9ef81a61987a42147826fc621cae2598cd45a1a625cd163');
  expect(baked.bin.byteLength).toBe(original.bytes);
  expect(hashImmutableBytes(baked.bin)).toBe(original.bin);
  expect(JSON.stringify(baked.rows)).toBe(JSON.stringify({ bodies: original.bodies }));
});
