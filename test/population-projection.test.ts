// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Points, PointLight, MeshStandardMaterial, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { SEED } from '../src/engine/core/config';
import { Rng } from '../src/engine/core/rng';
import { overrideTerrain } from './fake/terrain';
import { speciesDef } from '../src/engine/entities/species/registry';
import * as look from '../src/engine/world/lowpolyKit';
import { PopulationProjection } from '../src/game/population/projection';
import { populationProjectionRows } from '../src/shards/driftwood-isle/generators/populationProjection';
import { manager } from './fake/manager';
import { mockCanvas } from './fake/weaponParity';

test('a marsh population projects memory effects, loose lights and practice returns, then restores habitat ownership', async () => {
  mockCanvas();
  const terrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 }), f = manager();
  const scope = new Scope('marsh.projection'), material = new MeshStandardMaterial(); vi.spyOn(look, 'lowPolyLookMaterial').mockReturnValue(material);
  const source = populationProjectionRows(), variant = speciesDef('boar').variants[0]?.id;
  if (variant === undefined) throw new Error('Missing fixture variant');
  const row = { kind: 'boar', variant, x: 3, z: 4, yaw: 0, herd: 0, practice: true } as const;
  const page = { stream: new Rng(91).snapshot(), centres: [{ x: 3, z: 4 }], kinds: ['boar'], herds: 1,
    enemies: [row, { kind: 'boar', variant, x: 7, z: 4, yaw: 0, herd: -1 }], palms: [{ x: 1, z: 2, h: 3, lean: .5, leanDir: 0 }] };
  const previous = f.manager.habitat.throwCoconut, sound = vi.fn<(name: string, at: Vector3) => void>(); f.manager.onSound = sound;
  const projection = new PopulationProjection(f.manager, f.game.scene, f.sky, scope, { ...source, id: 'marsh.volley', seed: SEED, random: 91,
    page: { phone: page, desktop: page }, counts: { hogs: { kind: 'boar', groups: false, practice: false } },
    practice: { delay: .1, away: 5 }, hold: { kind: 'boar', x: 0, z: 0, r: 1, guardR: 1, step: 1, floor: Array.from({ length: 9 }, () => null) },
    splash: { ...source.splash, capacity: 12, count: 3 }, effects: [{ kind: 'boar', state: 'display', actions: [{ state: 3, sound: 'marsh.call', splash: 1 }],
      periodic: { state: 7, interval: .2, chance: 1, x: 'goal-x', z: 'goal-z', radius: .1, splash: .5 } }] });
  try {
    await projection.build(); expect(projection.placed['hogs']).toBe(2);
    expect(f.manager.habitat.perches?.[0]?.toArray()).toEqual([2.5, 3.3, 2]);
    const actor = projection.practice; if (actor === null) throw new Error('Missing practice actor');
    actor.mem['display'] = 3; projection.update(.01, 1, new Vector3()); expect(sound).toHaveBeenCalledWith('marsh.call', actor.position);
    const points = projection.group.children.find((object): object is Points => object instanceof Points);
    if (points === undefined) throw new Error('Missing pool');
    expect(Array.from(points.geometry.getAttribute('position').array).some(value => value > 0)).toBe(true);
    const lights = projection.group.children.filter(object => object instanceof PointLight); expect(lights).toHaveLength(1);
    actor.alive = false; actor.hidden = true; projection.update(.2, 2, new Vector3(30, 0, 30)); projection.update(.01, 2.01, new Vector3(30, 0, 30));
    expect(projection.practice).not.toBe(actor); expect(projection.placed['hogs']).toBe(3);
    scope.dispose(); expect(projection.group.parent).toBeNull(); expect(f.manager.habitat.throwCoconut).toBe(previous); expect(f.manager.animals).toHaveLength(0);
    projection.dispose();
  } finally { scope.dispose(); material.dispose(); terrain(); }
});
