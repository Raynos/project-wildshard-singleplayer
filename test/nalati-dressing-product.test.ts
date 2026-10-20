import { expect, test } from 'vitest';
import { packDressingTable } from '../src/shards/nalati-grasslands/generators/dressingTable';
import stone from '../src/shards/nalati-grasslands/data/dressing-stone.generated.json' with { type: 'json' };
import daisy from '../src/shards/nalati-grasslands/data/dressing-daisy.generated.json' with { type: 'json' };
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { readSceneNumericTable as readDressingTable } from '../src/game/shardfile/sceneDressing';
import { DRESSING_SCHEMAS } from '../src/shards/nalati-grasslands/generators/dressingSchemas';
import { SceneScatterPoseSchema } from '../src/format/sceneDressing';
import cover from '../src/shards/nalati-grasslands/boot/cover.generated.json' with { type: 'json' };
import { AmbientGroup } from '../src/game/ambient/flock';
import { SpecimenCatalogueSchema } from '../src/format/specimenCatalogue';
import { setTerrainHeight } from '../src/engine/world/terrainHeight';

test('prepared ambient rows keep both tier populations and finite flight at 10 Hz', () => {
  setTerrainHeight(() => 0);
  for (const [tier, profile] of Object.entries({ phone: cover.phone, desktop: cover.desktop })) {
    v.parse(SpecimenCatalogueSchema, profile.catalogue);
    expect(profile.life.filter(row => row.kind === 'butterfly').reduce((count, group) => count + group.row.count, 0)).toBe(cover.butterflies[tier === 'phone' ? 'phone' : 'desktop']);
    expect(profile.life.filter(row => row.kind === 'raptor').reduce((count, group) => count + group.row.count, 0)).toBe(3);
    for (const spec of profile.life) {
      const group = new AmbientGroup(spec.row, spec.perches);
      for (let tick = 0; tick < 100; tick++) group.update(0.1, { x: 0, y: 0, z: 0 });
      expect(group.birds).toHaveLength(spec.row.count);
      for (const bird of group.birds) expect([bird.x, bird.y, bird.z, bird.yaw, bird.pitch, bird.roll, bird.flap].every(Number.isFinite)).toBe(true);
      if (spec.kind === 'butterfly') {
        const active = group.birds.filter(bird => bird.state !== 0);
        expect(active.length).toBeGreaterThan(0);
        expect(active.every(bird => Math.hypot(bird.x, bird.z) < 55)).toBe(true);
      }
    }
  }
});

test('Nalati admits every shipping dressing groups and camp keep-out population', async () => {
  const loaded = await readProjectAssets('src/shards/nalati-grasslands');
  const read = (key: string): Uint8Array => {
    const file = loaded.output.namedFiles?.find(row => row.name === key);
    const bytes = file === undefined ? undefined : loaded.assets.get(file.hash);
    if (bytes === undefined) throw new Error(`Missing admitted dressing ${key}`);
    return bytes;
  };
  const product = { file: (name: string) => Promise.resolve(read(name)) };
  const readRows = async (key: string): Promise<unknown> => key === 'stone' || key === 'daisy' ? readDressingTable(await product.file(`world/dressing-${key}.bin`)) : JSON.parse(new TextDecoder().decode(await product.file(`world/dressing-${key}.json`)));
  const schemas:Readonly<Record<string,v.GenericSchema<unknown,readonly unknown[]>>> = { ...DRESSING_SCHEMAS, stone: v.array(SceneScatterPoseSchema), daisy: v.array(SceneScatterPoseSchema) };
  const plan:Record<string,readonly unknown[]> = Object.fromEntries(await Promise.all(Object.entries(schemas).filter(([key]) => key !== 'clutter').map(async ([key,schema]):Promise<readonly[string,readonly unknown[]]> => [key,v.parse(schema,await readRows(key))])));
  const clutter = v.parse(DRESSING_SCHEMAS['clutter'] ?? v.never(), await readRows('clutter'));
  const populations = {
    boulder: 1900, slab: 1579, stone: 19791, juniper: 278, rose: 136, willow: 230,
    lupin: 2778, daisy: 8811, reed: 1050, logs: 17, stumps: 11, ovoos: 9,
    poles: 7, fences: 6, gates: 1, drifts: 310, colliders: 1346,
  };
  expect(Object.keys(plan).sort()).toEqual(Object.keys(populations).sort());
  for (const [key, count] of Object.entries(populations)) {
    const rows = Object.entries(plan).find(([name]) => name === key)?.[1];
    expect(rows?.length).toBeGreaterThanOrEqual(Math.max(1, Math.floor(count * 0.85)));
    expect(rows?.length).toBeLessThanOrEqual(Math.ceil(count * 1.15));
  }
  expect(clutter).toHaveLength(48);
}, 30_000);


test('numeric dressing tables retain every authored double and reject corrupt payloads', () => {
  for (const rows of [stone, daisy]) {
    const packed = packDressingTable(rows);
    expect(readDressingTable(packed)).toEqual(rows);
    expect(packed.length).toBeLessThan(new TextEncoder().encode(JSON.stringify(rows)).length);
    expect(() => readDressingTable(packed.subarray(1))).toThrow();
    expect(() => readDressingTable(packed.subarray(0, -1))).toThrow();
    const corrupt = packed.slice();
    new DataView(corrupt.buffer).setFloat64(corrupt.length - 8, Number.NaN, true);
    expect(() => readDressingTable(corrupt)).toThrow();
  }
  expect(() => packDressingTable([{ x: 1 }, { x: 2, y: 3 }])).toThrow();
  expect(() => packDressingTable([{ x: Infinity }])).toThrow();
});
