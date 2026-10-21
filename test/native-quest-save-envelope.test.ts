// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual native physics and retained save fixture.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { createSimHost, type SimValue } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { prepareNativeQuestEntry } from '../src/game/quest/nativeEntry';
import { registerNativeQuestInputs } from '../src/game/quest/nativeInputs';
import pine from '../src/shards/pine-hollow/generators/product';
import driftwood from '../src/shards/driftwood-isle/generators/product';
import story from '../src/shards/pine-hollow/data/nativeStory.json';
import legacy from './fixtures/quest-step-legacy-saves.json';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const Value: v.GenericSchema<unknown, SimValue> = v.lazy(() => v.union([
  v.null(), v.boolean(), v.pipe(v.number(), v.finite()), v.string(), v.array(Value), v.record(v.string(), Value),
]));

test('native entry decodes the original Pine envelope and re-encodes every save byte in its original order', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
  try {
    registerNativeQuestInputs(host, { scripts: () => [], walk: () => ({ x: 0, z: 0 }), ledger: { fact: () => undefined, coins: () => undefined } });
    const entry = prepareNativeQuestEntry(host, pine, { rows: [], external: [] }, [], {}, story.savedNames);
    const saved = entry.saved.decode(legacy['pine-hollow'].state);
    expect(saved['lead']).toEqual(legacy['pine-hollow'].state.stag);
    expect(saved['clock']).toBe(legacy['pine-hollow'].state.dawn);
    expect(saved['cable']).toBeNull(); expect(saved['pickup']).toBe(false);
    const { stag, ...withoutStag } = legacy['pine-hollow'].state;
    expect(() => entry.saved.decode({ ...withoutStag, lead: stag })).toThrow('Non-canonical native saved key');
    expect(() => entry.saved.decode({ ...legacy['pine-hollow'].state, lead: stag })).toThrow('Non-canonical native saved key');
    expect(saved['board']).toEqual(legacy['pine-hollow'].state.lodge);
    expect(JSON.stringify(entry.saved.encode(v.parse(v.record(v.string(), Value), saved)))).toBe(legacy['pine-hollow'].bytes);
    // Optional fields use the same envelope; absent keys remain absent. Native
    // services, rather than this transport, still validate their own contents.
    const extended = { ...saved, lead: { i: 2, mode: 'trot', t: 0.8 }, cable: { s: 0.4, v: 3 },
      rewardOwned: true, trader: { modal: { version: 1, open: false }, skins: ['hollow-ash'] }, ammunition: { changed: false } };
    const wire = entry.saved.encode(v.parse(v.record(v.string(), Value), extended));
    expect(entry.saved.decode(wire)).toEqual(extended);
    expect(Object.keys(wire)).toContain('hollowAsh'); expect(Object.keys(wire)).not.toContain('rewardOwned');
    const other = createSimHost({ ...SIM_LEVEL, entities: [], quests: [] }, { rapier });
    try {
      registerNativeQuestInputs(other, { scripts: () => [], walk: () => ({ x: 0, z: 0 }), ledger: { fact: () => undefined, coins: () => undefined } });
      const direct = prepareNativeQuestEntry(other, driftwood, { rows: [], external: [] }, []).saved;
      expect(JSON.stringify(direct.encode(v.parse(v.record(v.string(), Value), direct.decode(legacy['driftwood-isle'].state))))).toBe(legacy['driftwood-isle'].bytes);
    } finally { other.dispose(); }
    expect(() => entry.saved.decode(null)).toThrow();
    expect(() => entry.saved.decode([])).toThrow();
  } finally { host.dispose(); }
});
