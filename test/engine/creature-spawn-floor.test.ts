import { afterEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { loadRapier } from '../../src/engine/physics/rapier';
import { Physics } from '../../src/engine/physics/Physics';
import { groups } from '../../src/engine/physics/groups';
import { clearTags } from '../../src/engine/physics/surface';
import { addTerrain } from '../../src/engine/physics/terrain';
import { setActivePhysics } from '../../src/engine/physics/active';
import { configureLevel } from '../../src/engine/level/selection';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { killBelowWorld } from '../../src/engine/entities/killHeight';
import { app } from '../../src/engine/app/runtime';
import type { SpeciesFlight } from '../../src/engine/ai/flight';
import { toLevelSpec } from '../../src/game/shard/spec';
import type { ShardManifest } from '../../src/game/shard/manifest';
import { TEMPLATE } from '../../src/shards/_template/manifest';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { manager } from '../fake/manager';
import { fakeWorld } from '../fake/world';

const FIXTURE: ShardManifest = { ...TEMPLATE, ground: { structures: true },
  spawn: { x: 0, y: 20, z: 0, yaw: 0 }, world: { killY: -80 }, uses: [], spawns: [], treeCount: 0 };
let physics: Physics | undefined;
afterEach(() => {
  setActivePhysics(null); physics?.dispose(); physics = undefined;
  clearTags(); configureLevel(toLevelSpec(TEMPLATE)); vi.restoreAllMocks();
});
async function platforms(): Promise<Physics> {
  configureLevel(toLevelSpec(FIXTURE));
  const ph = new Physics(await loadRapier(await (await fetch(wasmInline)).arrayBuffer()));
  physics = ph;
  ph.world.createCollider(ph.R.ColliderDesc.cuboid(5, 0.5, 5).setTranslation(0, 9.5, 0).setCollisionGroups(groups('WORLD')));
  ph.world.createCollider(ph.R.ColliderDesc.cuboid(5, 0.5, 5).setTranslation(0, 29.5, 0).setCollisionGroups(groups('WORLD')));
  // Neither a trigger nor another creature may become the spawn floor.
  ph.world.createCollider(ph.R.ColliderDesc.cuboid(5, 0.5, 5).setTranslation(0, 14.5, 0).setCollisionGroups(groups('WORLD')).setSensor(true));
  ph.world.createCollider(ph.R.ColliderDesc.cuboid(5, 0.5, 5).setTranslation(0, 16.5, 0).setCollisionGroups(groups('CREATURE')));
  ph.step(); setActivePhysics(ph); return ph;
}
function flight(spec: SpeciesFlight): void {
  const factory = new AnimalFactory(fakeWorld().sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
  const original = factory.model.bind(factory);
  vi.spyOn(AnimalFactory.prototype, 'model').mockImplementation((kind, variant) => {
    const model = original(kind, variant);
    return { ...model, species: { ...model.species, flight: spec } };
  });
}

it('spawns on the WORLD platform below spawn height and keeps the creature there across updates', async () => {
  await platforms();
  const m = manager().manager, a = m.spawn('crab', 0, 0, 0, 'small');
  expect(a.position.y).toBeCloseTo(10, 5); expect(a.mesh.position.y).toBeCloseTo(10, 5);
  for (let i = 0; i < 120; i++) {
    a.update(1 / 60, i / 60, false);
    expect(killBelowWorld(a, FIXTURE.world, app.combat)).toBe(false);
  }
  expect(a.position.y).toBeCloseTo(10, 5); expect(a.alive).toBe(true);
  a.position.x = 6;
  a.update(1 / 60, 0, false);
  expect(a.position.y).toBeCloseTo(10 - 10 / 3600, 5);
  expect(killBelowWorld(a, FIXTURE.world, app.combat)).toBe(false);
  for (let i = 1; i < 60; i++) a.update(1 / 60, i / 60, false);
  expect(a.position.y).toBeCloseTo(0, 5);
  expect(killBelowWorld(a, FIXTURE.world, app.combat)).toBe(false);
  for (let i = 60; i < 181; i++) a.update(1 / 60, i / 60, false);
  expect(a.position.y).toBeLessThan(-80);
  expect(killBelowWorld(a, FIXTURE.world, app.combat)).toBe(true);
  expect(a.alive).toBe(false);
  m.retire(a);
});

it('walks off a WORLD edge with a visible ballistic fall', async () => {
  await platforms(); const m = manager().manager, a = m.spawn('crab', 4.99, 0, Math.PI / 2, 'small');
  a.speed = 2; a.setMotion(Math.PI / 2, 2);
  a.update(1 / 60, 0, false);
  expect(a.position.x).toBeGreaterThan(5);
  expect(a.position.y).toBeCloseTo(10 - 10 / 3600, 5);
  expect(a.alive).toBe(true); m.retire(a);
});

it('retains a gust XZ displacement and its initial Y velocity when it leaves a WORLD deck', async () => {
  await platforms(); const m = manager().manager, a = m.spawn('crab', 4.99, 0, 0, 'small');
  a.impulse(new Vector3(6, 4, 2)); a.update(0.1, 0, false);
  expect(a.position.x).toBeCloseTo(5.59); expect(a.position.z).toBeCloseTo(0.2);
  expect(a.position.y).toBeCloseTo(10.3);
  a.setMotion(0, 0);
  for (let i = 0; i < 9; i++) a.update(0.1, i / 10, false);
  expect(a.position.y).toBeCloseTo(4); expect(a.position.x).toBeGreaterThan(6);
  expect(killBelowWorld(a, FIXTURE.world, app.combat)).toBe(false); m.retire(a);
});

it('lands on a lower WORLD platform and clears its fall velocity', async () => {
  const ph = await platforms();
  ph.world.createCollider(ph.R.ColliderDesc.cuboid(5, 0.5, 5).setTranslation(10, -0.5, 0).setCollisionGroups(groups('WORLD')));
  ph.step(); const m = manager().manager, a = m.spawn('crab', 4.99, 0, Math.PI / 2, 'small');
  a.speed = 2; a.setMotion(Math.PI / 2, 2); a.update(1 / 60, 0, false); a.setMotion(0, 0);
  for (let i = 0; i < 90; i++) a.update(1 / 60, i / 60, false);
  expect(a.position.y).toBeCloseTo(0, 5); expect(a.alive).toBe(true);
  for (let i = 0; i < 60; i++) a.update(1 / 60, i / 60, false);
  expect(a.position.y).toBeCloseTo(0, 5); m.retire(a);
});

it('selects stacked floors with fromY and accepts an exact initial world y', async () => {
  await platforms(); const m = manager().manager;
  const upper = m.spawn('crab', 0, 0, 0, 'small', { fromY: 40 });
  const lower = m.spawn('crab', 0, 0, 0, 'small', { fromY: 12 });
  const exact = m.spawn('crab', 0, 0, 0, 'small', { y: 45 });
  expect(upper.position.y).toBeCloseTo(30, 5); expect(lower.position.y).toBeCloseTo(10, 5);
  expect(exact.position.y).toBe(45); expect(exact.mesh.position.y).toBe(45);
  expect(() => m.spawn('crab', 0, 0, 0, 'small', { y: Number.NaN })).toThrow('finite');
  expect(() => m.spawn('crab', 0, 0, 0, 'small', { fromY: Infinity })).toThrow('finite');
  for (const a of [upper, lower, exact]) m.retire(a);
});

it.each(['ground', 'world'] as const)('starts above-%s flyers at their declared altitude reference', async (above) => {
  await platforms(); flight({ altitude: 4, above, climbRate: 2, diveRate: 3 });
  const m = manager().manager, a = m.spawn('crab', 0, 0, 0, 'small');
  expect(a.position.y).toBeCloseTo(above === 'ground' ? 14 : 4, 5);
  for (let i = 0; i < 60; i++) a.update(1 / 60, i / 60, false);
  expect(a.position.y).toBeCloseTo(above === 'ground' ? 14 : 4, 5);
  const exact = m.spawn('crab', 0, 0, 0, 'small', { y: 45 });
  expect(exact.position.y).toBe(45); m.retire(a); m.retire(exact);
});

it('retains exact analytic heights on normal terrain instead of collider triangulation', async () => {
  const ph = await platforms(), terrain = TEMPLATE.ground.terrain;
  if (terrain === undefined) throw new Error('template terrain missing');
  configureLevel(toLevelSpec({ ...TEMPLATE, ground: { terrain: { ...terrain, heightAt: () => 0.07 } } }));
  // Different heights deliberately prove that the original analytical path remains exact.
  addTerrain(ph, new Float32Array(4), 2, 100); ph.step();
  const m = manager().manager, a = m.spawn('crab', 8, 0, 0, 'small');
  expect(a.position.y).toBe(0.07);
  expect(a.groundHeight).toBeUndefined();
  for (let i = 0; i < 60; i++) a.update(1 / 60, i / 60, false);
  expect(a.position.y).toBe(0.07); expect(a.levelGround).toBe(false); m.retire(a);
});

it('falls back to the documented analytic floor when no WORLD floor exists', () => {
  configureLevel(toLevelSpec(FIXTURE)); setActivePhysics(null);
  const m = manager().manager, a = m.spawn('crab', 0, 0, 0, 'small');
  expect(a.position.y).toBe(-1000); m.retire(a);
});
