// src/game/quest/Ecology.ts — the respawn timers: a kill queues its replacement; it comes back only once due, out of
// sight (> 60 m) and, for the drowned sailor, after dark.
import { describe, expect, it } from 'vitest';
import { OUT_OF_SIGHT, RESPAWN, RespawnQueue } from '../src/game/quest/Ecology';

describe('RespawnQueue', () => {
  it('queues a known kind with a due time inside its rule, ignores the rest', () => {
    const q = new RespawnQueue(RESPAWN, () => 0.5);
    const e = q.add('crab', 'big', 3, 10, 20, 100);
    expect(e?.due).toBe(100 + (240 + 360) / 2);
    expect(q.add('captain', undefined, -1, 0, 0, 100)).toBeNull();
    expect(q.add('dragon', undefined, -1, 0, 0, 100)).toBeNull();
    expect(q.pending).toHaveLength(1);
  });

  it('nothing comes back before it is due', () => {
    const q = new RespawnQueue(RESPAWN, () => 0);
    q.add('boar', 'sow', 0, 0, 0, 0);
    expect(q.take(299, 500, 500, 0)).toEqual([]);
    expect(q.take(300, 500, 500, 0).map((e) => e.variant)).toEqual(['sow']);
    expect(q.pending).toHaveLength(0);
  });

  it('never in sight: waits while the player stands within OUT_OF_SIGHT of the spot', () => {
    const q = new RespawnQueue(RESPAWN, () => 0);
    q.add('monkey', undefined, 1, 0, 0, 0);
    expect(q.take(1000, OUT_OF_SIGHT - 1, 0, 0)).toEqual([]);
    expect(q.pending).toHaveLength(1);
    expect(q.take(1001, OUT_OF_SIGHT + 1, 0, 0)).toHaveLength(1);
  });

  it('the drowned sailor only rises again after dark', () => {
    const q = new RespawnQueue(RESPAWN, () => 0);
    q.add('sailor', 'sailor', -1, 150, 4, 0);
    expect(q.take(500, 0, -200, 0.2)).toEqual([]);
    const back = q.take(500, 0, -200, 0.8);
    expect(back.map((e) => [e.kind, e.herd, e.x, e.z])).toEqual([['sailor', -1, 150, 4]]);
  });

  it('several kills come back independently, each once', () => {
    const q = new RespawnQueue(RESPAWN, () => 0);
    q.add('crab', 'small', 2, 0, 0, 0);
    q.add('crab', 'small', 2, 0, 0, 100);
    expect(q.take(250, 500, 0, 0)).toHaveLength(1);
    expect(q.take(250, 500, 0, 0)).toHaveLength(0);
    expect(q.take(350, 500, 0, 0)).toHaveLength(1);
  });
});
