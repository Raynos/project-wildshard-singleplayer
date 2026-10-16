import { expect, test } from 'vitest';
import { readItemEquipment } from '../src/game/plugin/nativeItems';
import { parseItems } from '../src/format/items';
import PINE_ITEMS from '../src/shards/pine-hollow/data/items.generated.json' with { type: 'json' };
import DRIFTWOOD_SWORDS from '../src/shards/driftwood-isle/data/items.generated.json' with { type: 'json' };
import { CROSSBOW, LEVER, LONGBOW } from '../src/shards/pine-hollow/generators/equipment';
import { SWORD_WOOD, SWORD_IRON } from '../src/game/weapons/starterMeleeProfile';

test('admitted equipment preserves the five shipping rows across canonical product JSON', () => {
  const pine: unknown = structuredClone(PINE_ITEMS);
  for (const original of [CROSSBOW, LEVER, LONGBOW]) {
    const result = readItemEquipment(pine, original.id);
    expect(result).toEqual(original);
    expect(result).not.toBe(original);
  }
  const island: unknown = structuredClone(DRIFTWOOD_SWORDS);
  for (const [id, original] of [['weapon.driftwood-isle.wood', SWORD_WOOD], ['weapon.driftwood-isle.iron', SWORD_IRON]] as const) {
    const { id: equipmentId, legacySlot, ui, meta, cues, hitStop } = original;
    expect(readItemEquipment(island, id)).toEqual({ id: equipmentId, legacySlot, ui, meta, cues, hitStop });
  }
  expect(() => readItemEquipment(pine, 'weapon.missing')).toThrow('Missing declared equipment');
  const without = structuredClone(PINE_ITEMS);
  for (const row of without.rows) Reflect.deleteProperty(row, 'equipment');
  expect(() => readItemEquipment(without, 'weapon.crossbow')).toThrow('Missing declared equipment');
});

test('equipment refuses executable, undeclared and malformed presentation before construction', () => {
  const source = parseItems(PINE_ITEMS), original = readItemEquipment(source, 'weapon.crossbow');
  const mutate = (equipment: unknown): unknown => ({ ...source, rows: source.rows.map(row => row.id === 'weapon.crossbow' ? { ...row, equipment } : row) });
  for (const equipment of [
    { ...original, pickup: { create: () => null } },
    { ...original, ui: { ...original.ui, icon: 'missing' } },
    { ...original, ui: { ...original.ui, ammo: { label: 'Bolts', segments: Infinity } } },
    { ...original, cues: { fire: 'wrong.fire', reload: 'cue.reload', impact: 'cue.impact' } },
    { ...original, rangedFeel: { kick: { body: -1, head: 0, kill: 0, side: 0, killSide: 0 }, trauma: { kill: 0, head: 0, killKinds: [], headKinds: [] } } },
    { ...original, legacySlot: 'unknown' },
  ]) expect(() => readItemEquipment(mutate(equipment), original.id)).toThrow();
  expect(readItemEquipment(source, original.id)).toEqual(original);
});
