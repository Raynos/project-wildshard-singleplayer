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
import { NALATI_SUN, NALATI_TERRAIN_ASSET, nalatiDayClock, nalatiWeatherOf, prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { Wind } from '../../../src/engine/world/steppeWind';
import { lightLevel } from '../../../src/shards/nalati-grasslands/look/wildLight';
import { steppeStorm, stepStorm, stormWind } from '../../../src/shards/nalati-grasslands/world/weatherStep';
import { SEED } from '../../../src/shards/nalati-grasslands/world/terrain';
import { NALATI_GRASSLANDS } from '../../../src/shards/nalati-grasslands/manifest';
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

it('starts the page\'s day clock on the manifest\'s sun, in the day; a witness level starting at dusk refuses (its elites are not modelled)', () => {
  expect(NALATI_GRASSLANDS.sky.sun).toEqual(NALATI_SUN);
  const host = boot();
  try {
    expect(host.dayClock?.hour).toBeCloseTo(16.22, 2); expect(host.dayClock?.dayPhase).toBe('day');
    expect(snapshotSimHost(host).day).toEqual(nalatiDayClock().snapshot());
  } finally { host.dispose(); }
  const dusk = createSimHost({ ...plan.level, day: { start: 18.5 } }, { ...plan.ports, rapier });
  try { expect(() => { plan.install(dusk, { restoring: false, ...effects }); }).toThrow('does not model the kokbori elite'); } finally { dusk.dispose(); }
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

it('reads the page\'s grass: the groups\' standing grass is the page\'s grassBaseHeightAt at every sampled point, untrampled', () => {
  const host = boot();
  try {
    const groups = nalatiGroupsOf(host); if (groups === undefined) throw new Error('no groups');
    // every body's tick-0 spot, then a 48² off-lattice grid: the lattice, the trail beds, the yurt floors, the water
    expect(bake.grass.length).toBe(bake.spawns.length + 48 * 48);
    expect(bake.grass.filter(row => row[2] > 0.9).length).toBeGreaterThan(20);
    expect(bake.grass.filter(row => row[2] === 0).length).toBeGreaterThan(20);
    const env = groups.env;
    const off = bake.grass.filter(([x, z, h]) => Math.abs(env.grassStandingAt(x, z) - h) > 1e-9 || Math.abs(env.grassHeightAt(x, z) - h) > 1e-9);
    expect(off).toEqual([]);
  } finally { host.dispose(); }
});

it('walks 2k ticks: every body stays finite on the ground, on the page\'s distance bands; the player\'s trail flattens the grass and recovers', () => {
  const host = boot();
  try {
    const groups = nalatiGroupsOf(host); if (groups === undefined) throw new Error('no groups');
    const { trample } = groups.grass, spots: { x: number; z: number }[] = [];
    for (let tick = 0; tick < 2000; tick++) {
      walk(host); spots.push({ x: host.player.position.x, z: host.player.position.z });
      if (tick !== 1000) continue;
      // the trample map on the host step (look/grass.ts's order): fresh under the feet, 10 s back half recovered (RECOVER =
      // 20 s), and the groups' grass reads it (grassHeightAt = standing × (1 − 0.85 × trample))
      const p = host.player.position, here = trample.amountAt(p.x, p.z), back = spots[400], old = back === undefined ? -1 : trample.amountAt(back.x, back.z);
      expect(here).toBeGreaterThan(0.5); expect(old).toBeGreaterThan(0); expect(old).toBeLessThanOrEqual(0.5 + 1e-6);
      expect(groups.env.grassHeightAt(p.x, p.z)).toBeCloseTo(groups.env.grassStandingAt(p.x, p.z) * (1 - 0.85 * here), 12);
    }
    const p = host.player.position;
    expect(p.z).toBeLessThan(220); expect(p.y).toBeGreaterThan(heightAt(p.x, p.z) - 0.3);
    expect([...host.entities.values()].every(a => [a.position.x, a.position.y, a.position.z].every(Number.isFinite))).toBe(true);
    // the page's day clock on the host's tick: the hour a 60 Hz page frame clock reaches, past the boot's day into golden
    const page = nalatiDayClock(); for (let i = 0; i < 2000; i++) page.update(1 / 60);
    expect(host.dayClock?.hour).toBe(page.hour); expect(host.dayClock?.dayPhase).toBe('golden');
    // the page's weather on the host's tick (world/installWeather.ts's rules at 60 Hz: the grass's wind.update, then the storm
    // after the clock): still clear, its wind and phase clock as the page's, the creatures' light the golden hour's, no storm
    const weather = nalatiWeatherOf(host); if (weather === undefined) throw new Error('no weather');
    const wind = new Wind({ value: 1 }), storm = steppeStorm(SEED, { heightAt, exposed: () => undefined, player: () => { throw new Error('read'); } }), ask = stormWind(wind);
    for (let i = 0; i < 2000; i++) { wind.update(1 / 60); stepStorm(storm, ask, wind, 1 / 60, false); }
    expect(weather.storm.snapshot()).toEqual(storm.snapshot()); expect(weather.wind.snapshot()).toEqual(wind.snapshot());
    expect(weather.storm.state).toBe('clear'); expect(weather.storm.phaseLen).toBeGreaterThan(12 * 60);
    expect({ light: groups.env.light, storm: groups.env.storm, wind: groups.env.wind }).toEqual({ light: lightLevel(page), storm: false, wind: { x: wind.dirX, z: wind.dirZ, strength: Math.min(1, wind.speed / 10) } });
    // 25 s on, the tick-500 trail has stood back up, inside the map's 128 m window
    const stood = spots[500]; if (stood === undefined) throw new Error('no trail');
    expect(Math.max(Math.abs(stood.x - p.x), Math.abs(stood.z - p.z))).toBeLessThan(60); expect(trample.amountAt(stood.x, stood.z)).toBe(0);
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
      // the trample map continues too: the player's trail is in the saved state
      const trample = sa.adapters.find(entry => entry.id === 'nalati.trample')?.state;
      expect(JSON.stringify(trample)).toMatch(/^\{"trail":\[[^\]]+\],"map":\{"cells":\[\d+,/u);
      expectSameSimSnapshot(snapshotSimHost(b), sa);
    } finally { b.dispose(); }
  } finally { a.dispose(); }
});

it('carries a building storm through a restore exactly, and refuses at the gust front (the lightning\'s world is not modelled)', () => {
  const a = boot();
  try {
    // forced, as the page's dev switch does: the storm's own clock reaches building only after 12–18 min of clear
    const wa = nalatiWeatherOf(a); if (wa === undefined) throw new Error('no weather');
    wa.storm.force('building', 0.6);
    for (let tick = 0; tick < 30; tick++) walk(a);
    const b = restore(snapshotSimHost(a));
    try {
      for (let tick = 0; tick < 30; tick++) { walk(a); walk(b); }
      const sa = snapshotSimHost(a), env = nalatiGroupsOf(b)?.env;
      expect(wa.ask.asked).not.toBeNull(); expect(nalatiWeatherOf(b)?.ask.asked).toBe(wa.ask.asked);
      expect(env?.wind.strength).toBe(nalatiGroupsOf(a)?.env.wind.strength);
      expectSameSimSnapshot(snapshotSimHost(b), sa);
      wa.storm.force('gust', 0);
      // its first GET LOW check (every 0.25 s) reads the player the lightning sees
      expect(() => { for (let tick = 0; tick < 20; tick++) walk(a); }).toThrow('not modelled yet');
    } finally { b.dispose(); }
  } finally { a.dispose(); }
});

it('loads the trusted entry in plain Node under the renderer-denying loader', () => {
  const run = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    'await import("./src/shards/nalati-grasslands/runtime/headless.ts"); console.log("ok")'], { encoding: 'utf8', timeout: 30000 });
  expect(run.stderr).toBe(''); expect(run.stdout.trim()).toBe('ok');
});
