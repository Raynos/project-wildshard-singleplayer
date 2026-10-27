// oxlint-disable-next-line import/no-nodejs-modules -- Node fixture reads registered binary bake outputs.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { parseWorldScene } from '../src/format/clientChannels';
import { createOwnedGeometry } from '../src/engine/models/ownedGeometry';
import { bakeRockScenes } from '../src/shards/driftwood-isle/generators/rockScenes';
import { compactChannels } from '../src/shards/driftwood-isle/generators/compactChannels';
import { expect, it } from 'vitest';
import foliage from '../src/shards/driftwood-isle/data/foliagePlacements.generated.json';
import { STATIC_BOAT, WORLD_GULL_PERCHES, SHORE_BOULDERS } from '../src/shards/driftwood-isle/generators/staticWorld';
import { SEED } from '../src/shards/driftwood-isle/generators/landscapeRows';
import WRECK_SITES from '../src/shards/driftwood-isle/data/wreckSites.json' with { type: 'json' };
import { scatterShore, shoreBoulderFacts } from '../src/shards/driftwood-isle/generators/shoreBoulders';

const shore = shoreBoulderFacts();

const finite=v.pipe(v.number(),v.finite());
const copy={matrix:v.pipe(v.array(finite),v.length(16)),from:finite,count:finite,
  box:v.pipe(v.array(finite),v.length(6)),colliders:v.array(v.unknown())};
const rockRows=v.parse(v.object({scene:v.unknown(),catalogue:v.unknown(),
  section:v.object({step:v.object({bounds:v.array(v.object({part:v.string(),sphere:v.object({center:v.tuple([finite,finite,finite]),radius:finite})}))})}),
  world:v.object({shore:v.array(v.object({params:v.object({r:finite,squash:finite}),...copy})),
    small:v.array(v.object({params:v.object({r:finite,sq:finite}),...copy}))})}),
  JSON.parse(readFileSync('src/shards/driftwood-isle/data/rockScenes.generated.json','utf8')));

it('keeps the admitted shoreline clear of the wreck with unchanged placements', () => {
  const rocks = shore.specs;
  expect(SHORE_BOULDERS.placements).toEqual(shore.placements);
  expect(SHORE_BOULDERS.boxes).toEqual(shore.boxes);
  expect(rocks.length).toBeGreaterThan(0);
  for (const b of rocks) expect(Math.hypot(b.x - WRECK_SITES.world.x, b.z - WRECK_SITES.world.z)).toBeGreaterThan(16 + b.r);
});

it('does not scatter the authored rocks over deep water', () => {
  expect(scatterShore(SEED, 8, { heightAt: () => -20 })).toHaveLength(0);
});

it('retains the sailboat rest floor and native hull dimensions', () => {
  expect(STATIC_BOAT.spec).toEqual({ x: -4.2, z: -203, heading: 0, waterY: 0 });
  expect(STATIC_BOAT.colliders).toHaveLength(5);
  expect(STATIC_BOAT.colliders.at(-1)).toEqual({ kind: 'box', x: 0, y: 0.22, z: 0, hx: 1.02, hy: 0.1, hz: 3.12 });
  expect(STATIC_BOAT.cleats).toEqual([-2.9000000000000004, 2.9000000000000004]);
  expect(STATIC_BOAT.floors).toEqual([{ x: -4.2, z: -203, hw: 0.8800000000000001, hd: 2.9000000000000004, y: 0.32, rot: 0 }]);
  expect(WORLD_GULL_PERCHES.slice(-foliage.gullPerches.length)).toEqual(foliage.gullPerches);
});

it('decodes all finished rock draws without changing native channels or hulls', async () => {
  expect(parseWorldScene(rockRows.scene)).toEqual(rockRows.scene);
  const small = rockRows.world.small.map(row => ({ x: row.matrix[12] ?? 0, y: row.matrix[13] ?? 0, z: row.matrix[14] ?? 0, matrix: row.matrix, params: row.params }));
  const nativeSin = Math.sin, nativeCos = Math.cos;
  const baked = bakeRockScenes(shore.placements, small), catalogue = parseWorldSceneModels({ product: 'driftwood-isle', models: rockRows.catalogue });
  try {
    expect(Math.sin).toBe(nativeSin); expect(Math.cos).toBe(nativeCos);
    // The native arm64 value ended in 9504; x64 ended in 9505 and invalidated the official map.
    expect(baked.world.shore[16]?.matrix[2]).toBe(0.6717517652239505);
    expect(baked.world.shore).toHaveLength(109); expect(baked.world.small).toHaveLength(400);
    expect(baked.shoreColliders).toHaveLength(91);
    for (const [id, native] of baked.geometry) {
      native.computeBoundingSphere();
      const sphere = native.boundingSphere;
      if (sphere === null) throw new Error('Missing authored rock bounds');
      const declared = id === 'shore' || id === 'small' ? rockRows.section.step.bounds.find(row => row.part === id)?.sphere : undefined;
      if (declared !== undefined) expect(declared).toEqual({ center: sphere.center.toArray(), radius: sphere.radius });
      else {
        const draw = catalogue.models.flatMap(row => row.choices).flatMap(row => row.draws).find(row => row.model === id);
        expect(draw?.sphere).toEqual([...sphere.center, sphere.radius]);
      }
      const intake = createOwnedGeometry(`/rocks/${id}.glb`);
      await intake.load(readFileSync(new URL(`../src/shards/driftwood-isle/assets/rock-scenes/${id}.glb`, import.meta.url)));
      // L18.3b: the bake ships the native rock in compact storage (exact positions, Int8 normals, Uint16 colours)
      const decoded = intake.take(), compact = compactChannels(native.clone());
      try {
        expect(Object.keys(decoded.attributes)).toEqual(Object.keys(native.attributes));
        expect(decoded.index).toBeNull();
        for (const name of ['position', 'normal', 'color']) {
          expect(decoded.getAttribute(name).array).toEqual(compact.getAttribute(name).array);
          expect(decoded.getAttribute(name).itemSize).toBe(compact.getAttribute(name).itemSize);
          expect(decoded.getAttribute(name).normalized).toBe(compact.getAttribute(name).normalized);
        }
        expect(decoded.getAttribute('position').array).toEqual(native.getAttribute('position').array);
      } finally { decoded.dispose(); compact.dispose(); }
    }
    const json = (value: unknown): string => JSON.stringify(value, (_key: string, item: unknown) => item instanceof Float32Array ? [...item] : item);
    expect(json(rockRows.world.shore.flatMap(row => row.colliders))).toBe(json(baked.shoreColliders));
    expect(json(baked.world)).toBe(json(rockRows.world));
  } finally { for (const geometry of baked.geometry.values()) geometry.dispose(); }
});
