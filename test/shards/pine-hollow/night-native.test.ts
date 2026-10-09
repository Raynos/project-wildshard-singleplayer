// oxlint-disable-next-line import/no-nodejs-modules -- Read the actual native physics and terrain/navmesh fixtures.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import * as v from 'valibot';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { parseNavmesh } from '../../../src/engine/physics/navmesh';
import { bakedSamplers } from '../../../src/engine/world/BakedTerrain';
import { installPine, pineTerrainGrid, prepareHeadlessRuntime, PINE_TERRAIN_ASSET, PINE_NAVMESH_ASSET } from '../../../src/shards/pine-hollow/runtime/headless';
import { pineBake } from '../../../src/shards/pine-hollow/runtime/baked';
import { NIGHT_STEP } from '../../../src/shards/pine-hollow/runtime/night';
import { pineNightSpec } from '../../../src/shards/pine-hollow/quest/nightSpec';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { OLD_GROWTH, HAMLET_SITES } from '../../../src/shards/pine-hollow/layout';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

const assets = new Map([PINE_TERRAIN_ASSET, PINE_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
const grid = pineTerrainGrid(assets.get(PINE_TERRAIN_ASSET)), heightAt = bakedSamplers(grid).heightAt;
// Buffer's backing allocation may be larger than its view; parse the exact file separately.
const navBytes = readFileSync(PINE_NAVMESH_ASSET);
const nativeNav = (() => { const parsed = parseNavmesh(Uint8Array.from(navBytes).buffer); if (parsed === null) throw new Error('Missing Pine navmesh'); return parsed; })();
nativeNav.datum = () => 0;
let rapier: Rapier, plan: HeadlessRuntimePlan;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const { default: source } = await import('../../../src/shards/pine-hollow/shard.config');
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
});
const night = { value: 1 };
function install(host: SimHost, saved?: SimSnapshot) {
  const parts = installPine(host, { bake: pineBake(), grid, nav: nativeNav, heightAt, spawnY: 0,
    night: () => night.value, dusk: () => 0, ...(saved === undefined ? {} : { saved }) });
  return { ...parts, brain: parts.thralls };
}
function boot() { const host = createSimHost(plan.level, { ...plan.ports, rapier }); return { host, ...install(host) }; }
function resumed(saved: SimSnapshot): SimHost {
  return restoreSimHost(plan.level, { ...plan.ports, rapier }, saved, host => { install(host, saved); });
}
function place(host: SimHost, x: number, z: number): void {
  const at = new Vector3(x, heightAt(x, z) + 0.3, z); host.player.motor.resetAt(at); host.player.position.copy(at);
}
function population(host: SimHost) {
  const keeper = host.adapters.get(NIGHT_STEP); if (keeper === undefined) throw new Error('Missing night keeper'); return keeper;
}

it('hosts the authored three real millrace bodies, restores them asleep and wakes/finishes on the same law', () => {
  night.value = 1;
  const original = boot(); let restored: SimHost | null = null;
  try {
    const host = original.host;
    host.flags.set('errand:asked'); place(host, HAMLET_SITES.mill.x + 60, HAMLET_SITES.mill.z);
    for (let i = 0; i < 60; i++) host.step();
    const race = [...host.entities.values()].filter(a => a.variant === 'thrall');
    expect(race.map(a => [a.kind, a.scripted, a.state])).toEqual([['boar', true, 'sidestep'], ['elk', true, 'sidestep'], ['boar', true, 'sidestep']]);
    // The manager updates bodies after the population callback on this same tick. Check the immutable birth
    // coordinates, rather than mistaking the first collision correction for an authored placement change.
    const birth = v.looseObject({ at: v.looseObject({ x: v.number(), z: v.number() }) });
    expect(race.map(a => {
      const recipe = host.adapters.get(`runtime.actor.${a.entityId}`)?.snapshot();
      if (typeof recipe !== 'string') throw new Error('Missing actual birth recipe');
      const { at } = v.parse(birth, JSON.parse(recipe)); return [at.x, at.z];
    })).toEqual(pineNightSpec(3).race.map(a => [a.x, a.z]));
    restored = resumed(snapshotSimHost(host)); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    const first = race[0]; if (first === undefined) throw new Error('Missing race');
    for (const world of [host, restored]) place(world, first.position.x + 10, first.position.z);
    host.step(); restored.step();
    expect(first.scripted).toBe(false);
    for (const world of [host, restored]) {
      for (const body of race) {
        const actor = world.entities.get(body.entityId); if (actor === undefined) throw new Error('Missing restored race');
        world.combat.hit({ source: world.player.health, sourceTags: ['dmg.melee', 'cover.checked'], target: actor.combatActor(),
          amount: actor.maxHp * 10, point: actor.position.clone(), dir: new Vector3() });
      }
    }
    for (let i = 0; i < 600; i++) { host.step(); restored.step(); }
    expect(host.flags.has('errand:done')).toBe(true); expect(original.brain.count).toBe(0);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
  } finally { restored?.dispose(); original.host.dispose(); }
});

it('retires real old-growth roamers at dawn with an exact restored flee suffix and no duplicate spawn', () => {
  night.value = 1;
  const original = boot(); let restored: SimHost | null = null;
  try {
    const host = original.host; place(host, OLD_GROWTH.x, OLD_GROWTH.z);
    for (let i = 0; i < 240; i++) host.step();
    const ids = [...host.entities.values()].filter(a => a.variant === 'thrall').map(a => a.entityId);
    expect(ids.length).toBeGreaterThan(0); expect(ids.length).toBeLessThanOrEqual(3);
    night.value = 0; for (let i = 0; i < 40; i++) host.step();
    restored = resumed(snapshotSimHost(host));
    for (let i = 0; i < 600; i++) { host.step(); restored.step(); }
    expect(ids.every(id => !host.entities.has(id))).toBe(true); expect(original.brain.count).toBe(0);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
  } finally { restored?.dispose(); original.host.dispose(); }
});

it('rejects a foreign placement stream before changing the population or flags', () => {
  const original = boot();
  try {
    const adapter = population(original.host), before = adapter.snapshot();
    const saved: unknown = before;
    if (typeof saved !== 'object' || saved === null || !('rng' in saved) || typeof saved.rng !== 'object' || saved.rng === null) throw new Error('Missing stream');
    const rng = saved.rng;
    expect(() => adapter.restore({ ...saved, rng: { ...rng, initial: 0 } })).toThrow('Incompatible Pine night stream');
    expect(adapter.snapshot()).toEqual(before);
  } finally { original.host.dispose(); }
});
