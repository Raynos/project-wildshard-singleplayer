import { inventorySave } from '#game/saves';
import { saveFixture, readFixture } from './fake/saveFixture';
// src/game/Inventory.ts — what a carcass yields, and the per-shard pack.
import { describe, expect, it, vi } from 'vitest';
import { loadSpecies } from './species';
import { ITEMS, Inventory, PACK_SLOTS, harvestOf, type ItemId } from '#game/Inventory';
import { PINE_PACK_SLOTS } from '#shards/pine-hollow/items';
import { speciesDef } from '#engine-internal/entities/species/registry';

const PINE = 'chunk://local/pine-hollow';
const DRIFT = 'chunk://local/driftwood-isle';
const ALL_ITEMS = Object.keys(ITEMS) as ItemId[];
loadSpecies();

describe('harvestOf', () => {
  it('deer: hinds give meat + hide, anything with a rack adds antlers', () => {
    expect(harvestOf('deer', 'hind')).toEqual(['venison', 'deer-hide']);
    expect(harvestOf('deer', 'white-hind')).toEqual(['venison', 'deer-hide']);
    expect(harvestOf('deer', 'piebald')).toEqual(['venison', 'deer-hide']);
    for (const stag of ['stag', 'white-stag', 'big-stag', 'ghost']) expect(harvestOf('deer', stag)).toEqual(['venison', 'deer-hide', 'antlers']);
  });

  it('deer with no variant is treated as a hind', () => {
    expect(harvestOf('deer')).toEqual(['venison', 'deer-hide']);
  });

  it('boar: every boar has tusks except the sow', () => {
    expect(harvestOf('boar', 'sow')).toEqual(['boar-meat', 'boar-hide']);
    for (const v of ['boar', 'black', 'big', 'scarback', 'ironhide', undefined]) expect(harvestOf('boar', v)).toEqual(['boar-meat', 'boar-hide', 'boar-tusk']);
  });

  it('elk: bulls (and the imperial) carry antlers, cows and the pale elk do not', () => {
    for (const v of ['bull', 'big-bull', 'imperial']) expect(harvestOf('elk', v)).toEqual(['elk-meat', 'elk-hide', 'antlers']);
    for (const v of ['cow', 'pale']) expect(harvestOf('elk', v)).toEqual(['elk-meat', 'elk-hide']);
  });

  it('bear: pelt + claw for every variant', () => {
    for (const v of ['black', 'brown', 'black-old', 'brown-old']) expect(harvestOf('bear', v)).toEqual(['bear-pelt', 'bear-claw']);
  });

  it('crab: meat + claw, the big reef crab adds its shell', () => {
    expect(harvestOf('crab', 'small')).toEqual(['crab-meat', 'crab-claw']);
    expect(harvestOf('crab', 'big')).toEqual(['crab-meat', 'crab-claw', 'crab-shell']);
    expect(harvestOf('crab')).toEqual(['crab-meat', 'crab-claw']);
  });

  it('monkey: a coconut + fur, the grey elder\'s fur is silver', () => {
    expect(harvestOf('monkey', 'monkey')).toEqual(['coconut', 'monkey-fur']);
    expect(harvestOf('monkey', 'elder')).toEqual(['coconut', 'silver-fur']);
    expect(harvestOf('monkey')).toEqual(['coconut', 'monkey-fur']);
  });

  it('the drowned (sailor / captain) are not harvested: they fade, nothing to take (E318 row 17 — no [E] Harvest on them)', () => {
    expect(harvestOf('sailor', 'sailor')).toEqual([]);
    expect(harvestOf('captain')).toEqual([]);
  });

  it('the Driftwood Isle game (crab / monkey): every variant yields at least one item', () => {
    for (const kind of ['crab', 'monkey']) {
      for (const v of speciesDef(kind).variants) expect(harvestOf(kind, v.id).length, `${kind}/${v.id}`).toBeGreaterThan(0);
    }
  });

  it('an unknown kind yields nothing', () => {
    expect(harvestOf('unicorn', 'sparkly')).toEqual([]);
  });

  it('the Pine Hollow game (deer / boar / elk / bear): every variant yields at least one item', () => {
    for (const kind of ['deer', 'boar', 'elk', 'bear']) {
      for (const v of speciesDef(kind).variants) expect(harvestOf(kind, v.id).length, `${kind}/${v.id}`).toBeGreaterThan(0);
    }
  });

  it('every registered variant yields only real, distinct items', () => {
    for (const kind of ['deer', 'boar', 'elk', 'bear', 'crab', 'monkey']) {
      for (const v of speciesDef(kind).variants) {
        const got = harvestOf(kind, v.id);
        for (const id of got) expect(ITEMS, `${kind}/${v.id} → ${id}`).toHaveProperty(id);
        expect(new Set(got).size).toBe(got.length);
      }
    }
  });
});

describe('ITEMS', () => {
  it('every item has a label and an icon', () => {
    for (const id of ALL_ITEMS) { expect(ITEMS[id].label.length).toBeGreaterThan(0); expect(ITEMS[id].icon.length).toBeGreaterThan(0); }
  });
});

describe('Inventory', () => {
  it('starts empty', () => {
    const inv = new Inventory(PINE);
    expect(inv.items).toEqual([]);
    expect(inv.total).toBe(0);
  });

  it('stacks by kind, keeps first-picked-up order, and totals', () => {
    const inv = new Inventory(PINE);
    inv.add('venison');
    inv.add('deer-hide', 2);
    inv.add('venison', 3);
    expect(inv.items.map((i) => [i.id, i.count])).toEqual([['venison', 4], ['deer-hide', 2]]);
    expect(inv.items[0]).toMatchObject({ label: 'Venison', icon: 'meat' });
    expect(inv.total).toBe(6);
  });

  it('fires onChange on every add', () => {
    const inv = new Inventory(DRIFT);
    const fn = vi.fn<() => void>();
    inv.onChange = fn;
    inv.add('antlers'); inv.add('antlers');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('ignores ids that are not items', () => {
    const inv = new Inventory(PINE);
    const fn = vi.fn<() => void>();
    inv.onChange = fn;
    inv.add(JSON.parse('"dragon-scale"') as ItemId); // e.g. an id from an older build's save
    expect(inv.items).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('holds one slot per kind, at most its shard\'s slots', () => {
    const inv = new Inventory(DRIFT);
    for (const id of ALL_ITEMS) inv.add(id);
    expect(inv.slots).toBe(PACK_SLOTS);
    expect(inv.items.length).toBe(Math.min(ALL_ITEMS.length, PACK_SLOTS));
    expect(new Inventory(PINE).slots).toBe(PINE_PACK_SLOTS);
    // once full, a kind already in the pack still stacks
    const first = inv.items[0];
    if (first === undefined) throw new Error('pack is empty');
    inv.add(first.id, 5);
    expect(inv.items[0]?.count).toBe(6);
  });

  it('persists per shard and reloads in the same order', () => {
    const a = new Inventory(PINE);
    a.add('boar-tusk', 2); a.add('venison');
    const b = new Inventory(DRIFT);
    b.add('bear-pelt');
    const again = new Inventory(PINE);
    expect(again.items.map((i) => [i.id, i.count])).toEqual([['boar-tusk', 2], ['venison', 1]]);
    expect(new Inventory(DRIFT).items.map((i) => i.id)).toEqual(['bear-pelt']);
    expect(readFixture('pine-hollow', 'inventory')).toMatchObject({ order: ['boar-tusk', 'venison'] });
  });

  it('drops unknown ids from a saved pack (an item removed from the game)', () => {
    saveFixture(PINE.replace(/^chunk:\/\/local\//u, ''), 'inventory', { counts: { venison: 2, 'old-thing': 9 }, order: ['old-thing', 'venison'] });
    const inv = new Inventory(PINE);
    expect(inv.items.map((i) => [i.id, i.count])).toEqual([['venison', 2]]);
    expect(inv.total).toBe(2);
  });

  it('survives corrupt storage (starts empty)', () => {
    localStorage.setItem('wildshard.save.v2.pine-hollow', '{not json');
    const inv = new Inventory(PINE);
    expect(inv.items).toEqual([]);
    inv.add('venison');
    expect(inv.total).toBe(1);
  });

  it('keeps working in memory when storage throws on write (iOS private mode)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const inv = new Inventory(PINE);
    inv.add('bear-pelt', 2);
    expect(inv.total).toBe(2);
    vi.restoreAllMocks();
    inventorySave.reset('pine-hollow');
  });

  it('takes items out for a trade, all or nothing, freeing the slot at 0', () => {
    const inv = new Inventory(PINE);
    inv.add('amber-resin', 5); inv.add('deer-hide', 2);
    expect(inv.take('amber-resin', 6)).toBe(false);
    expect(inv.count('amber-resin')).toBe(5);
    expect(inv.take('amber-resin', 3)).toBe(true);
    expect(inv.count('amber-resin')).toBe(2);
    expect(inv.take('deer-hide', 2)).toBe(true);
    expect(inv.items.map((i) => i.id)).toEqual(['amber-resin']);
  });
});
