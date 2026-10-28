import { expect, expectTypeOf, test } from 'vitest';
import type { PainterField } from '../src/engine/render/look';
import type { BlenderArea } from '../src/engine/world/blenderArea';
import { CHUNK_SIZE, TERRAIN_RES, CHUNK_DEPTH } from '../src/engine/core/config';
import { area, inArea, BLENDER_MODELS } from '../src/shards/driftwood-isle/generators/blenderArea';
import type { FacetedGroundField } from '../src/shards/driftwood-isle/generators/facetedGround';
import { driftwoodFacetedGroundBank } from '../src/shards/driftwood-isle/generators/facetedGroundBank';
import { hashImmutableBytes } from '../src/sdk/immutable';
import policy from '../src/shards/driftwood-isle/data/groundGeometryPolicy.json' with { type: 'json' };
import original from './fixtures/driftwood-ground-bounds-original.json' with { type: 'json' };

test('owned ground policy retains native field/area contracts and the exact clip boundary', () => {
  expectTypeOf<FacetedGroundField>().toEqualTypeOf<Pick<PainterField, 'heightAt' | 'normalAt' | 'trailDistance'>>();
  expectTypeOf<typeof area>().toEqualTypeOf<BlenderArea>();
  expect(policy).toEqual({ size: CHUNK_SIZE, resolution: TERRAIN_RES, slabDepth: CHUNK_DEPTH });
  expect(area).toEqual(original.area); expect(BLENDER_MODELS).toBe(original.root);
  const samples: number[] = [];
  for (const margin of [-8, 0, 8]) for (let z = -250; z <= 250; z += 500 / 64) for (let x = -250; x <= 250; x += 500 / 64)
    samples.push(Number(inArea(x, z, margin)));
  expect(samples.length).toBe(original.areaSamples.count);
  expect(hashImmutableBytes(Uint8Array.from(samples))).toBe(original.areaSamples.sha256);
  expect(inArea(area.x0, (area.z0 + area.z1) / 2)).toBe(false);
  expect(inArea(area.x1, (area.z0 + area.z1) / 2)).toBe(false);
});

test('both ground and slab keep original GLB bytes, names, order and aliases', () => {
  const bank = driftwoodFacetedGroundBank();
  expect(bank.byUrl).toEqual(original.aliases);
  expect([...bank.blobs].map(([name, bytes]) => ({ name, bytes: bytes.length, sha256: hashImmutableBytes(bytes) }))).toEqual(original.blobs);
});
