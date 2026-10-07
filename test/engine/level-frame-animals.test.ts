import { afterEach, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { LevelFrameBinding } from '../../src/engine/level/frame';
import { activeLevel, configureLevel } from '../../src/engine/level/selection';
import { heightAt } from '../../src/engine/world/Heightfield';
import { WaterBodies } from '../../src/engine/world/water/body';
import { AnimalManager } from '../../src/engine/entities/AnimalManager';
import { setActivePhysics } from '../../src/engine/physics/active';
import { fakeWorld } from '../fake/world';
import { TEMPLATE } from '../../src/shards/_template/manifest';
import { toLevelSpec } from '../../src/game/shard/spec';
import type { TerrainField } from '../../src/engine/level/data';

const field = (h: number): TerrainField => ({ heightAt: () => h, normalAt: () => [0, 1, 0], splatAt: () => [1, 0, 0, 0], trailDistance: () => 100, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => -100, trails: [], cabinSites: [], pond: null });
const priorDocument: unknown = Reflect.get(globalThis, 'document');
afterEach(() => { if (priorDocument === undefined) Reflect.deleteProperty(globalThis, 'document'); else Reflect.set(globalThis, 'document', priorDocument); vi.restoreAllMocks(); });

it('resumes actual creature herds on their captured regional terrain after each yield, leaving home unchanged', async () => {
  // Presentation-only canvas port; creature planning, RNG, models, heights and service scopes are real.
  Reflect.set(globalThis, 'document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop: () => undefined }), fillStyle: '', fillRect: () => undefined }) }) });
  setActivePhysics(null);
  const home = { ...toLevelSpec(TEMPLATE), id: 'home', ground: { terrain: field(3) }, spawns: [] }; configureLevel(home);
  const scope = new Scope('animals.region');
  const region = { ...home, id: 'region', seed: 435, ground: { terrain: field(30) },
    faunaTuning: { boar: { hp: 123 } },
    spawns: [-100, 100].map((x) => ({ kind: 'boar', count: 1, variants: ['boar'], canopy: false, trailBand: [0, 150] as [number, number], anchor: { x, z: 100, rMin: 0, rMax: 1 } })) };
  const frame = new LevelFrameBinding({ level: region, scope, navmesh: null, water: new WaterBodies() });
  const f = fakeWorld();
  const animals = frame.run(app, () => new AnimalManager(f.game.scene, f.sky, f.forest, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } }));
  const pause = vi.fn<() => Promise<void>>(async () => {
    expect(activeLevel()).toBe(home); expect(heightAt(0, 0)).toBe(3);
    expect(app.levelScope).not.toBe(scope);
    await Promise.resolve();
  });
  await animals.buildAsync(pause, frame);
  expect(pause).toHaveBeenCalledTimes(2); expect(animals.animals).toHaveLength(2);
  expect(animals.animals.map((animal) => animal.position.y)).toEqual([30, 30]);
  expect(animals.animals.map((animal) => animal.maxHp)).toEqual([123, 123]);
  expect(activeLevel()).toBe(home); expect(heightAt(0, 0)).toBe(3);
  scope.dispose();
});
