import { expect, test } from 'vitest';
import { NativeInventory } from '../src/game/inventoryLaw';
import { ItemCatalogue } from '../src/game/plugin/nativeItems';
import PINE from '../src/shards/pine-hollow/data/items.generated.json' with { type: 'json' };
import DRIFTWOOD from '../src/shards/driftwood-isle/data/items.generated.json' with { type: 'json' };

const DRIFTWOOD_NATIVE_PACK = new ItemCatalogue(DRIFTWOOD).inventory;
const createPinePack = () => new NativeInventory(new ItemCatalogue(PINE).inventory);

test('both native quest packs load old inventories and continue stacking/trading', () => {
  const drift = new NativeInventory<string>(DRIFTWOOD_NATIVE_PACK); drift.restore({ counts: { doubloon: 4, coconut: 2 }, order: ['coconut', 'doubloon'] });
  expect(drift.count('doubloon')).toBe(4); expect(drift.add('doubloon', 2)).toBe(true);
  expect(drift.snapshot()).toEqual({ counts: { coconut: 2, doubloon: 6 }, order: ['coconut', 'doubloon'] });
  const pine = createPinePack(); pine.restore({ counts: { venison: 2.5, 'deer-hide': -1 }, order: ['deer-hide', 'venison'] });
  expect(pine.count('deer-hide')).toBe(-1); expect(pine.take('venison', 1)).toBe(true); expect(pine.add('venison', 2)).toBe(true);
  expect(pine.snapshot()).toEqual({ counts: { venison: 3.5, 'deer-hide': -1 }, order: ['deer-hide', 'venison'] });
  const missing = createPinePack(); missing.restore({ counts: {}, order: ['venison'] }); expect(missing.count('venison')).toBe(0);
});
test('native inventory refuses corrupt rosters, duplicate order and original bounds', () => {
  const drift = new NativeInventory<string>(DRIFTWOOD_NATIVE_PACK);
  for (const state of [{ counts: { doubloon: 0 }, order: ['doubloon'] }, { counts: {}, order: ['doubloon'] },
    { counts: { unknown: 1 }, order: ['unknown'] }, { counts: { doubloon: 1 }, order: ['doubloon', 'doubloon'] }]) expect(() => drift.restore(state)).toThrow();
  expect(() => drift.add('doubloon', 0.5)).toThrow();
  drift.restore({ counts: { doubloon: Number.MAX_SAFE_INTEGER }, order: ['doubloon'] }); expect(() => drift.add('doubloon', 1)).toThrow();
  const pine = createPinePack(); expect(() => pine.restore({ counts: { venison: 1_000_001 }, order: ['venison'] })).toThrow();
  expect(() => pine.restore({ counts: { venison: 1 }, order: [] })).toThrow();
  expect(() => pine.restore({ counts: { unknown: 1 }, order: ['unknown'] })).toThrow();
});

test('admitted item policies keep both exact native save laws and refuse malformed policy data', () => {
  const pine = new ItemCatalogue(PINE).inventory, drift = new ItemCatalogue(DRIFTWOOD).inventory;
  expect(pine).toEqual({ kinds: ['venison', 'deer-hide', 'boar-hide', 'boar-tusk', 'bear-pelt', 'amber-resin', 'lodge-ribbon'], slots: 7,
    counts: { min: -1_000_000, max: 1_000_000, integer: false, complete: false }, quantity: 'unchecked', snapshot: 'roster', restoreError: 'Incompatible Pine pack continuation' });
  expect(drift).toEqual({ kinds: ['crab-meat', 'crab-claw', 'crab-shell', 'coconut', 'monkey-fur', 'silver-fur', 'doubloon'], slots: 12,
    counts: { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true, complete: true }, quantity: 'positive-safe-integer', snapshot: 'order',
    stackLimit: Number.MAX_SAFE_INTEGER, restoreError: 'Incompatible Driftwood pack continuation' });
  for (const inventory of [{ ...pine, kinds: [] }, { ...pine, kinds: ['a', 'a'] }, { ...pine, slots: 0 }, { ...pine, slots: 257 },
    { ...pine, counts: { ...pine.counts, min: 2, max: 1 } }, { ...pine, quantity: () => true }]) {
    expect(() => new ItemCatalogue({ ...PINE, loadout: { ...PINE.loadout, inventory } }).inventory).toThrow();
  }
  expect(() => new ItemCatalogue({ ...PINE, loadout: { primary: PINE.loadout.primary, secondary: PINE.loadout.secondary, tools: PINE.loadout.tools } }).inventory).toThrow('Missing declared inventory policy');
});
