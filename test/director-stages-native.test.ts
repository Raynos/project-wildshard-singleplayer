import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { DirectorStageLane } from '../src/game/plugin/director';
import { Director } from '../src/sdk/director';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { expectSameSimSnapshot } from './fake/simSnapshot';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });

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
