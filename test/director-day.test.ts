import { beforeAll, expect, it } from 'vitest';
import { directorDayRange, parseDirectorStages } from '@wildshard/format/directorStages';
import { emptyShardfile } from '../src/sdk/author';
import { createShardfileSim, bindShardfileSim } from '../src/game/plugin/simulation';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { createSimHost } from '../src/engine/sim';
import { normalizedDayClock } from '../src/engine/world/dayCycle';
import { dataLookClock } from '../src/engine/render/dataLook';
import { dayDirectorExample } from '../scripts/docs/authoring/directors';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { expectSameSimSnapshot } from './fake/simSnapshot';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
const day = { minutes: 1, start: 0.749, maxElevation: 60, azimuth: 35 };
const source = () => {
  const base = emptyShardfile({ slug: 'outpost', name: 'Outpost', author: 'Day proof', revision: 1, seed: 1 });
  return { ...base, look: { ...base.look, day }, quests: { ...base.quests, flags: ['outpost.beacon-ready'] }, directors: [dayDirectorExample()] };
};

it('admits bounded half-open day ranges while keeping the when-language boolean', () => {
  const example = dayDirectorExample();
  expect(directorDayRange('day:0.75..0.84')).toEqual([0.75, 0.84]);
  expect(directorDayRange('flag:outpost.ready')).toBeNull();
  for (const binding of ['day:0.84..0.75', 'day:0.75..0.75', 'day:-0.1..0.5', 'day:0..1.1', 'day:NaN..1']) {
    expect(() => parseDirectorStages({ ...example, inputs: { dusk: binding } })).toThrow();
  }
  expect(() => parseDirectorStages({ ...example, stages: [{ id: 'waiting' }, { id: 'lit', when: 'dusk > 0.75' }] })).toThrow();
});

it('uses the exact rendered clock recipe, observes dusk and restores a native suffix without repeated actions', () => {
  const shard = source(), sim = createShardfileSim(shard, new Map(), { rapier });
  const rendered = dataLookClock(day, null);
  let restored: ReturnType<typeof restoreSimHost> | undefined;
  try {
    for (let i = 0; i < 2; i++) { sim.host.step(); rendered.update(1 / 60); }
    expect(sim.host.flags.has('outpost.beacon-ready')).toBe(false);
    expect(sim.host.dayClockState()).toEqual(rendered.snapshot());
    const saved = snapshotSimHost(sim.host);
    restored = restoreSimHost(sim.host.level, { rapier }, saved, host => {
      bindShardfileSim(host, shard, new Map(), { rapier, restoring: true });
    });
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    for (let i = 0; i < 240; i++) { sim.host.step(); restored.step(); rendered.update(1 / 60); }
    expect(sim.host.flags.has('outpost.beacon-ready')).toBe(true);
    expect(sim.host.dayClockState()).toEqual(rendered.snapshot());
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
    const frozen = createShardfileSim({ ...shard, look: { ...shard.look, dayOverride: 0.84 } }, new Map(), { rapier });
    try {
      for (let i = 0; i < 10; i++) frozen.host.step();
      expect(frozen.host.flags.has('outpost.beacon-ready')).toBe(false);
      expect(frozen.host.dayClockState()?.paused).toBe(true);
    } finally { frozen.dispose(); }
  } finally { restored?.dispose(); sim.dispose(); }
});

it('borrows the actual page clock without stepping it and restores its saved pause, rate and time', () => {
  const page = createSimHost(SIM_LEVEL, { rapier }), clock = normalizedDayClock(day, null);
  let drive: () => void = () => { throw new Error('Missing client driver'); };
  const sim = createShardfileSim(source(), new Map(), { rapier, physics: page.physics, player: page.player,
    events: page.events, clock: page.clock, combat: page.combat,
    lookClock: () => clock, fixedStep: run => { drive = run; return () => undefined; },
  });
  try {
    drive(); drive();
    expect(clock.snapshot().value).toBe(day.start * 24);
    expect(sim.host.flags.has('outpost.beacon-ready')).toBe(false);
    clock.phase = 0.76; drive();
    expect(sim.host.flags.has('outpost.beacon-ready')).toBe(true);
    clock.scale = 0.5; clock.paused = true;
    const adapter = sim.host.adapters.get('director.day');
    if (adapter === undefined) throw new Error('Missing borrowed day continuation');
    const saved = adapter.snapshot();
    clock.phase = 0.1; clock.scale = 2; clock.paused = false;
    adapter.restore(saved);
    expect(JSON.stringify(clock.snapshot())).toBe(saved); expect(clock.scale).toBe(0.5); expect(clock.paused).toBe(true);
    expect(() => adapter.restore('{"value":null}')).toThrow();
  } finally { sim.dispose(); page.dispose(); }
});
