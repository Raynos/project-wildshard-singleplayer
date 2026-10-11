import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { DirectorStageLane } from '../src/game/plugin/director';
import { Director } from '../src/sdk/director';
import { emptyShardfile } from '../src/sdk/author';
import { createShardfileSim } from '../src/game/plugin/simulation';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { expectSameSimSnapshot } from './fake/simSnapshot';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });

it('binds root flag rows to declared native quest ownership and refuses unsupported observations or actions', () => {
  const base = emptyShardfile({ slug: 'fixture', name: 'Fixture', author: 'Native proof', revision: 1, seed: 357 });
  const rows = new Director({ id: 'fixture.root', inputs: { opened: 'flag:fixture.open' }, stages: [
    { id: 'closed' }, { id: 'open', when: 'opened', do: [{ flag: { key: 'fixture.done', value: true } }] },
  ] }).toJSON();
  const source = { ...base, quests: { ...base.quests, flags: ['fixture.open', 'fixture.done'] }, directors: [rows] };
  const sim = createShardfileSim(source, new Map(), { rapier });
  try {
    sim.host.step(); expect(sim.host.flags.has('fixture.done')).toBe(false);
    sim.host.flags.set('fixture.open'); sim.host.step(); expect(sim.host.flags.has('fixture.done')).toBe(true);
  } finally { sim.dispose(); }
  expect(() => createShardfileSim({ ...source, quests: { ...source.quests, flags: [] } }, new Map(), { rapier })).toThrow('no declared native owner');
  expect(() => createShardfileSim({ ...source, directors: [{ ...rows, inputs: { opened: 'actor:missing.dead' } }] }, new Map(), { rapier })).toThrow('require native bindings');
  expect(() => createShardfileSim({ ...source, directors: [{ ...rows, stages: [{ id: 'closed', do: [{ spawn: 'missing' }] }] }] }, new Map(), { rapier })).toThrow('require native bindings');
});

it('hosts stage rows on the actual fixed-step SimHost and restores a native checkpoint with exact effects and replay hash', () => {
  const level = { ...SIM_LEVEL, entities: [], quests: [] }, declaration = new Director({
    id: 'fixture.door-wave', inputs: { doorOpen: 'flag:fixture.door-open', waveDead: 'flag:fixture.wave-dead' }, stages: [
      { id: 'closed' }, { id: 'wave', when: 'doorOpen', do: [{ flag: { key: 'fixture.wave-started', value: true } }] },
      { id: 'won', when: 'waveDead', do: [{ flag: { key: 'fixture.reward', value: true } }] },
    ],
  }).toJSON();
  const install = (host: SimHost): void => {
    const lane = new DirectorStageLane(declaration);
    host.onStep('fixture.director', (_dt, native) => {
      for (const action of lane.step(native.state.tick, { doorOpen: native.flags.has('fixture.door-open'), waveDead: native.flags.has('fixture.wave-dead') })) {
        if ('flag' in action) native.flags.set(action.flag.key, action.flag.value);
        else throw new Error('Fixture action has no native owner');
      }
    }, { snapshot: () => lane.snapshot(), restore: state => {
      if (typeof state !== 'string') throw new Error('Malformed director continuation'); lane.restore(state);
    } });
  };
  const host = createSimHost(level, { rapier }); let restored: SimHost | undefined;
  try {
    install(host); host.step(); host.flags.set('fixture.door-open'); host.step();
    expect(host.flags.has('fixture.wave-started')).toBe(true);
    const saved = snapshotSimHost(host); restored = restoreSimHost(level, { rapier }, saved, install);
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    const suffix = (native: SimHost): string => {
      const tape: string[] = [];
      for (let i = 0; i < 60; i++) {
        if (i === 10) native.flags.set('fixture.wave-dead');
        native.step(); tape.push(JSON.stringify({ flags: native.flags.all, adapters: snapshotSimHost(native).adapters }));
      }
      return hashImmutableBytes(new TextEncoder().encode(JSON.stringify(tape)));
    };
    expect(suffix(restored)).toBe(suffix(host)); expect(host.flags.has('fixture.reward')).toBe(true);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
  } finally { restored?.dispose(); host.dispose(); }
});
