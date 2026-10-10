// oxlint-disable-next-line import/no-nodejs-modules -- Admit the original native terrain and committed fixed geometry.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { bakedSamplers, parseBakedTerrain } from '../../../src/engine/world/BakedTerrain';
import { HeightfieldBinding } from '../../../src/engine/world/Heightfield';
import { addVoxelAOBake } from '../../../src/engine/world/voxelAO';
import { toLevelSpec } from '../../../src/game/shard/spec';
import { staticGlb } from '../../../src/sdk/bake/glb';
import { DRIFTWOOD_ISLE } from '../../../src/shards/driftwood-isle/manifest';
import { coveGeometry } from '../../../src/shards/driftwood-isle/generators/cove';
import { loadCoveGeometry, copyCoveGeometry } from '../../../src/shards/driftwood-isle/boot/coveGeometry';
import { FIXED_MODEL_FILES } from '../../../src/shards/driftwood-isle/data/modelFiles';
import { coveFloorAt, coveSpecKey, islandCoveSpec } from '../../../src/shards/driftwood-isle/world/coveLayout';
import bake from '../../../src/shards/driftwood-isle/data/coveBake.json' with { type: 'json' };

beforeAll(async () => {
  const files = Object.values(FIXED_MODEL_FILES).filter(file => file.includes('/cove-'));
  await loadCoveGeometry(new Map(files.map(file => [file, new Uint8Array(readFileSync(`public${file}`))])));
});

it('retains original native terrain placement, every geometry channel, indexed pools and reef-rock placement boxes', () => {
  const grid = parseBakedTerrain(Uint8Array.from(readFileSync('public/assets/baked/driftwood-isle/terrain.bin')).buffer);
  if (grid === null) throw new Error('Native Driftwood terrain missing');
  const binding = new HeightfieldBinding(toLevelSpec(DRIFTWOOD_ISLE)); binding.install(bakedSamplers(grid));
  const release = addVoxelAOBake(Uint8Array.from(readFileSync('public/assets/models/driftwood-blender/voxel-ao.bin')).buffer);
  const material = new MeshStandardMaterial({ vertexColors: true });
  try {
    const spec = islandCoveSpec(), source = coveGeometry(spec, binding.field.heightAt), admitted = copyCoveGeometry(spec);
    expect(coveSpecKey(spec)).toBe(bake.specKey);
    expect(source.placements).toHaveLength(bake.placements.length);
    expect(source.placements.length).toBeGreaterThan(40);
    expect(source.geometry.pools.getIndex()?.count).toBe(243);
    for (const part of ['structure', 'rocks', 'glow', 'pools'] as const) {
      const original = source.geometry[part], copy = admitted.geometry[part];
      expect(new Uint8Array(readFileSync(`public/assets/driftwood-isle/baked/fixed-models/cove-${part}.glb`))).toEqual(staticGlb([{ geometry: original, material }], `cove-${part}`));
      expect(Object.keys(copy.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
      for (const [channel, attribute] of Object.entries(original.attributes)) expect(copy.getAttribute(channel).array, `${part}:${channel}`).toEqual(attribute.array);
      const copiedIndex = copy.getIndex(), originalIndex = original.getIndex();
      // The GLB writer stores indices as uint32; topology values and order stay exact.
      expect(copiedIndex === null ? null : Array.from(copiedIndex.array)).toEqual(originalIndex === null ? null : Array.from(originalIndex.array));
      original.dispose(); copy.dispose();
    }
    expect(admitted.placements.map(row => ({ matrix: row.m.toArray(), r: row.r, squash: row.squash, moss: row.moss, min: row.box.min.toArray(), max: row.box.max.toArray() }))).toEqual(source.placements.map(row => ({ matrix: row.m.toArray(), r: row.r, squash: row.squash, moss: row.moss, min: row.box.min.toArray(), max: row.box.max.toArray() })));
  } finally { material.dispose(); release(); }
});

it('keeps geometry, placement matrices and boxes independent for disposal and mutable placement consumers', () => {
  const a = copyCoveGeometry(islandCoveSpec()), b = copyCoveGeometry(islandCoveSpec()), c = copyCoveGeometry(islandCoveSpec());
  for (const part of ['structure', 'rocks', 'glow', 'pools'] as const) {
    a.geometry[part].scale(2, 3, 4); a.geometry[part].dispose();
    expect(b.geometry[part].getAttribute('position').array).toEqual(c.geometry[part].getAttribute('position').array);
    expect(b.geometry[part]).not.toBe(c.geometry[part]);
    b.geometry[part].dispose(); c.geometry[part].dispose();
  }
  a.placements[0]?.m.makeTranslation(100, 100, 100); a.placements[0]?.box.makeEmpty();
  expect(b.placements[0]?.m.elements).toEqual(c.placements[0]?.m.elements);
  expect(b.placements[0]?.box).toEqual(c.placements[0]?.box);
});

it('refuses a different authored layout before drawing geometry against another collision law', () => {
  const spec = islandCoveSpec(); spec.cave.depth += 1;
  expect(() => copyCoveGeometry(spec)).toThrow('Cove layout changed');
  const same = islandCoveSpec(); same.fall = { width: same.fall.width, foot: same.fall.foot, top: same.fall.top };
  expect(coveSpecKey(same)).toBe(bake.specKey);
});

it('uses one authored floor law for the antechamber, ramp and alcove', () => {
  expect(coveFloorAt(0)).toBeCloseTo(0.4, 12);
  expect(coveFloorAt(5.8)).toBeCloseTo(0.4, 12);
  expect(coveFloorAt(6.3)).toBeCloseTo(0.9, 12);
  expect(coveFloorAt(6.8)).toBeCloseTo(1.4, 12);
  expect(coveFloorAt(8.8)).toBeCloseTo(1.4, 12);
});
