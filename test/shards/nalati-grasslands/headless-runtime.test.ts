// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module and Nalati's native bakes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Import the trusted runtime in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { restoreSimHost, snapshotSimHost, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { NALATI_TERRAIN_ASSET, prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { nalatiGroupsOf } from '../../../src/shards/nalati-grasslands/runtime/groups';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map([[NALATI_TERRAIN_ASSET, new Uint8Array(readFileSync(NALATI_TERRAIN_ASSET))]]);
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
});
const effects = { commands: () => [], emit: () => { throw new Error('the roster emits no gameplay effects'); } };
const boot = (): SimHost => { const host = createSimHost(plan.level, { ...plan.ports, rapier }); plan.install(host, { restoring: false, ...effects }); return host; };
/** Restore from the host's own snapshot object: a serialized one carries the 2694 baked colliders (~13 MB, seconds to encode and
 *  decode), which the trusted worker's own tests pay; this one proves the reinstall, not the codec. */
const restore = (saved: SimSnapshot): SimHost => {
  const ports = { ...plan.ports, rapier };
  return restoreSimHost(plan.level, ports, saved, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, { restoring: true, snapshot: saved, ...effects }); });
};
const bake = nalatiBake();
const heightAt = (x: number, z: number): number => { const h = plan.ports?.heightAt; if (h === undefined) throw new Error('no height query'); return h(x, z); };
/** The player's tape: north from the camp toward the river, weaving. */
function walk(host: SimHost): void { const t = host.state.tick; host.step({ moveX: 0.3 * Math.sin(t / 90), moveZ: -1, yaw: 0 }); }

it('stands the player at the camp on the page\'s terrain grid, with no entry proof yet (finish refuses)', () => {
  expect(plan.level.seed).toBe(0x4a1a); expect(plan.level.player.at.z).toBe(232);
  expect(plan.level.player.at.y).toBeCloseTo(Math.max(0, heightAt(0, 232) + 0.1), 9);
  expect(plan.proveEntries).toBeUndefined();
});

it('refuses without the page\'s terrain grid', async () => {
  await expect(Promise.resolve().then(() => prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier }))).rejects.toThrow('baked terrain grid');
});

it('spawns the page\'s 35 load-time bodies in its list order at their tick-0 spots and headings, on the creature floor', () => {
  const host = boot();
  try {
    expect([...host.entities.keys()]).toEqual(bake.actors.map(a => a.id));
    bake.actors.forEach((actor, i) => {
      const live = host.entities.get(actor.id), spawn = bake.spawns[i]; if (live === undefined || spawn === undefined) throw new Error(`missing ${actor.id}`);
      expect([live.kind, live.variant, live.seed, live.scale, live.herd, live.scripted]).toEqual([actor.kind, actor.variant, actor.seed, actor.scale, actor.herd, actor.scripted]);
      // the roster's spot and heading, the page's tick 0 (boot-roster.test.ts: the shepherd's horse's heading within a frame's turn)
      expect([live.position.x, live.position.z]).toEqual([spawn.at[0], spawn.at[2]]);
      expect(Math.abs(live.yaw - spawn.yaw)).toBeLessThan(actor.id === 'creature:23' ? 2.2 / 60 : 1e-12);
      // the page's floor is the same heightfield and colliders: its y within the grid's sampling of the same triangles
      expect(live.position.y).toBeCloseTo(spawn.at[1], 3);
    });
    // the Golden King (creature:24) is parked: his draws and id, no body
    expect(host.entities.has('creature:24')).toBe(false);
  } finally { host.dispose(); }
});

it('seeds the pack, the wild herd and Argymaq\'s herd on the \'ai\' stream exactly as the page does (its tick-0 continuations and memories)', () => {
  const host = boot();
  try {
    const groups = nalatiGroupsOf(host); if (groups === undefined) throw new Error('no groups');
    const states = [...groups.packs, ...groups.herds].map(g => g.snapshot());
    expect(states.length).toBe(bake.groups.length);
    // the page's order: Wildlife's pack, its wild herd, then Argymaq's (the King's reset draw between them)
    expect(bake.groups.map(g => g.kind)).toEqual(['pack', 'herd', 'herd']);
    states.forEach((state, i) => { expect(state).toBe(bake.groups[i]?.state); });
    // every body's memory as the page held it at its tick 0, but for what this host does not own: the horses' pose easing
    // (`_rear`, `_graze`…: horse.ts horsePostPose, the rig's), the elites' bar flag (runtime/state.ts `noHeadBar`) and
    // Aqbars' crouch (combat/elites.ts `low`: the elites are not modelled yet)
    const sim = (id: string, mem: Readonly<Record<string, number>>): Record<string, number> => Object.fromEntries(Object.entries(mem)
      .filter(([key]) => !key.startsWith('_') && key !== 'noHeadBar' && !(id === 'creature:25' && key === 'low')));
    bake.spawns.forEach(spawn => {
      const live = host.entities.get(spawn.id); if (live === undefined) throw new Error(`missing ${spawn.id}`);
      expect({ id: spawn.id, mem: live.mem }).toEqual({ id: spawn.id, mem: sim(spawn.id, spawn.mem) });
    });
  } finally { host.dispose(); }
});

it('walks 2k ticks: every body stays finite on the ground, on the page\'s distance bands', () => {
  const host = boot();
  try {
    for (let tick = 0; tick < 2000; tick++) walk(host);
    const p = host.player.position;
    expect(p.z).toBeLessThan(220); expect(p.y).toBeGreaterThan(heightAt(p.x, p.z) - 0.3);
    expect([...host.entities.values()].every(a => [a.position.x, a.position.y, a.position.z].every(Number.isFinite))).toBe(true);
  } finally { host.dispose(); }
});

it('restores mid-walk exactly: the reinstalled roster and the host continue step for step', () => {
  const a = boot();
  try {
    // one restore point and a short tape
    for (let tick = 0; tick < 120; tick++) walk(a);
    const b = restore(snapshotSimHost(a));
    try {
      for (let tick = 0; tick < 60; tick++) { walk(a); walk(b); }
      const sa = snapshotSimHost(a);
      expect(sa.bands).toBeDefined();
      expectSameSimSnapshot(snapshotSimHost(b), sa);
    } finally { b.dispose(); }
  } finally { a.dispose(); }
});

it('loads the trusted entry in plain Node under the renderer-denying loader', () => {
  const run = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    'await import("./src/shards/nalati-grasslands/runtime/headless.ts"); console.log("ok")'], { encoding: 'utf8', timeout: 30000 });
  expect(run.stderr).toBe(''); expect(run.stdout.trim()).toBe('ok');
});
