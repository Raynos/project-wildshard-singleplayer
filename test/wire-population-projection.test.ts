import { RETURN_PROGRAM } from './fixtures/driftwood-guest-programs';
// @vitest-environment happy-dom
// What a population's page shows of rows the server runs: the page's half of a marsh's projection, which stays when the flip takes its own
// creatures. The law half (who stands, who returns) is `driftwood-headless-population`'s.
import { expect, test, vi } from 'vitest';
import { lendDriftwoodReturns } from './fixtures/driftwood-return-modules';
import { Points, PointLight, MeshStandardMaterial, Vector3 } from 'three';
import { Scope } from '../src/engine/shared/app/scope';
import { LightPool } from '../src/engine/client/fx/LightPool';
import { SEED } from '../src/engine/shared/core/config';
import { Rng } from '../src/engine/shared/core/rng';
import { overrideTerrain } from '@wildshard/engine/test/terrain';
import { speciesDef } from '../src/engine/shared/entities/species/registry';
import * as look from '../src/engine/client/world/lowpolyKit';
import { PopulationProjection } from '../src/game/client/population/projection';
import { wirePage } from '../src/game/client/shardfile/wirePage';
import { poseInputNames } from '../src/game/shared/plugin/channelPrograms';
import { populationProjectionRows } from '../src/shards/driftwood-isle/generators/populationProjection';
import { manager } from '@wildshard/engine/test/manager';
import { mockCanvas } from '@wildshard/engine/test/weaponParity';
import { DRIFTWOOD_ISLAND_FACTS as island } from './fixtures/driftwood-island-facts';
import { installWorldFixture } from './fixtures/worldSetup';

await installWorldFixture();

test('a marsh\'s views run on the rows a server sends: memory effects, a seated light, and the habitat back at the end', async () => {
  Object.defineProperty(wirePage, 'on', { get: () => true, configurable: true }); // the flip makes this the only page
  mockCanvas();
  const terrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 }), f = manager();
  const scope = lendDriftwoodReturns(new Scope('marsh.wire')), material = new MeshStandardMaterial(); vi.spyOn(look, 'lowPolyLookMaterial').mockReturnValue(material);
  const source = populationProjectionRows(island, RETURN_PROGRAM), variant = speciesDef('boar').variants[0]?.id;
  if (variant === undefined) throw new Error('Missing fixture variant');
  const row = { kind: 'boar', variant, x: 3, z: 4, yaw: 0, herd: -1 } as const;
  const page = { stream: new Rng(91).snapshot(), centres: [{ x: 3, z: 4 }], kinds: ['boar'], herds: 1, enemies: [row], perches: [{ crown: [2.5, 14, 2], base: [1, 9.25, 2] }] };
  const perches = [new Vector3(8, 9, 10)]; f.manager.habitat.perches = perches;
  const sound = vi.fn<(name: string, at: Vector3) => void>(); f.manager.onSound = sound;
  poseInputNames.clear();
  const projection = new PopulationProjection(f.manager, f.game.scene, f.sky, scope, { ...source, id: 'marsh.volley', seed: SEED, random: 91,
    page: { phone: page, desktop: page }, counts: { hogs: { kind: 'boar', groups: false, practice: false } },
    hold: { kind: 'boar', x: 0, z: 0, r: 1, guardR: 1, step: 1, floor: Array.from({ length: 9 }, () => null) },
    splash: { ...source.splash, capacity: 12, count: 3 }, effects: [{ kind: 'boar', state: 'display', actions: [{ state: 3, sound: 'marsh.call', splash: 1 }],
      periodic: { state: 7, interval: .2, chance: 1, x: 'goal-x', z: 'goal-z', radius: .1, splash: .5 } }] });
  try {
    expect([...poseInputNames].sort(), 'what these views read of a body, asked for by name').toEqual(['display', 'goal-x', 'goal-z', source.light.rise, source.light.rising].sort());
    await projection.build();
    expect(f.manager.animals, 'on the wire the creatures are rows: this page stands up none').toHaveLength(0);
    expect(f.manager.habitat.perches[0]?.toArray()).toEqual([2.5, 14, 2]);
    const actor = f.manager.spawn('boar', 3, 4, 0, variant, { entityId: 'row:1' });
    actor.mem['display'] = 3; projection.update(.01, 1, new Vector3());
    expect(sound).toHaveBeenCalledWith('marsh.call', actor.position);
    const points = projection.group.children.find((object): object is Points => object instanceof Points);
    if (points === undefined) throw new Error('Missing pool');
    expect(Array.from(points.geometry.getAttribute('position').array).some(value => value > 0)).toBe(true);
    const pool = LightPool.for(f.game.scene), lights = pool.group.children.filter(object => object instanceof PointLight);
    expect(lights).toHaveLength(1); expect(pool.free).toBe(0); expect(projection.group.children.some(object => object instanceof PointLight)).toBe(false);
    scope.dispose();
    expect(projection.group.parent).toBeNull(); expect(pool.free).toBe(pool.size); expect(lights[0]?.parent).toBe(pool.group);
    expect(f.manager.habitat.perches).toBe(perches);
    projection.dispose();
  } finally { scope.dispose(); material.dispose(); terrain(); Reflect.deleteProperty(wirePage, 'on'); }
});
