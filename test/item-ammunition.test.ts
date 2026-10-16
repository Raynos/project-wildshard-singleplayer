import { expect, test } from 'vitest';
import { readItemAmmunition } from '../src/game/plugin/nativeItems';
import { parseItems } from '../src/format/items';
import { wetProjectile } from '../src/shards/pine-hollow/world/weatherProfile';
import PINE_ITEMS from '../src/shards/pine-hollow/data/items.generated.json' with { type: 'json' };
import { boltFlight } from './fixtures/weapon-oracle/headlessCrossbow';

test('page ammunition keeps shipping labels, wet multipliers and every native flight/target coefficient', () => {
  const ammunition = readItemAmmunition(PINE_ITEMS, 'weapon.crossbow');
  expect([...ammunition.keys()]).toEqual(['iron', 'pitch', 'broadhead']);
  for (const [kind, label, name, gravity, drag, wet] of [
    ['iron', 'Bolts', 'Iron bolts', 1, 1, { gravity: 1.2, drag: 1.9 }],
    ['pitch', 'Pitch bolts', 'Pitch-tipped bolts', 0.8, 0.7, undefined],
    ['broadhead', 'Broadheads', 'Broadhead bolts', 1.08, 1.1, { gravity: 1.2, drag: 1.9 }],
  ] as const) {
    const ammo = ammunition.get(kind);
    if (ammo === undefined) throw new Error('Missing fixture ammunition');
    expect(ammo.row).toEqual({ id: `ammo.${kind}`, label, name, flight: { gravity, drag }, tags: [`ammo.${kind}`], pouchMax: 30, ...(wet === undefined ? {} : { wet }) });
    expect(ammo.damage).toEqual({ default: 1, kinds: kind === 'broadhead' ? { deer: 1.4, boar: 1.4 } : {} });
    for (let step = -1; step <= 101; step++) {
      const actual = wetProjectile({ ammo: ammo.row, gravity, drag }, step / 100);
      const original = boltFlight(kind, step / 100);
      expect([actual.gravity, actual.drag]).toEqual([original.gravity, original.drag]);
    }
  }
});

test('ammunition refuses missing rows, presentation, callbacks and invalid bounds', () => {
  expect(() => readItemAmmunition(PINE_ITEMS, 'weapon.missing')).toThrow('Missing declared ammunition');
  const source = parseItems(PINE_ITEMS), original = source.rows[0];
  if (original?.kind !== 'weapon' || original.ranged === undefined) throw new Error('Missing ranged fixture');
  const missing = structuredClone(source);
  for (const item of missing.rows) if (item.kind === 'weapon' && item.ranged !== undefined) for (const ammo of item.ranged.ammunition) Reflect.deleteProperty(ammo, 'presentation');
  expect(() => readItemAmmunition(missing, original.id)).toThrow('Missing declared ammunition presentation');
  for (const presentation of [{ label: 'Bolts', name: 'Iron bolts', pouchMax: -1 }, { label: () => 'Bolts', name: 'Iron bolts', pouchMax: 30 }]) {
    const ranged = { ...original.ranged, ammunition: original.ranged.ammunition.map(ammo => ({ ...ammo, presentation })) };
    expect(() => readItemAmmunition({ ...source, rows: [{ ...original, ranged }, ...source.rows.slice(1)] }, original.id)).toThrow();
  }
});
