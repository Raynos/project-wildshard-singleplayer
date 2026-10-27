import { afterEach, expect, test, vi } from 'vitest';
import { Scope } from '@wildshard/engine/app/scope';
import { reachControl } from '@wildshard/engine/boot/prefetch';
import { ControlRefinement } from './controlRefinement';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); vi.restoreAllMocks(); });
function fixture() {
  const level = new Scope('refine-level'), owner = new Scope('refine-owner'), position = { x: 0, z: 0 }, seen: string[] = [];
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(owner, 'raf').mockImplementation(run => { frames.push(run); return frames.length; });
  owner.onDispose(() => { frames.length = 0; });
  scopes.push(level, owner);
  const queue = new ControlRefinement(owner, level, () => position, () => Promise.resolve());
  const paint = () => { const frame = frames.shift(); if (frame === undefined) throw new Error('Missing first controlled paint'); frame(1); };
  return { level, owner, queue, seen, position, paint, frames };
}

test('refinement starts after controlled paint and reorders the remaining queue by the viewer', async () => {
  const f = fixture();
  const run = (id: string, x: number) => f.queue.add(id, { x, z: 0 }, () => { f.seen.push(id); if (id === 'near') f.position.x = 100; return Promise.resolve(); });
  const complete = Promise.all([run('middle', 20), run('far', 100), run('near', 1)]);
  await Promise.resolve(); expect(f.seen).toEqual([]);
  reachControl(f.level); expect(f.seen).toEqual([]); f.paint(); await Promise.resolve(); expect(f.seen).toEqual([]); f.paint();
  expect(await complete).toEqual([true, true, true]); expect(f.seen).toEqual(['near', 'far', 'middle']);
});

test('retirement before control cancels every queued read without publication', async () => {
  const f = fixture(), read = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const queued = f.queue.add('tile', { x: 0, z: 0 }, read); f.owner.dispose(); reachControl(f.level);
  expect(await queued).toBe(false); expect(read).not.toHaveBeenCalled(); expect(f.frames).toEqual([]);
});

test('retirement drains the started read and never starts the next one', async () => {
  const f = fixture(); let release = (): void => { throw new Error('Missing held refinement'); };
  const first = f.queue.add('first', { x: 0, z: 0 }, async () => {
    f.seen.push('start'); await new Promise<void>(resolve => { release = resolve; }); f.seen.push('drained');
  });
  const second = f.queue.add('second', { x: 1, z: 0 }, () => { f.seen.push('forbidden'); return Promise.resolve(); });
  reachControl(f.level); f.paint(); f.paint(); await Promise.resolve(); f.owner.dispose();
  expect(await second).toBe(false); expect(f.seen).toEqual(['start']); release();
  expect(await first).toBe(false); expect(f.seen).toEqual(['start', 'drained']);
});

test('a real source refusal is preserved and blocks later publication', async () => {
  const f = fixture(), refusal = new Error('invalid fine tile'), later = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const complete = Promise.allSettled([f.queue.add('bad', { x: 0, z: 0 }, () => { throw refusal; }), f.queue.add('later', { x: 1, z: 0 }, later)]);
  reachControl(f.level); f.paint(); f.paint();
  const results = await complete;
  for (const result of results) { if (result.status !== 'rejected') throw new Error('A refused refinement published'); const reason: unknown = result.reason; expect(reason).toBe(refusal); }
  expect(later).not.toHaveBeenCalled();
});
