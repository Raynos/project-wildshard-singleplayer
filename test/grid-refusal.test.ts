// SF58 (12), G167: a shard that can't load. The admission error maps to one reason (or to "only waiting"), the reason and
// the far view map to the board's B (frozen grey far view under a static dome) or A (the void and the SHARD UNAVAILABLE
// sign), and SHARD SELECT reads this session's refused shards.
import { describe, expect, it } from 'vitest';
import { SaveStore } from '../src/engine/saves/store';
import { GridCellWaiting, classifyRefusal, refusalReason, refusedLook, shardRefusals } from '../src/game/grid/refusal';

class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
}

describe('G167: the admission error → the refusal reason', () => {
  it('a cell only waiting for M3, or a closing page, is not refused', () => {
    expect(classifyRefusal(new GridCellWaiting('pine-hollow is not a shardfile shard (it stays a far proxy until M3)'))).toBeNull();
    expect(classifyRefusal(new Error('pine-hollow is not a shardfile shard (it stays a far proxy until M3)'))).toBeNull();
    expect(classifyRefusal(new Error('driftwood-isle declares a hybrid runtime (M3)'))).toBeNull();
    expect(classifyRefusal(new Error('Live grid is disposed'))).toBeNull();
    expect(classifyRefusal(new Error('Product cache disposed during admission'))).toBeNull();
  });
  it('a format this client cannot read needs an upgrade', () => {
    expect(classifyRefusal(new Error('Shardfile version 3 needs a compatible client'))).toBe('upgrade');
    expect(classifyRefusal(new Error('Shardfile needs a format version'))).toBe('upgrade');
  });
  it('the memory admission (G144 real totals) is too big for this device', () => {
    for (const message of ['Live sim admission deferred by the shared budget', 'Product residency admission deferred',
      'Regional checkpoint basis exceeds residency budget', 'No durable frozen live region can be evicted', 'Live continuation cache capacity exceeded']) {
      expect(classifyRefusal(new Error(message)), message).toBe('too-big');
    }
  });
  it('bytes that never arrived are a load error; everything else failed a safety check', () => {
    expect(classifyRefusal(new TypeError('Load failed'))).toBe('load');
    for (const message of ['Shardfile asset hash mismatch', 'Shardfile wire size exceeds cap', 'Invalid asset address', 'Unexpected token < in JSON']) {
      expect(classifyRefusal(new Error(message)), message).toBe('safety');
    }
    expect(classifyRefusal('a thrown string')).toBe('safety');
  });
  it('each reason reads exactly as the board and the plan word it', () => {
    expect(refusalReason('upgrade')).toBe('NEEDS UPGRADE');
    expect(refusalReason('too-big')).toBe('TOO BIG FOR THIS DEVICE');
    expect(refusalReason('safety')).toBe('FAILED SAFETY CHECK');
    expect(refusalReason('load')).toBe("COULDN'T LOAD");
  });
});

describe('G167: (reason, far view) → B or the A fallback', () => {
  it('B with a drawn far view, A without one; nothing when not refused', () => {
    expect(refusedLook('too-big', 'resident')).toBe('frozen');
    expect(refusedLook('safety', 'none')).toBe('void');
    expect(refusedLook('upgrade', 'loading')).toBe('void');
    expect(refusedLook(null, 'resident')).toBeNull();
    expect(refusedLook(null, 'none')).toBeNull();
  });
});

describe('G167: SHARD SELECT reads this session\'s refused shards', () => {
  it('notes, reads and clears per slug, in the session document only', () => {
    const local = new MemoryStorage(), session = new MemoryStorage();
    const refusals = shardRefusals(new SaveStore({ local, session }));
    expect(refusals.read('pine-hollow')).toBeNull();
    refusals.note('pine-hollow', 'too-big'); refusals.note('nalati-grasslands', 'safety');
    expect(refusals.read('pine-hollow')).toBe('too-big');
    expect(shardRefusals(new SaveStore({ local, session })).read('nalati-grasslands')).toBe('safety'); // a reload in the tab keeps it
    expect(shardRefusals(new SaveStore({ local, session: new MemoryStorage() })).read('pine-hollow')).toBeNull(); // a fresh launch retries
    refusals.clear('pine-hollow');
    expect(refusals.read('pine-hollow')).toBeNull();
    expect(refusals.read('nalati-grasslands')).toBe('safety');
  });
});
