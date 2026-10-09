// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the shard's admitted in-tree bytes and the native physics module.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import * as v from 'valibot';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand, HeadlessEffect } from '../../../src/sdk/tickProtocol';
import source from '../../../src/shards/sunscar-dunes/shard.config';
import { FLAG, SCOUT_AT, SCOUT_FLAG } from '../../../src/shards/sunscar-dunes/data/flags';
import { brazierFlag } from '../../../src/shards/sunscar-dunes/quests/brazierFlag';
import { COMPLETE_FLAG } from '../../../src/shards/sunscar-dunes/quests/signal';
import { prepareHeadlessRuntime, signalSpots } from '../../../src/shards/sunscar-dunes/runtime/headless';
import { WHIP_STEP } from '../../../src/shards/sunscar-dunes/runtime/whip';
import { INTERACTIONS_STEP, type SignalSpot } from '../../../src/shards/sunscar-dunes/runtime/quest';
import { SIGNAL_ACT, SIGNAL_INTERACT } from '../../../src/shards/sunscar-dunes/quests/interactions';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map(source.files.map(file => [file.hash, new Uint8Array(readFileSync(`src/shards/sunscar-dunes/assets/${file.hash}`))]));
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
});
interface Run { host: SimHost; effects: HeadlessEffect[]; tape: HeadlessCommand[] }
function context(run: Omit<Run, 'host'>, restoring: boolean, snapshot?: ReturnType<typeof decodeSimSnapshot>) {
  return { restoring, ...(snapshot === undefined ? {} : { snapshot }), commands: () => run.tape, emit: (effect: HeadlessEffect) => { run.effects.push(effect); } };
}
function boot(): Run {
  const run = { effects: [] as HeadlessEffect[], tape: [] as HeadlessCommand[] }, host = createSimHost(plan.level, { ...plan.ports, rapier });
  plan.install(host, context(run, false)); return Object.assign(run, { host });
}
function restore(saved: string): Run {
  const run = { effects: [] as HeadlessEffect[], tape: [] as HeadlessCommand[] }, decoded = decodeSimSnapshot(saved), ports = { ...plan.ports, rapier };
  const host = restoreSimHost(plan.level, ports, decoded, fresh => { if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt); plan.install(fresh, context(run, true, decoded)); });
  return Object.assign(run, { host });
}
/** A crack is the whip's own (its row's cooldown gates it): a player lets the lash recover a second before the next one. */
const CRACKS = new Set<number>([SIGNAL_ACT.crank, SIGNAL_ACT.light, SIGNAL_ACT.light + 1, SIGNAL_ACT.light + 2]);
/** Stand with the eye 0.7 m above the spot (feet 1 m under it), then send one interaction on the next tick. */
function act(run: Run, value: number, spot: SignalSpot | null, cool = true): void {
  if (cool && CRACKS.has(value)) for (let i = 0; i < 60; i++) run.host.step({ moveX: 0, moveZ: 0, yaw: 0 });
  if (spot !== null) run.host.player.position.set(spot.x, spot.y - 1, spot.z + 0.3);
  run.tape = [{ kind: 'script', actorId: SIGNAL_INTERACT, value }];
  try { run.host.step({ moveX: 0, moveZ: 0, yaw: 0 }); } finally { run.tape = []; }
  // Keep the player at the target until the browser's lash finishes; the act is not a command-tick side effect.
  if (!CRACKS.has(value)) return;
  for (let i = 0; i < 120; i++) {
    const saved = snapshotSimHost(run.host).adapters.find(adapter => adapter.id === WHIP_STEP)?.state;
    if (typeof saved !== 'string') throw new Error('missing lash continuation');
    const state = v.parse(v.object({ crackT: v.number() }), JSON.parse(saved));
    if (state.crackT < 0) return;
    run.host.step({ moveX: 0, moveZ: 0, yaw: 0 });
  }
  throw new Error('Signal lash did not finish within its bounded recovery window');
}
const spot = (list: readonly SignalSpot[], id: string): SignalSpot => { const found = list.find(s => s.id === id); if (found === undefined) throw new Error(`missing spot ${id}`); return found; };

it('bakes the built world\'s prompt spots and crack targets at the browser radii', () => {
  const spots = signalSpots();
  expect(spots.interact.map(s => [s.id, s.radius])).toEqual([['logbook', 2.4], ['well', 2.6], ['brazier.0', 3], ['brazier.1', 3], ['brazier.2', 3], ['fire', 2.6]]);
  expect(spots.crack.map(s => [s.id, s.radius])).toEqual([['well.crank', 0.8], ['brazier.0', 1.2], ['brazier.1', 1.2], ['brazier.2', 1.2]]);
});

it('plays the signal quest\'s first five steps through the declared quest rows, refusing out-of-range and out-of-order acts', () => {
  const run = boot(), { interact, crack } = signalSpots();
  try {
    for (let tick = 0; tick < 2; tick++) run.host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    const quest = run.host.quests.find(q => q.def.id === 'sunscar.signal');
    expect(quest?.current?.id).toBe('scout');
    act(run, SIGNAL_ACT.logbook, null); // from the spawn crest: out of reach
    expect(run.host.flags.has(FLAG.logbook)).toBe(false);
    run.host.player.position.set(SCOUT_AT.x + 1, run.host.groundHeightAt(SCOUT_AT.x + 1, SCOUT_AT.z), SCOUT_AT.z);
    act(run, SIGNAL_ACT.talk, null);
    expect(run.host.flags.has(SCOUT_FLAG)).toBe(true); expect(quest?.current?.id).toBe('logbook');
    act(run, SIGNAL_ACT.logbook, spot(interact, 'logbook'));
    expect(quest?.current?.id).toBe('oil');
    act(run, SIGNAL_ACT.well, spot(interact, 'well')); // the bucket is still down
    expect(run.host.flags.has(FLAG.oil)).toBe(false);
    act(run, SIGNAL_ACT.crank, spot(crack, 'well.crank'));
    act(run, SIGNAL_ACT.well, spot(interact, 'well'));
    expect(run.host.flags.has(FLAG.oil)).toBe(true); expect(quest?.current?.id).toBe('waymarks');
    act(run, SIGNAL_ACT.light, spot(crack, 'brazier.0')); // a dry bowl does not catch
    expect(run.host.flags.has(brazierFlag(0))).toBe(false);
    act(run, SIGNAL_ACT.fire, spot(interact, 'fire')); // the tower waits for all three waymarks
    expect(run.host.flags.has(FLAG.lit)).toBe(false);
    for (let i = 0; i < 3; i++) { act(run, SIGNAL_ACT.pour + i, spot(interact, `brazier.${String(i)}`)); act(run, SIGNAL_ACT.light + i, spot(crack, `brazier.${String(i)}`)); }
    expect([0, 1, 2].every(i => run.host.flags.has(brazierFlag(i)))).toBe(true); expect(quest?.current?.id).toBe('fire');
    act(run, SIGNAL_ACT.fire, spot(interact, 'fire'));
    expect(run.host.flags.has(FLAG.lit)).toBe(true); expect(quest?.current?.id).toBe('matriarch');
    // the quest's reward waits for the Matriarch's step: no fact or coins yet
    expect(run.host.flags.has(COMPLETE_FLAG)).toBe(false); expect(run.effects).toEqual([]);
  } finally { run.host.dispose(); }
});

it('gates a crack by the whip row\'s cooldown, as the browser\'s crack: a second crack inside it does not land', () => {
  const run = boot(), { interact, crack } = signalSpots();
  try {
    run.host.flags.set(SCOUT_FLAG); run.host.flags.set(FLAG.logbook); run.host.flags.set(FLAG.oil);
    act(run, SIGNAL_ACT.pour, spot(interact, 'brazier.0'));
    act(run, SIGNAL_ACT.crank, spot(crack, 'well.crank')); // the heavy crack: 0.9 s before the lash is ready again
    act(run, SIGNAL_ACT.light, spot(crack, 'brazier.0'), false);
    expect(run.host.flags.has(brazierFlag(0))).toBe(false);
    act(run, SIGNAL_ACT.light, spot(crack, 'brazier.0'));
    expect(run.host.flags.has(brazierFlag(0))).toBe(true);
  } finally { run.host.dispose(); }
});

it('restores the transient well / oil / waymark state mid-quest and continues exactly', () => {
  const original = boot(), { interact, crack } = signalSpots(); let restored: Run | undefined;
  try {
    for (let tick = 0; tick < 2; tick++) original.host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    original.host.flags.set(SCOUT_FLAG);
    act(original, SIGNAL_ACT.logbook, spot(interact, 'logbook'));
    act(original, SIGNAL_ACT.crank, spot(crack, 'well.crank')); // raised but not yet taken: transient continuation
    const saved = serializeSimSnapshot(snapshotSimHost(original.host));
    expect(snapshotSimHost(original.host).adapters.find(a => a.id === INTERACTIONS_STEP)?.state).toContain('"raised":true');
    restored = restore(saved);
    expectSameSimSnapshot(snapshotSimHost(restored.host), decodeSimSnapshot(saved));
    for (const run of [original, restored]) {
      act(run, SIGNAL_ACT.well, spot(interact, 'well'));
      act(run, SIGNAL_ACT.pour, spot(interact, 'brazier.0'));
      for (let tick = 0; tick < 60; tick++) run.host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    }
    expect(restored.host.flags.has(FLAG.oil)).toBe(true);
    expectSameSimSnapshot(snapshotSimHost(restored.host), snapshotSimHost(original.host));
    expect(original.effects).toEqual([]); expect(restored.effects).toEqual([]);
  } finally { restored?.host.dispose(); original.host.dispose(); }
});
