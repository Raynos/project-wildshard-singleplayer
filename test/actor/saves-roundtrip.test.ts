import { saves } from '../../src/engine/saves/runtime';
// Gameplay clients round-trip through the versioned SaveStore in node.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Progress } from '../../src/game/Progress';
import { Inventory } from '../../src/game/Inventory';
import { Purse } from '../../src/game/loot/Purse';
import { Owned } from '../../src/game/loot/Owned';
import { Bounty } from '../../src/game/loot/Bounty';
import { Flags } from '../../src/engine/world/interact/flags';
import { FakeStorage } from '../fake/fakeStorage';

const DRIFT = 'chunk://local/driftwood-isle', PINE = 'chunk://local/pine-hollow';
const originalStorage = localStorage;
beforeEach(() => { vi.stubGlobal('localStorage', new FakeStorage()); });
afterEach(() => { vi.stubGlobal('localStorage', originalStorage); });

describe('gameplay SaveStore contract in node', () => {
  it('round-trips progress, inventory, purse, owned/worn, bounty and flags across fresh storage and instances', () => {
    const progress = new Progress(PINE), inventory = new Inventory(PINE), purse = new Purse(DRIFT), owned = new Owned(DRIFT);
    progress.recordKill('deer', 'ghost');
    expect(inventory.add('deer-hide', 3)).toBe(true);
    purse.add(37); expect(purse.spend(12)).toBe(true);
    owned.grant('iron-sword'); owned.grant('cape'); expect(owned.wear('cape')).toBe(true);
    const caps = new Map([['boar:0', 2]]), target = { kind: 'boar', herd: 0 };
    const bounty = new Bounty(DRIFT, caps); expect(bounty.claim(target)).toBe(true);
    const flags = new Flags(DRIFT); flags.set('talked:castaway'); flags.set('plate:test');

    const exported = saves.exportAll();
    vi.stubGlobal('localStorage', new FakeStorage());
    expect(saves.importAll(exported).skipped).toEqual([]);
    expect(new Progress(PINE).title?.id).toBe('ghost');
    expect(new Progress(PINE).count('deer5')).toBe(1);
    expect(new Inventory(PINE).count('deer-hide')).toBe(3);
    expect(new Purse(DRIFT).coins).toBe(25);
    expect(new Owned(DRIFT).has('iron-sword')).toBe(true);
    expect(new Owned(DRIFT).worn('cape')).toBe(true);
    expect(new Bounty(DRIFT, caps).left(target)).toBe(1);
    expect(new Flags(DRIFT).all).toEqual(['talked:castaway']);
    expect(new Purse(PINE).coins).toBe(0);
    expect(new Owned(PINE).all).toEqual([]);
    expect(new Flags(PINE).all).toEqual([]);
    expect(new Inventory(DRIFT).total).toBe(0);
  });

  it('writing another shard preserves the original shard in every document', () => {
    const caps = new Map([['boar:0', 2]]), target = { kind: 'boar', herd: 0 };
    for (const shard of [DRIFT, PINE]) {
      new Progress(shard).recordKill(shard === PINE ? 'boar' : 'crab');
      new Inventory(shard).add('deer-hide', 2);
      new Purse(shard).add(5);
      new Owned(shard).grant('cape');
      new Bounty(shard, caps).claim(target);
      new Flags(shard).set('talked:trader');
    }
    for (const shard of [DRIFT, PINE]) {
      expect(new Purse(shard).coins).toBe(5);
      expect(new Owned(shard).has('cape')).toBe(true);
      expect(new Bounty(shard, caps).left(target)).toBe(1);
      expect(new Flags(shard).has('talked:trader')).toBe(true);
      expect(new Inventory(shard).count('deer-hide')).toBe(2);
      expect(new Progress(shard).count(shard === PINE ? 'boar5' : 'crab10')).toBe(1);
    }
  });

  it('implements Storage key order, overwrite, removal and clear', () => {
    const storage = new FakeStorage();
    storage.setItem('a', '1'); storage.setItem('b', '2'); storage.setItem('a', '3');
    expect(storage.length).toBe(2); expect(storage.key(0)).toBe('a'); expect(storage.key(1)).toBe('b');
    expect(storage.getItem('a')).toBe('3'); expect(storage.key(2)).toBeNull();
    storage.removeItem('a'); expect(storage.key(0)).toBe('b');
    storage.clear(); expect(storage.length).toBe(0); expect(storage.getItem('b')).toBeNull();
    storage.setItem(3, false); expect(storage.getItem('3')).toBe('false');
  });
});
