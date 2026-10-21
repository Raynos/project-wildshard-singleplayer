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
import { ProjectedState, ReturnProgram } from '../src/game/population/returnProgram';
import { ReturnGate } from '../src/game/population/respawn';
import { populationProjectionRows } from '../src/shards/driftwood-isle/generators/populationProjection';
import { manager } from './fake/manager';
import { mockCanvas } from './fake/weaponParity';
import { readNativeTerrain } from '../src/sdk/bake/terrain';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { WORLD_DROP } from '../src/shards/driftwood-isle/generators/landscapeRows';
import foliage from '../src/shards/driftwood-isle/data/foliagePlacements.generated.json';
import island from '../src/shards/driftwood-isle/data/islandFacts.generated.json';

test('a marsh population projects memory effects, loose lights and practice returns, then restores habitat ownership', async () => {
  mockCanvas();
  const terrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 }), f = manager();
  const scope = new Scope('marsh.projection'), material = new MeshStandardMaterial(); vi.spyOn(look, 'lowPolyLookMaterial').mockReturnValue(material);
  const source = populationProjectionRows(), variant = speciesDef('boar').variants[0]?.id;
  if (variant === undefined) throw new Error('Missing fixture variant');
  const row = { kind: 'boar', variant, x: 3, z: 4, yaw: 0, herd: 0, practice: true } as const;
  const page = { stream: new Rng(91).snapshot(), centres: [{ x: 3, z: 4 }], kinds: ['boar'], herds: 1,
    enemies: [row, { kind: 'boar', variant, x: 7, z: 4, yaw: 0, herd: -1 }], perches: [{ crown: [2.5, 14, 2], base: [1, 9.25, 2] }] };
  const previousPerches = [new Vector3(8, 9, 10)], previousBases = [new Vector3(8, 0, 10)];
  f.manager.habitat.perches = previousPerches; f.manager.habitat.perchBases = previousBases;
  const previous = f.manager.habitat.throwCoconut, sound = vi.fn<(name: string, at: Vector3) => void>(); f.manager.onSound = sound;
  const projection = new PopulationProjection(f.manager, f.game.scene, f.sky, scope, { ...source, id: 'marsh.volley', seed: SEED, random: 91,
    page: { phone: page, desktop: page }, counts: { hogs: { kind: 'boar', groups: false, practice: false } },
    practice: { ...source.practice, law: { ...source.practice.law, parameters: { delay: .1, away: 5 } } }, hold: { kind: 'boar', x: 0, z: 0, r: 1, guardR: 1, step: 1, floor: Array.from({ length: 9 }, () => null) },
    splash: { ...source.splash, capacity: 12, count: 3 }, effects: [{ kind: 'boar', state: 'display', actions: [{ state: 3, sound: 'marsh.call', splash: 1 }],
      periodic: { state: 7, interval: .2, chance: 1, x: 'goal-x', z: 'goal-z', radius: .1, splash: .5 } }] });
  try {
    await projection.build(); expect(projection.placed['hogs']).toBe(2);
    expect(f.manager.habitat.perches[0]?.toArray()).toEqual([2.5, 14, 2]);
    expect(f.manager.habitat.perchBases[0]?.toArray()).toEqual([1, 9.25, 2]);
    const actor = projection.practice; if (actor === null) throw new Error('Missing practice actor');
    actor.mem['display'] = 3; projection.update(.01, 1, new Vector3()); expect(sound).toHaveBeenCalledWith('marsh.call', actor.position);
    const points = projection.group.children.find((object): object is Points => object instanceof Points);
    if (points === undefined) throw new Error('Missing pool');
    expect(Array.from(points.geometry.getAttribute('position').array).some(value => value > 0)).toBe(true);
    const lights = projection.group.children.filter(object => object instanceof PointLight); expect(lights).toHaveLength(1);
    actor.alive = false; actor.hidden = true; projection.update(.2, 2, new Vector3(30, 0, 30)); projection.update(.01, 2.01, new Vector3(30, 0, 30));
    expect(projection.practice).not.toBe(actor); expect(projection.placed['hogs']).toBe(3);
    scope.dispose(); expect(projection.group.parent).toBeNull(); expect(f.manager.habitat.throwCoconut).toBe(previous); expect(f.manager.animals).toHaveLength(0);
    expect(f.manager.habitat.perches).toBe(previousPerches); expect(f.manager.habitat.perchBases).toBe(previousBases);
    projection.dispose();
  } finally { scope.dispose(); material.dispose(); terrain(); }
});


test('both tiers bake every leaning crown and base with the installed native terrain law', () => {
  const projection = populationProjectionRows(), heightAt = readNativeTerrain(driftwoodGroundBytes()).heightAt;
  for (const tier of ['phone', 'desktop'] as const) {
    const palms = [...foliage.tiers[tier].palms.specs, ...island.extraPalms], sites = projection.page[tier].perches;
    expect(sites).toHaveLength(palms.length);
    palms.forEach((palm, index) => {
      const base = heightAt(palm.x, palm.z) - WORLD_DROP - .2;
      expect(sites[index]).toEqual({ crown: [palm.x + Math.cos(palm.leanDir) * palm.lean * palm.h, base + palm.h + .5,
        palm.z + Math.sin(palm.leanDir) * palm.lean * palm.h], base: [palm.x, base + .2, palm.z] });
    });
  }
});


test('the admitted return guest retains hidden-corpse gates and samples at ten Hz', () => {
  const rows = populationProjectionRows().practice, rule = { delay: .3, away: 5, fade: 'hidden' } as const;
  const guest = ReturnProgram.page(rows.program), sample = vi.spyOn(guest, 'project');
  const law = new ProjectedState({ ...rows.law, parameters: { delay: rule.delay, away: rule.away }, signals: { step: rows.law.signal } }, guest);
  const clock = { dead: 0, fade: -1 }, actions = { none: 0, fade: 1, replace: 2 };
  for (const frame of [
    { alive: true, hidden: false, distance: 20 },
    ...Array.from({ length: 5 }, () => ({ alive: false, hidden: false, distance: 1 })),
    { alive: false, hidden: false, distance: 5 },
    { alive: false, hidden: true, distance: 4.99 },
    { alive: false, hidden: true, distance: 5 },
  ]) {
    const calls = sample.mock.calls.length;
    expect(law.step(.04, { ...frame, alive: Number(frame.alive), hidden: Number(frame.hidden), deadDt: frame.alive ? 0 : .04 }).dt).toBe(0);
    expect(sample).toHaveBeenCalledTimes(calls);
    const next = law.step(.06, { ...frame, alive: Number(frame.alive), hidden: Number(frame.hidden), deadDt: frame.alive ? 0 : .1 });
    expect(sample).toHaveBeenCalledTimes(calls + 1);
    expect(next.values['action']).toBe(actions[ReturnGate.step(clock, rule, .1, frame.alive, frame.distance, frame.hidden)]);
    expect(law.value('dead')).toBe(clock.dead);
  }
  law.reset(); expect(law.value('dead')).toBe(0);
  expect(law.step(.05, { alive: 0, hidden: 1, distance: 99 }).dt).toBe(0);
});
