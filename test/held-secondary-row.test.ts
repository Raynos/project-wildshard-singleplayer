// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real native owner with shipped physics bytes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { itemRules, parseItems } from '../src/format/items';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { installNativeMelee, type NativeMeleeCommand } from '../src/game/plugin/simulation';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { SKY_ITEMS } from '../src/shards/far-reach/generators/rows/items';

test('direct secondaries require a secondary contact and no scripted hook', () => {
  const items = parseItems(SKY_ITEMS), item = items.rows[0];
  if (item?.kind !== 'weapon' || item.secondary === undefined) throw new Error('Missing fan secondary');
  expect(item.hook).toBeNull(); expect(item.secondary.code).toBeUndefined();
  expect(itemRules({ ...items, rows: [{ ...item, secondary: { ...item.secondary, move: 0 } }] })).not.toEqual([]);
  expect(itemRules({ ...items, rows: [{ ...item, secondary: { ...item.secondary, code: 3 } }] })).not.toEqual([]);
  const hooked = { ...item, hook: { module: 'a'.repeat(64), entity: 6001, event: 301 } };
  expect(itemRules({ ...items, rows: [hooked] })).not.toEqual([]);
  expect(itemRules({ ...items, rows: [{ ...hooked, secondary: { ...item.secondary, code: 3 } }] })).toEqual([]);
});

test('native direct gust keeps its independent clock, landing order and restore', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const host = createSimHost({ ...SIM_LEVEL, entities: [] }, { rapier });
  const item = parseItems(SKY_ITEMS).rows[0];
  if (item?.kind !== 'weapon' || item.native === undefined) throw new Error('Missing fan native row');
  let commands: readonly NativeMeleeCommand[] = [], enabled = true;
  const landed: number[] = [];
  const native = { ...item.native }; delete native.input; delete native.held;
  try {
    const melee = installNativeMelee(host, item, native, { commands: () => commands, enabled: () => enabled,
      landed: action => { landed.push(action); } });
    commands = [{ kind: 'move', action: 2 }, { kind: 'move', action: 2 }, { kind: 'move', action: 1 }];
    host.step();
    expect(landed).toEqual([2, 1]);
    expect(melee.family.secondaryCooldown).toBe(1.6); expect(melee.family.cooldown).toBe(0.85);
    const continuation = host.adapters.get(native.step);
    if (continuation === undefined) throw new Error('Missing melee continuation');
    const saved = continuation.snapshot();
    enabled = false; host.step(); expect(landed).toEqual([2, 1]);
    continuation.restore(saved); expect(melee.family.secondaryCooldown).toBe(1.6);
    enabled = true; commands = []; for (let tick = 0; tick < 97; tick++) host.step();
    commands = [{ kind: 'move', action: 2 }]; host.step();
    expect(landed).toEqual([2, 1, 2]);
  } finally { host.dispose(); }
});
