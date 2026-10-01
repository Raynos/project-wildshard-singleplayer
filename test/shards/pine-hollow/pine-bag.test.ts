import { saveFixture } from '../../fake/saveFixture';
// E314 (Jake's pick C, art/loot/round-3-other-shards/board-1-pine-hollow.jpg): Pine Hollow's Bag — the pack keeps only
// what Mott trades for, nothing he gives goes into it, and the unlocks never ride in a pack slot.
import { describe, expect, it } from 'vitest';
import { loadSpecies } from '../../species';
import { speciesDef } from '#engine/entities/species/registry';
import { Inventory, harvestOf, type ItemId } from '#game/Inventory';
import { PINE_PACK_KINDS, PINE_PACK_SLOTS, isPineItem } from '#shards/pine-hollow/items';
import { Owned } from '#game/loot/Owned';
import { TRADES, ammoOf, mottLine, tradeState } from '#shards/pine-hollow/quest/trades';
import { ELITE_TARGETS, contractFor, draw } from '#shards/pine-hollow/quest/contracts';
import { restoreKept } from '#shards/pine-hollow/loadout/loadout';
import { finishPick, pineFinishes } from '#shards/pine-hollow/loadout/finishes';
import { SkinLocker } from '#game';
import { SKINS, PINE_FINISHES } from '#shards/pine-hollow/loadout/skins';

const PINE = 'chunk://local/pine-hollow';
const DRIFT = 'chunk://local/driftwood-isle';
loadSpecies();

/** what Pine Hollow used to hand out that nothing ever used (the audit's slop) */
const SLOP: ItemId[] = ['boar-meat', 'elk-meat', 'elk-hide', 'bear-claw', 'antlers', 'amber-heartwood',
  'ironhide-tusk', 'ghost-antler', 'blackpaw-claw', 'imperial-crown', 'warden-longbow'];

describe('the drop list', () => {
  it('the pack is exactly the 7 kinds Mott takes', () => {
    const taken = new Set(TRADES.flatMap((t) => t.give.map((g) => g.item)));
    expect([...PINE_PACK_KINDS].sort()).toEqual([...taken].sort());
    expect(PINE_PACK_KINDS.length).toBe(7);
  });

  it('a Pine Hollow carcass yields only pack kinds; the elk yields nothing (no [E] Harvest)', () => {
    const inv = new Inventory(PINE);
    for (const kind of ['deer', 'boar', 'elk', 'bear']) {
      for (const v of speciesDef(kind).variants) for (const id of inv.harvest(kind, v.id)) expect(isPineItem(id), `${kind}/${v.id} → ${id}`).toBe(true);
    }
    expect(inv.harvest('deer', 'stag')).toEqual(['venison', 'deer-hide']);
    expect(inv.harvest('boar', 'boar')).toEqual(['boar-hide', 'boar-tusk']);
    expect(inv.harvest('bear', 'black')).toEqual(['bear-pelt']);
    for (const v of speciesDef('elk').variants) expect(inv.harvest('elk', v.id)).toEqual([]);
  });

  it('the slop never enters a Pine Hollow pack', () => {
    const inv = new Inventory(PINE);
    for (const id of SLOP) expect(inv.add(id), id).toBe(false);
    expect(inv.items).toEqual([]);
  });

  it('an old save\'s slop is dropped on load, the kept kinds stay in order', () => {
    saveFixture(PINE.replace(/^chunk:\/\/local\//u, ''), 'inventory', { counts: { 'boar-meat': 3, venison: 2, antlers: 1, 'amber-resin': 5 }, order: ['boar-meat', 'venison', 'antlers', 'amber-resin'] });
    const inv = new Inventory(PINE);
    expect(inv.items.map((i) => [i.id, i.count])).toEqual([['venison', 2], ['amber-resin', 5]]);
    expect(inv.had('boar-meat')).toBe(true);
    expect(inv.had('bear-pelt')).toBe(false);
  });

  it('other shards keep their harvest as it was', () => {
    const drift = new Inventory(DRIFT);
    for (const [kind, v] of [['boar', 'boar'], ['bear', 'brown'], ['crab', 'big'], ['monkey', 'elder']] as const) expect(drift.harvest(kind, v)).toEqual(harvestOf(kind, v));
    expect(drift.add('boar-meat')).toBe(true);
  });
});

describe('Mott\'s lines on the PACK', () => {
  it('every pack kind says what Mott gives for it', () => {
    for (const id of PINE_PACK_KINDS) expect(mottLine(id), id).not.toBe('Mott has no use for it');
    expect(mottLine('deer-hide')).toBe('Bolts · arrows');
    expect(mottLine('venison')).toBe('Cartridges');
    expect(mottLine('bear-pelt')).toBe('Crossbow finish');
    expect(mottLine('lodge-ribbon')).toBe('Rifle finish');
    expect(mottLine('amber-resin')).toBe('Most trades');
  });
});

describe('a full pack', () => {
  it('can never refuse a kept kind: one slot per kind', () => {
    const inv = new Inventory(PINE);
    for (const id of PINE_PACK_KINDS) expect(inv.add(id, 2)).toBe(true);
    expect(inv.items.length).toBe(PINE_PACK_SLOTS);
    for (const id of PINE_PACK_KINDS) expect(inv.add(id), id).toBe(true);
    expect(inv.count('amber-resin')).toBe(3);
  });

  it('the Longbow survives a full pack: it is kept in Owned, and an old save\'s pack flag moves across', () => {
    // the bug: the King's 'warden-longbow' went into the pack, and a full pack dropped it — the bow was lost for good.
    // An old save that did get it in: the pack drops the flag (not a kept kind), restoreKept moves it to Owned
    const kinds = [...PINE_PACK_KINDS, ...SLOP.filter((id) => id !== 'warden-longbow')];
    const counts = Object.fromEntries([...kinds, 'warden-longbow'].map((id) => [id, 1]));
    saveFixture(PINE.replace(/^chunk:\/\/local\//u, ''), 'inventory', { counts, order: [...kinds, 'warden-longbow'] });
    const owned = new Owned(PINE);
    expect(restoreKept(new Inventory(PINE), owned)).toEqual({ bow: true, rifle: false });
    expect(new Inventory(PINE).items.some((i) => i.id === 'warden-longbow')).toBe(false);
    // …and it stays owned across a reload whatever the pack holds
    expect(restoreKept(new Inventory(PINE), new Owned(PINE))).toEqual({ bow: true, rifle: false });
  });

  it('the King\'s grant never touches the pack: Owned alone keeps the bow and the lever-action', () => {
    const inv = new Inventory(PINE);
    for (const id of PINE_PACK_KINDS) inv.add(id, 9);
    const owned = new Owned(PINE);
    owned.grant('warden-longbow'); owned.grant('lever-rifle');
    expect(restoreKept(new Inventory(PINE), new Owned(PINE))).toEqual({ bow: true, rifle: true });
    expect(new Owned(DRIFT).has('warden-longbow')).toBe(false);
  });

  it('nothing Mott gives goes into the pack (a paid trade never needs a free slot)', () => {
    for (const t of TRADES) expect('bolts' in t.get || 'ammo' in t.get || 'skin' in t.get, t.id).toBe(true);
    expect(TRADES.some((t) => t.id === 'heartwood')).toBe(false);
  });

  it('no contract pays an item Mott has no use for', () => {
    for (let serial = 1; serial <= 200; serial++) for (const r of draw(serial).reward.items) expect(isPineItem(r.id), `#${serial} ${r.id}`).toBe(true);
    for (const id of Object.keys(ELITE_TARGETS)) for (const r of contractFor(1, 'elite', id)?.reward.items ?? []) expect(isPineItem(r.id)).toBe(true);
  });

  it('no trade sells bolts or arrows into a full quiver', () => {
    const rich = { count: () => 99 };
    const bolts = TRADES.find((t) => t.id === 'bolts-hide');
    const arrows = TRADES.find((t) => t.id === 'arrows');
    const ash = TRADES.find((t) => t.id === 'hollow-ash');
    if (!bolts || !arrows || !ash) throw new Error('missing trades');
    expect(ammoOf(bolts)).toEqual({ kind: 'iron', n: 10 });
    expect(tradeState(bolts, rich, () => false, () => false)).toMatchObject({ ok: false, full: true });
    expect(tradeState(bolts, rich, () => false, (k, n) => k === 'iron' && n === 10)).toMatchObject({ ok: true, full: false });
    expect(tradeState(arrows, rich, () => false, (k) => k !== 'arrow').full).toBe(true);
    expect(tradeState(ash, rich, () => false, () => false)).toMatchObject({ ok: true, full: false }); // a finish needs no room
  });
});

describe('GEAR ▸ FINISHES', () => {
  it('lists every crossbow / lever-action finish, the unowned ones locked with where they come from', () => {
    const locker = new SkinLocker('pine-hollow', PINE_FINISHES);
    locker.own('hollow-ash'); locker.wear('crossbow', 'hollow-ash'); locker.own('ghost-stag');
    const rows = pineFinishes(locker);
    expect(rows.map((r) => r.id).sort()).toEqual(Object.keys(SKINS).sort());
    expect(rows.find((r) => r.id === 'hollow-ash')).toMatchObject({ worn: true, locked: false, blurb: 'Crossbow' });
    expect(rows.find((r) => r.id === 'ghost-stag')).toMatchObject({ worn: false, locked: false });
    expect(rows.find((r) => r.id === 'blackpaw')).toMatchObject({ locked: true, blurb: 'Crossbow · Old Blackpaw' });
    expect(rows.find((r) => r.id === 'ironhide')).toMatchObject({ locked: true, icon: 'lever' });
  });

  it('a tap wears an owned finish, takes off the worn one, and does nothing for a locked one', () => {
    const locker = new SkinLocker('pine-hollow', PINE_FINISHES);
    locker.own('hollow-ash'); locker.own('ghost-stag'); locker.wear('crossbow', 'ghost-stag');
    expect(finishPick(locker, 'hollow-ash')?.act).toBe('wear');
    expect(finishPick(locker, 'ghost-stag')?.act).toBe('off');
    expect(finishPick(locker, 'blackpaw')).toBeNull();
    expect(finishPick(locker, 'not-a-finish')).toBeNull();
  });
});
