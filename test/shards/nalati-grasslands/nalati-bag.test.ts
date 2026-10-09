import { saveFixture } from '../../fake/saveFixture';
// E314 (Jake's pick C, art/loot/round-3-other-shards/board-2-nalati.jpg): Nalati's Bag is MAP · GEAR · FINDS · FEATS —
// no pack and no harvest, every skin on GEAR (the locked ones say who drops them), FINDS = the 5 elites with their
// prizes + the places, and Argymaq's prize is the horse (his old drop id 'argymaq' was no skin, silently dropped).
import { describe, expect, it } from 'vitest';
import { Inventory, harvestOf, type ItemId } from '../../../src/game/Inventory';
import { ITEMS } from '../../../src/game/bag/itemCatalog';
import { NALATI_SKINS, NalatiSkinLocker } from '../../../src/shards/nalati-grasslands/weapons/nalatiSkins';
import { NALATI_ELITE_DEFS as ELITE_DEFS } from '../../../src/shards/nalati-grasslands/combat/eliteRoster';
import { FINDS_ELITES, elitePrize, nalatiFinds, skinRows, skinSource } from '../../../src/shards/nalati-grasslands/bag';
import { NALATI_PLACES } from '../../../src/shards/nalati-grasslands/quest';

const NALATI = 'chunk://local/nalati-grasslands';
const PINE = 'chunk://local/pine-hollow';
const DRIFT = 'chunk://local/driftwood-isle';
/** the 12 kinds Nalati used to hand out, none ever read by anything (the audit's slop) */
const SLOP = ['wolf-pelt', 'wolf-fang', 'horsehair', 'stone-shard', 'grave-dust', 'marmot-fur',
  'leopard-pelt', 'grey-mother-pelt', 'eagle-feather', 'captain-standard', 'mane-braid', 'gold-plaque'];
/** every creature that dies on Nalati */
const NALATI_KINDS = ['wolf', 'horse', 'balbal', 'ghost-rider', 'marmot', 'sheep', 'leopard', 'kokbori', 'eagle', 'argymaq', 'golden-king'];
const flags = (on: string[]) => ({ has: (f: string) => on.includes(f) });

describe('the drop list', () => {
  it('the 12 Nalati pack kinds are gone from the game', () => {
    for (const id of SLOP) expect(id in ITEMS, id).toBe(false);
  });

  it('no Nalati carcass yields anything (no [E] Harvest)', () => {
    const inv = new Inventory(NALATI);
    for (const kind of NALATI_KINDS) {
      expect(harvestOf(kind, 'alpha'), kind).toEqual([]);
      expect(inv.harvest(kind), kind).toEqual([]);
    }
  });

  it('nothing enters a Nalati pack', () => {
    const inv = new Inventory(NALATI);
    for (const id of Object.keys(ITEMS) as ItemId[]) expect(inv.add(id), id).toBe(false);
    expect(inv.items).toEqual([]);
  });

  it('an old save\'s Nalati pack is dropped on load', () => {
    saveFixture('nalati-grasslands', 'inventory', { counts: { 'wolf-pelt': 4, 'mane-braid': 1, 'gold-plaque': 1 }, order: ['wolf-pelt', 'mane-braid', 'gold-plaque'] });
    const inv = new Inventory(NALATI);
    expect(inv.items).toEqual([]);
    expect(inv.total).toBe(0);
  });

  it('Driftwood and Pine Hollow keep their packs', () => {
    expect(new Inventory(DRIFT).slots).toBe(12);
    expect(new Inventory(PINE).slots).toBe(7);
    expect(new Inventory(DRIFT).harvest('crab', 'big')).toEqual(['crab-meat', 'crab-claw', 'crab-shell']);
    expect(new Inventory(PINE).harvest('deer', 'stag')).toEqual(['venison', 'deer-hide']);
  });
});

describe('the no-pack Bag', () => {
  it('Nalati\'s Inventory has 0 slots: the menu shows no PACK tab (src/engine/ui/Menu.ts hasPack)', () => {
    expect(new Inventory(NALATI).slots).toBe(0);
  });
});

describe('GEAR', () => {
  it('the SKINS row shows every skin; the ones not owned are locked and say who drops them', () => {
    saveFixture('nalati-grasslands', 'nalati.skins', { owned: ['irbis-sabre', 'sky-wolf-bow'], worn: { sabre: 'irbis-sabre' } });
    const rows = skinRows(new NalatiSkinLocker());
    expect(rows.map((r) => r.id)).toEqual(NALATI_SKINS.map((s) => s.id));
    expect(rows.filter((r) => r.locked !== true).map((r) => r.id)).toEqual(['irbis-sabre', 'sky-wolf-bow']);
    expect(rows.find((r) => r.id === 'irbis-sabre')?.worn).toBe(true);
    expect(rows.find((r) => r.id === 'storm-wing-arrows')?.blurb).toBe('Qyran the Storm-Wing drops it');
    expect(rows.find((r) => r.id === 'night-rider-mount')?.blurb).toBe('Qara Batyr the Unburied drops it');
    expect(rows.find((r) => r.id === 'sky-marked-saddle')?.blurb).toBe('Jel Ata, the Storm Titan drops it');
  });

  it('every skin has a source', () => {
    for (const s of NALATI_SKINS) expect(skinSource(s.id), s.id).not.toBeNull();
  });
});

describe('FINDS', () => {
  it('the 5 elites, each with its prize and title; felled = found', () => {
    const v = nalatiFinds(flags(['felled:aqbars', 'felled:argymaq', 'seen:nomad-camp']));
    const elites = v.sections.find((s) => s.title === 'Elites');
    expect(elites?.items.map((i) => i.label)).toEqual(['Aqbars the Pale', 'Kokbori', 'Qyran the Storm-Wing', 'Qara Batyr the Unburied', 'Argymaq the Unbroken']);
    expect(elites?.items.map((i) => i.found)).toEqual([true, false, false, false, true]);
    expect(elites?.items[0]?.prize).toEqual(['Irbis skin', 'Crazy Cat Person']);
    expect(elites?.items[1]?.prize).toEqual(['Sky-Wolf skin', 'Good Boy Denier']);
    expect(elites?.items[4]?.prize).toEqual(['Your horse', 'Horse Whisperer (Shouting)']);
    expect(v.counters).toEqual([{ label: 'Elites', n: 2, of: 5 }, { label: 'Places', n: NALATI_PLACES.some((p) => p.id === 'nomad-camp') ? 1 : 0, of: NALATI_PLACES.length }]);
    expect(v.glass).toEqual([]);
  });

  it('the places are the discovery list (17), seen = found', () => {
    expect(NALATI_PLACES.length).toBe(17);
    const first = NALATI_PLACES[0];
    if (!first) throw new Error('no places');
    const v = nalatiFinds(flags([`seen:${first.id}`]));
    const places = v.sections.find((s) => s.title === 'Places');
    expect(places?.items.length).toBe(17);
    expect(places?.items.filter((i) => i.found).map((i) => i.label)).toEqual([first.label]);
  });

  it('FINDS lists every named elite', () => {
    expect(FINDS_ELITES.map((e) => e.id).sort()).toEqual(Object.keys(ELITE_DEFS).sort());
  });
});

describe('Argymaq', () => {
  it('every elite drop is a real skin or no skin at all (nothing silently dropped)', () => {
    const ids = new Set(NALATI_SKINS.map((s) => s.id));
    for (const d of Object.values(ELITE_DEFS)) if (d.drop.skin !== null) expect(ids.has(d.drop.skin), `${d.id} → ${d.drop.skin}`).toBe(true);
  });

  it('his prize is the horse, not a skin', () => {
    expect(ELITE_DEFS['argymaq']?.drop.skin).toBeNull();
    expect(elitePrize('argymaq').prize).toBe('Your horse');
  });

  it('the other four each pay their own skin, which the locker takes', () => {
    saveFixture('nalati-grasslands', 'nalati.skins', { owned: [], worn: {} });
    const locker = new NalatiSkinLocker();
    for (const id of ['aqbars', 'kokbori', 'qyran', 'qara-batyr']) {
      const skin = ELITE_DEFS[id]?.drop.skin;
      expect(typeof skin, id).toBe('string');
      if (typeof skin === 'string') locker.own(skin);
    }
    expect([...locker.owned].sort()).toEqual(['irbis-sabre', 'night-rider-mount', 'sky-wolf-bow', 'storm-wing-arrows']);
  });
});
