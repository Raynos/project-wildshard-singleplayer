// E314 stage 1 (src/game/loot/): the purse, the owned store, what a kill is worth and where coins drop, FINDS' counts.
import { describe, expect, it, vi } from 'vitest';
import { Purse } from '../src/game/loot/Purse';
import { Owned } from '../src/game/loot/Owned';
import { Bounty, bountyKey } from '../src/game/loot/Bounty';
import { COIN_VALUES, MAX_BURST, burstCount, coinShare, coinsFor, coinsOn } from '../src/game/loot/coins';
import { driftwoodFinds, nextCharmAt } from '../src/game/loot/finds';
import { DRIFTWOOD_ISLE } from '../src/chunks/driftwood-isle';
import { CHUNKS, PROTOTYPES } from '../src/chunks/registry';

const DRIFT = 'chunk://local/driftwood-isle';
const PINE = 'chunk://local/pine-hollow';

describe('Purse', () => {
  it('starts empty, adds whole coins, saves per shard', () => {
    const p = new Purse(DRIFT);
    expect(p.coins).toBe(0);
    p.add(2); p.add(1.9); p.add(0); p.add(-4);
    expect(p.coins).toBe(3);
    expect(new Purse(DRIFT).coins).toBe(3);
    expect(new Purse(PINE).coins).toBe(0);
  });

  it('spends only what it holds', () => {
    const p = new Purse(DRIFT);
    p.add(20);
    expect(p.spend(25)).toBe(false);
    expect(p.coins).toBe(20);
    expect(p.spend(15)).toBe(true);
    expect(new Purse(DRIFT).coins).toBe(5);
  });

  it('tells listeners the total and the change; unsubscribes', () => {
    const p = new Purse(DRIFT), fn = vi.fn();
    const off = p.onChange((n, d) => { fn(n, d); });
    p.add(5);
    expect(fn).toHaveBeenCalledWith(5, 5);
    off(); p.add(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("a burst's coins are counted per landing but written once, on flush", () => {
    const p = new Purse(DRIFT), fn = vi.fn();
    p.onChange((n) => { fn(n); });
    p.add(2, false); p.add(3, false);
    expect(p.coins).toBe(5);
    expect(fn).toHaveBeenLastCalledWith(5);
    expect(p.unsaved).toBe(true);
    expect(new Purse(DRIFT).coins).toBe(0);
    p.flush();
    expect(p.unsaved).toBe(false);
    expect(new Purse(DRIFT).coins).toBe(5);
  });

  it('ignores a corrupt save and survives a throwing store', () => {
    localStorage.setItem('ws.purse.v1', '{"chunk://local/driftwood-isle":"lots"}');
    expect(new Purse(DRIFT).coins).toBe(0);
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('private mode'); });
    const p = new Purse(DRIFT); p.add(3);
    expect(p.coins).toBe(3);
  });
});

describe('Owned', () => {
  it('grants once, saves per shard, derives the tiers', () => {
    const o = new Owned(DRIFT);
    expect(o.sharpen).toBe(0);
    expect(o.grant('whetstone-1')).toBe(true);
    expect(o.grant('whetstone-1')).toBe(false);
    o.grant('heart-1'); o.grant('heart-2'); o.grant('charm-1');
    const again = new Owned(DRIFT);
    expect(again.sharpen).toBe(1);
    expect(again.hearts).toBe(2);
    expect(again.charms).toBe(1);
    expect(new Owned(PINE).has('whetstone-1')).toBe(false);
  });

  it('wears a cosmetic only once owned, and remembers it worn', () => {
    const o = new Owned(DRIFT);
    expect(o.wear('cape')).toBe(false);
    expect(o.worn('cape')).toBe(false);
    o.grant('cape');
    expect(o.toggleWorn('cape')).toBe(true);
    expect(new Owned(DRIFT).worn('cape')).toBe(true);
    expect(o.toggleWorn('cape')).toBe(false);
    expect(new Owned(DRIFT).worn('cape')).toBe(false);
  });

  it('revoking takes a worn cosmetic off; unknown saved ids are dropped', () => {
    const o = new Owned(DRIFT);
    o.grant('captain-hat'); o.wear('captain-hat'); o.revoke('captain-hat');
    expect(o.worn('captain-hat')).toBe(false);
    localStorage.setItem('ws.owned.v1', JSON.stringify({ [DRIFT]: { owned: ['iron-sword', 'hoverboard-fin'], worn: ['cape'] } }));
    const r = new Owned(DRIFT);
    expect(r.all).toEqual(['iron-sword']);
    expect(r.worn('cape')).toBe(false); // not owned → not worn
  });
});

describe('coins', () => {
  it("Jake's first-guess values", () => {
    expect(COIN_VALUES).toEqual({ crab: 1, monkey: 1, boar: 2, sailor: 5, bear: 10, captain: 25 });
    expect(coinsFor(DRIFTWOOD_ISLE, 'deer')).toBe(0); // Jake cut the deer from Driftwood
  });

  it('only Driftwood pays coins (ChunkDef.loot gating)', () => {
    expect(coinsOn(DRIFTWOOD_ISLE)).toBe(true);
    expect(coinsFor(DRIFTWOOD_ISLE, 'boar')).toBe(2);
    expect(coinsFor(DRIFTWOOD_ISLE, 'gull')).toBe(0);
    for (const def of [...CHUNKS, ...PROTOTYPES]) if (def.slug !== 'driftwood-isle') {
      expect(coinsOn(def)).toBe(false);
      expect(coinsFor(def, 'bear')).toBe(0);
    }
  });

  it('a burst splits the total over at most MAX_BURST coins, and the shares add up', () => {
    expect(burstCount(1)).toBe(1);
    expect(burstCount(25)).toBe(MAX_BURST);
    for (const total of [1, 2, 5, 10, 25]) {
      const n = burstCount(total);
      let sum = 0;
      for (let i = 0; i < n; i++) sum += coinShare(total, n, i);
      expect(sum).toBe(total);
    }
  });
});

describe('FINDS', () => {
  const flags = (on: string[]) => ({ has: (f: string) => on.includes(f) });
  const noOwned = { has: () => false };

  it('counts the 15 beach sea glass flags only, places and glyph shards', () => {
    const v = driftwoodFinds(flags(['glass:1', 'glass:7', 'glass:15', 'glass:16', 'seen:pier', 'seen:hut', 'shard:cave']), noOwned);
    expect(v.counters).toEqual([
      { label: 'Sea glass', n: 3, of: 15 },
      { label: 'Places', n: 2, of: 11 },
      { label: 'Glyph shards', n: 1, of: 3 },
    ]);
    expect(v.glass).toHaveLength(15);
    expect(v.glass.filter((g) => g.found)).toHaveLength(3);
    expect(v.next).toBe('Next charm at 5');
  });

  it('trophies from Owned, the pearl necklace from its flag', () => {
    const v = driftwoodFinds(flags(['found:reef-treasure']), { has: (id: string) => id === 'bear-claw' });
    const [trophies, treasures] = v.sections;
    expect(trophies?.items.map((i) => i.found)).toEqual([true, false, false]);
    expect(treasures?.items).toEqual([{ label: 'Pearl necklace', icon: 'necklace', found: true }]);
  });

  it('the next charm every 5 pieces, none after 15', () => {
    expect(nextCharmAt(0)).toBe(5);
    expect(nextCharmAt(5)).toBe(10);
    expect(nextCharmAt(14)).toBe(15);
    expect(nextCharmAt(15)).toBeNull();
  });
});

describe('Bounty (each enemy pays once)', () => {
  const boar = (herd: number) => ({ kind: 'boar', herd, alive: true });
  const island = [boar(0), boar(0), boar(0), boar(1), { kind: 'sailor', herd: -1, alive: true }, { kind: 'crab', herd: 5, alive: false }];

  it('keys by herd slot, lone enemies by kind; counts the living starting population', () => {
    expect(bountyKey(boar(2))).toBe('boar:2');
    expect(bountyKey({ kind: 'captain', herd: -1 })).toBe('captain');
    expect([...Bounty.census(island)]).toEqual([['boar:0', 3], ['boar:1', 1], ['sailor', 1]]);
  });

  it("a herd pays for its starting count of deaths; a respawn's kill pays nothing, across a reload", () => {
    const b = new Bounty(DRIFT, Bounty.census(island));
    expect([b.claim(boar(0)), b.claim(boar(0)), b.claim(boar(0))]).toEqual([true, true, true]);
    expect(b.claim(boar(0))).toBe(false); // the replacement Ecology brought back
    expect(b.claim(boar(1))).toBe(true);
    const reloaded = new Bounty(DRIFT, Bounty.census(island));
    expect(reloaded.claim(boar(0))).toBe(false);
    expect(reloaded.claim(boar(1))).toBe(false);
    expect(new Bounty(PINE, Bounty.census(island)).claim(boar(0))).toBe(true);
  });

  it('the sailor (every night) and the captain (not in the census: he rises at the finale) pay once', () => {
    const b = new Bounty(DRIFT, Bounty.census(island));
    const sailor = { kind: 'sailor', herd: -1 }, captain = { kind: 'captain', herd: -1 };
    expect([b.claim(sailor), b.claim(sailor)]).toEqual([true, false]);
    expect([b.claim(captain), b.claim(captain)]).toEqual([true, false]);
  });
});
