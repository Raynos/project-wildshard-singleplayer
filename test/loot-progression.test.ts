import { expect, test } from 'vitest';
import { parseRows } from '../src/format/rows';
import { parseLootEconomy } from '../src/format/lootEconomy';
import { curveAt } from '../src/format/materials';
import { declaredLootEconomy } from '../src/game/shard/declaredRows';
import { Owned } from '../src/game/loot/Owned';
import { Purse } from '../src/game/loot/Purse';
import { Flags } from '../src/engine/world/interact/flags';
import { Scope } from '../src/engine/app/scope';
import { driftwoodLootPresentation } from '../src/shards/driftwood-isle/loot/presentation';
import LOOT from '../src/shards/driftwood-isle/data/loot.generated.json' with { type: 'json' };
import CONTENT from '../src/shards/driftwood-isle/data/keepsakes.json' with { type: 'json' };

const source = () => parseRows({ strikes: [], weather: [], days: [], species: [], looks: [], compendiums: [], loot: [LOOT] }).loot;
const economy = declaredLootEconomy(source());
const charms = ['charm-1', 'charm-2', 'charm-3'] as const;

test('all finite reward states retain original thresholds, notices, grant order and real save resume', () => {
  expect(economy.progression.flags).toEqual(Array.from({ length: 15 }, (_, i) => `glass:${i + 1}`));
  expect(economy.progression.states).toHaveLength(16);
  for (let found = 0; found <= 15; found++) for (let saved = 0; saved < 8; saved++) {
    localStorage.clear();
    const old = charms.slice(0, Math.max(0, Math.min(3, Math.floor(found / 5))));
    const state = economy.progression.states[found]; if (state === undefined) throw new Error('Missing state');
    expect(state.earned).toEqual(old.map(id => ({ id, text: CONTENT.charms.toast[id] })));
    expect(state.displayCount).toBe(Math.max(0, Math.floor(found / 5) * 5));
    expect(state.next).toBe((Math.floor(found / 5) + 1) * 5 > 15 ? null : (Math.floor(found / 5) + 1) * 5);
    const owned = new Owned('driftwood-isle');
    charms.forEach((id, i) => { if ((saved & (1 << i)) !== 0) owned.grant(id); });
    const resumed = new Owned('driftwood-isle'), events: string[] = [];
    resumed.onChange(() => { events.push(resumed.all[resumed.all.length - 1] ?? 'missing'); });
    for (const reward of state.earned) resumed.grant(reward.id);
    expect(events).toEqual(old.filter(id => (saved & (1 << charms.indexOf(id))) === 0));
    expect(new Owned('driftwood-isle').all).toEqual(resumed.all);
    for (const reward of state.earned) resumed.grant(reward.id);
    expect(events).toHaveLength(old.filter(id => (saved & (1 << charms.indexOf(id))) === 0).length);
  }
});

test('the existing curve is exactly the original glow at every sampled night value', () => {
  expect(economy.progression.glow.owned).toBe('charm-3');
  for (let i = -100; i <= 1200; i++) {
    const night = i / 1000, t = Math.max(0, Math.min(1, (night - 0.3) / 0.45));
    expect(curveAt(economy.progression.glow.curve, night)).toBe(t * t * (3 - 2 * t));
  }
});

test('gear reads only the declared beach flags and observes live progress without a new counter owner', async () => {
  const flags = new Flags('driftwood-isle', false), scope = new Scope('loot-progression'), owned = new Owned('driftwood-isle');
  try {
    const view = await driftwoodLootPresentation({ economy, adventure: { flags, trader: null }, owned,
      health: { attributes: { maxHealth: 100 } }, audio: { voices: { play: () => undefined } }, scope, toast: () => undefined, hold: () => undefined });
    const purse = new Purse('driftwood-isle');
    for (let found = 0; found <= 15; found++) {
      flags.restore([...economy.progression.flags.slice(0, found), 'glass:999', 'pack:seaglass']);
      expect(view.gear(purse).charms?.next).toBe(found >= 15 ? null : (Math.floor(found / 5) + 1) * 5);
    }
  } finally { scope.dispose(); }
});

test('missing, sparse, duplicate or unknown reward states refuse before ownership is changed', () => {
  for (const progression of [
    { ...economy.progression, states: [] },
    { ...economy.progression, states: economy.progression.states.slice(1) },
    { ...economy.progression, flags: ['glass:1', 'glass:1'] },
    { ...economy.progression, states: economy.progression.states.map(state => ({ displayCount: state.displayCount, next: state.next, earned: [{ id: 'charm-1', text: '' }, { id: 'charm-1', text: '' }] })) },
  ]) expect(() => parseLootEconomy({ ...LOOT.economy, progression })).toThrow();
  const bad = source(), payload = bad[0]?.economy;
  if (payload === undefined || 'kind' in payload || payload.progression === undefined) throw new Error('Missing fixture');
  payload.progression.glow.owned = 'missing'; expect(() => declaredLootEconomy(bad)).toThrow('Unknown economy ownership');
  delete payload.progression; expect(() => declaredLootEconomy(bad)).toThrow('Missing economy progression');
});
