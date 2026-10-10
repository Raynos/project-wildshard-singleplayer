// oxlint-disable-next-line import/no-nodejs-modules -- Admit the native terrain and committed geometry rather than network assets.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { bakedSamplers, parseBakedTerrain } from '../../../src/engine/world/BakedTerrain';
import { HeightfieldBinding } from '../../../src/engine/world/Heightfield';
import { toLevelSpec } from '../../../src/game/shard/spec';
import { staticGlb } from '../../../src/sdk/bake/glb';
import { DRIFTWOOD_ISLE } from '../../../src/shards/driftwood-isle/manifest';
import { trailsideGeometry } from '../../../src/shards/driftwood-isle/generators/trailside';
import { loadTrailsideGeometry, copyTrailsideGeometry } from '../../../src/shards/driftwood-isle/boot/trailsideGeometry';
import { FIXED_MODEL_FILES } from '../../../src/shards/driftwood-isle/data/modelFiles';
import { flightOf, islandTrailsideSpec, trailsideSpecKey } from '../../../src/shards/driftwood-isle/world/trailsideLayout';
import bake from '../../../src/shards/driftwood-isle/data/trailsideBake.json' with { type: 'json' };

beforeAll(async () => {
  await loadTrailsideGeometry(new Map([[FIXED_MODEL_FILES.trailside, new Uint8Array(readFileSync(`public${FIXED_MODEL_FILES.trailside}`))]]));
});

it('retains every original trail vertex channel and the native posts, signs, planks, boxes and legacy colliders', () => {
  const grid = parseBakedTerrain(Uint8Array.from(readFileSync('public/assets/baked/driftwood-isle/terrain.bin')).buffer);
  if (grid === null) throw new Error('Native terrain missing');
  const binding = new HeightfieldBinding(toLevelSpec(DRIFTWOOD_ISLE)); binding.install(bakedSamplers(grid));
  const source = trailsideGeometry(islandTrailsideSpec(), binding.field.heightAt), admitted = copyTrailsideGeometry(islandTrailsideSpec());
  const material = new MeshStandardMaterial({ vertexColors: true });
  try {
    expect(new Uint8Array(readFileSync(`public${FIXED_MODEL_FILES.trailside}`))).toEqual(staticGlb([{ geometry: source.geometry, material }], 'trailside'));
    expect(Object.keys(admitted.geometry.attributes).sort()).toEqual(Object.keys(source.geometry.attributes).sort());
    for (const [channel, attribute] of Object.entries(source.geometry.attributes)) expect(admitted.geometry.getAttribute(channel).array, channel).toEqual(attribute.array);
    expect(admitted.geometry.getIndex()).toBeNull();
    expect(source.geometry.getIndex()).toBeNull();
    expect(admitted.metadata).toEqual(source.metadata);
    expect(admitted.metadata.posts.pls.length).toBeGreaterThan(150);
    expect(admitted.metadata.signs.pls).toHaveLength(2);
    expect(admitted.metadata.planks.pls.length).toBeGreaterThan(100);
    for (const row of [bake.posts, bake.signs, bake.planks]) expect(row.boxes).toHaveLength(row.pls.length * 6);
  } finally { source.geometry.dispose(); admitted.geometry.dispose(); material.dispose(); }
});

it('keeps copies independent when a consumer disposes geometry or edits placement metadata', () => {
  const a = copyTrailsideGeometry(islandTrailsideSpec()), b = copyTrailsideGeometry(islandTrailsideSpec()), c = copyTrailsideGeometry(islandTrailsideSpec());
  a.geometry.scale(2, 3, 4); a.geometry.dispose();
  a.metadata.posts.pls.splice(0, 1); a.metadata.signs.boxes.fill(0); a.metadata.colliders.splice(0, 1);
  expect(b.geometry.getAttribute('position').array).toEqual(c.geometry.getAttribute('position').array);
  expect(b.geometry).not.toBe(c.geometry);
  expect(b.metadata).toEqual(c.metadata);
  b.geometry.dispose(); c.geometry.dispose();
});

it('refuses altered authored layouts while accepting equivalent defaults and property order', () => {
  const spec = islandTrailsideSpec(), first = spec.fences[0];
  if (first === undefined) throw new Error('Native fence missing');
  first.spacing = 3;
  expect(() => copyTrailsideGeometry(spec)).toThrow('Trailside layout changed');
  const same = islandTrailsideSpec(), step = same.steps[0];
  if (step === undefined) throw new Error('Native steps missing');
  same.steps[0] = { width: 2.4, to: step.to, from: step.from };
  expect(trailsideSpecKey(same)).toBe(bake.specKey);
});

it('samples the supplied terrain authority for the shared flight frame and tread count', () => {
  const samples: [number, number][] = [];
  const frame = flightOf({ top: [4, 3], bottom: [0, 0] }, (x, z) => { samples.push([x, z]); return x + z; });
  expect(samples).toEqual([[0, 0], [4, 3]]);
  expect(frame.len).toBe(5); expect(frame.yb).toBe(0); expect(frame.yt).toBe(7.02);
  expect(frame.m).toBe(26); expect(frame.w).toBe(1.8);
});
