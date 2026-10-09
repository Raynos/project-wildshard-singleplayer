import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PineStuckArrows, type ArrowBody } from '../../../src/shards/pine-hollow/runtime/weapons/stuckArrows';

it('recovers in reverse order on the eighth update, stopping before a draw when the quiver fills', () => {
  let capacity = 1, draws = 0;
  const recovered: boolean[] = [];
  const pool = new PineStuckArrows({ feet: new Vector3(), floorAt: () => 0, body: () => undefined,
    canRecover: () => capacity > 0, recover: ok => { recovered.push(ok); if (ok) capacity--; }, random: () => { draws++; return 0.69; } });
  const dir = new Vector3(0, 0, 1);
  pool.stop(new Vector3(0.1, 0.1, 0), dir, false, null);
  pool.stop(new Vector3(0.2, 0.1, 0), dir, false, null);
  for (let i = 0; i < 7; i++) pool.update();
  expect([pool.count, draws]).toEqual([2, 0]);
  pool.update(); expect([pool.count, draws]).toEqual([1, 1]); expect(recovered).toEqual([true]);
  expect(pool.snapshot().stuck[0]?.position[0]).toBe(0.1);
  for (let i = 0; i < 8; i++) pool.update(); expect([pool.count, draws]).toEqual([1, 1]);
});

it('continues yaw attachments, death drops, rest contacts and pickup clocks exactly after JSON restore', () => {
  const body: ArrowBody = { entityId: 'target', position: new Vector3(5, 0, 5), yaw: 0.6, alive: true, hidden: false };
  let current: ArrowBody = body;
  const make = (): PineStuckArrows => new PineStuckArrows({ feet: new Vector3(), floorAt: () => -2, body: id => id === current.entityId ? current : undefined,
    canRecover: () => false, recover: () => { throw new Error('Unexpected pickup'); }, random: () => { throw new Error('Unexpected draw'); } });
  const pool = make(), restored = make();
  pool.stop(new Vector3(5, 3, 6), new Vector3(0, 0, -1), true, body);
  pool.rest(new Vector3(8, 0, 8), new Vector3(0, -1, 0), new Vector3(0, 1, 0));
  for (let i = 0; i < 7; i++) pool.update();
  const json = JSON.stringify(pool.snapshot()); restored.restore(JSON.parse(json));
  for (let tick = 0; tick < 60; tick++) {
    current = { ...body, position: new Vector3(5 + tick, 0.3, 5), yaw: tick / 8, alive: tick < 30 };
    pool.update(); restored.update(); expect(restored.snapshot()).toEqual(pool.snapshot());
  }
  expect(pool.snapshot().stuck[0]?.body).toBeNull();
  expect(pool.snapshot().stuck[0]?.recoverable).toBe(true);
});

it('evicts the oldest at the real cap and refuses malformed continuation without modifying the pool', () => {
  const pool = new PineStuckArrows({ feet: new Vector3(), floorAt: () => 0, body: () => undefined,
    canRecover: () => false, recover: () => undefined, random: () => 0 });
  for (let i = 0; i < 49; i++) pool.stop(new Vector3(i + 10, 3, 0), new Vector3(0, 0, 1), false, null);
  expect(pool.count).toBe(48); expect(pool.snapshot().stuck[0]?.position[0]).toBe(11);
  expect(pool.snapshot().stuck[0]?.recoverable).toBe(false);
  const before = pool.snapshot();
  for (const invalid of [{ ...before, frame: -1 }, { ...before, version: 2 }, { ...before, extra: true }, { ...before, stuck: Array.from({ length: 49 }, () => before.stuck[0]) }]) {
    expect(() => pool.restore(invalid)).toThrow(); expect(pool.snapshot()).toEqual(before);
  }
});
