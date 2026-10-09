// oxlint-disable-next-line import/no-nodejs-modules -- Read the real WASM and admitted Nalati terrain/navigation assets.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, serializeSimSnapshot, decodeSimSnapshot, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET, prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { nalatiCreaturesOf } from '../../../src/shards/nalati-grasslands/runtime/headlessCreatures';
import { nalatiGroupsOf } from '../../../src/shards/nalati-grasslands/runtime/groups';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map([NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
const effects = { commands: () => [], emit: (): never => { throw new Error('raid install must not emit a reward'); } };
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); plan = await prepareHeadlessRuntime({ shard: source, assets, rapier }); });
function boot(saved?: SimSnapshot): SimHost {
  const ports = { ...plan.ports, rapier };
  if (saved === undefined) { const host = createSimHost(plan.level, ports); plan.install(host, { restoring: false, ...effects }); return host; }
  return restoreSimHost(plan.level, ports, saved, host => { if (ports.heightAt !== undefined) host.setHeightQuery(ports.heightAt); plan.install(host, { restoring: true, snapshot: saved, ...effects }); });
}
function parts(host: SimHost) {
  const creatures = nalatiCreaturesOf(host), groups = nalatiGroupsOf(host);
  if (creatures === undefined || groups === undefined) throw new Error('missing actual raid controllers');
  return { ...creatures, groups };
}

it('takes the real first-raid timer draw at boot, patrols after Wildlife, and spawns no pack before the deadline', () => {
  const host = boot();
  try {
    const { raid, groups } = parts(host), before = raid.snapshot(), ai = host.rng.stream('ai').snapshot();
    expect(raid.raidT).toBe(groups.firstRaid); expect(raid.raidT).toBeGreaterThanOrEqual(150); expect(raid.raidT).toBeLessThan(240);
    for (let i = 0; i < 60; i++) host.step();
    expect(host.entities.size).toBe(35); expect(groups.packs).toHaveLength(1);
    expect(raid.raidT).toBeCloseTo(before.raidT - 1, 9); expect(raid.shepherd.patrolA).not.toBe(0);
    expect(host.rng.stream('ai').snapshot()).not.toEqual(ai);
  } finally { host.dispose(); }
});

it('spawns the actual valley pack lazily, binds a real flock prey, and restores the raid/bodies/shared streams without replaying spawn', () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    // Reuse the immutable admitted native world as the codec basis; no full-world search in the CI coverage budget.
    const { raid, groups, flocks } = parts(first), basis = first.physics.snapshot();
    expect(raid.start(true)).toBe(true); expect(raid.start(true)).toBe(false);
    expect([...first.entities.keys()].slice(-3)).toEqual(['creature:36', 'creature:37', 'creature:38']);
    expect(groups.packs).toHaveLength(2); expect(groups.packs[1]?.members.map(a => a.variant)).toEqual(['grey', 'tawny', 'scout']);
    for (let i = 0; i < 60; i++) first.step();
    const saved = snapshotSimHost(first), before = raid.snapshot();
    expect(before.spawned).toBe(1); expect(before.raids).toBe(1); expect(before.prey).toBeGreaterThanOrEqual(0);
    restored = boot(decodeSimSnapshot(serializeSimSnapshot(saved, basis), basis)); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    expect(parts(restored).raid.snapshot()).toEqual(before); expect(parts(restored).flocks[0]?.snapshot()).toBe(flocks[0]?.snapshot());
    for (let i = 0; i < 120; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
    expect(restored.entities.size).toBe(38); expect(parts(restored).groups.packs).toHaveLength(2);
  } finally { restored?.dispose(); first.dispose(); }
}, 60_000);


it('allocates nearby deferred raiders on the very raid frame and reconnects their native motors on restore', () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const { raid, flocks } = parts(first), flock = flocks[0], basis = first.physics.snapshot();
    if (flock === undefined) throw new Error('missing native pasture');
    first.player.position.set(flock.cx - 80, 40, flock.cz - 8);
    raid.raidT = 0;
    first.step();
    const wolves = [...first.entities.values()].slice(-3);
    expect(wolves).toHaveLength(3); expect(parts(first).groups.packs).toHaveLength(2);
    wolves.forEach(w => { expect(w.kind).toBe('wolf'); expect(w.motor).not.toBeNull(); });
    const saved = snapshotSimHost(first);
    restored = boot(decodeSimSnapshot(serializeSimSnapshot(saved, basis), basis)); expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let i = 0; i < 30; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
  } finally { restored?.dispose(); first.dispose(); }
}, 60_000);
