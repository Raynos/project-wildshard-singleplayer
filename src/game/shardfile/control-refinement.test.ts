import { afterEach, expect, test, vi } from 'vitest';
import { Scope } from '@wildshard/engine/app/scope';
import { reachControl } from '@wildshard/engine/boot/prefetch';
import { ControlRefinement, prepareSpawnView } from './controlRefinement';
import { Group, PerspectiveCamera } from 'three';
import { StreamingCamera, type StreamingView } from './streamingView';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); vi.restoreAllMocks(); });
function fixture(view?: () => StreamingView | null) {
  const level = new Scope('refine-level'), owner = new Scope('refine-owner'), position = { x: 0, z: 0 }, seen: string[] = [];
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(owner, 'raf').mockImplementation(run => { frames.push(run); return frames.length; });
  owner.onDispose(() => { frames.length = 0; });
  scopes.push(level, owner);
  const queue = new ControlRefinement(owner, level, () => position, () => Promise.resolve(), view);
  const paint = () => { const frame = frames.shift(); if (frame === undefined) throw new Error('Missing first controlled paint'); frame(1); };
  return { level, owner, queue, seen, position, paint, frames };
}

test('a high eye schedules visible work before a closer job behind the camera', async () => {
  const camera = new PerspectiveCamera(50, 0.5, 0.1, 1000);
  camera.position.set(0, 160, 0); camera.lookAt(90, 40, -25);
  const view = new StreamingCamera(new Group(), () => camera), f = fixture(() => view.read());
  const behind = f.queue.add('behind', { x: -10, y: 160, z: 0 }, () => { f.seen.push('behind'); return Promise.resolve(); });
  const front = f.queue.add('front', { x: 95, y: 50, z: -30, bounds: { min: [62.5, 0, -62.5], max: [125, 100, 0] } }, () => { f.seen.push('front'); return Promise.resolve(); });
  reachControl(f.level); f.paint(); f.paint();
  expect(await Promise.all([behind, front])).toEqual([true, true]);
  expect(f.seen).toEqual(['front', 'behind']);
});

test('the spawn fence uses visible bounds and eye height while keeping unbounded recipes conservative', async () => {
  const camera = new PerspectiveCamera(50, 0.5, 0.1, 1000);
  camera.position.set(0, 160, 0); camera.lookAt(90, 40, -25);
  const view = new StreamingCamera(new Group(), () => camera), f = fixture(() => view.read());
  const behind = f.queue.add('behind', { x: -30, y: 160, z: 30, bounds: { min: [-40, 150, 20], max: [-20, 170, 40] } }, () => { f.seen.push('behind'); return Promise.resolve(); });
  const front = f.queue.add('front', { x: 95, y: 50, z: -30, bounds: { min: [62.5, 0, -62.5], max: [125, 100, 0] } }, () => { f.seen.push('front'); return Promise.resolve(); });
  const recipe = f.queue.add('recipe', { x: 0, y: 160, z: 0 }, () => { f.seen.push('recipe'); return Promise.resolve(); });
  const high = f.queue.add('high', { x: 0, y: 500, z: 0 }, () => { f.seen.push('high'); return Promise.resolve(); });
  await prepareSpawnView();
  expect(f.seen).toEqual(['front', 'recipe']);
  expect(await front).toBe(true); expect(await recipe).toBe(true);
  reachControl(f.level); f.paint(); f.paint();
  expect(await Promise.all([behind, high])).toEqual([true, true]);
  expect(f.seen).toEqual(['front', 'recipe', 'behind', 'high']);
});

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


test('settled tile identities can return without retaining a permanent job history', async () => {
  const f = fixture(), run = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const first = f.queue.add('tile', { x: 0, z: 0 }, run);
  await expect(f.queue.add('tile', { x: 1, z: 0 }, run)).rejects.toThrow('duplicate');
  reachControl(f.level); f.paint(); f.paint(); expect(await first).toBe(true);
  expect(await f.queue.add('tile', { x: 1, z: 0 }, run)).toBe(true);
  expect(run).toHaveBeenCalledTimes(2);
});

test('MF5: the loader fence runs only spawn-view jobs before control, and the rest after it, nearest first', async () => {
  const f = fixture();
  const run = (id: string, x: number) => f.queue.add(id, { x, z: 0 }, () => { f.seen.push(id); return Promise.resolve(); });
  const far = run('far', 500), near = run('near', 10), edge = run('edge', 150);
  await Promise.resolve(); expect(f.seen).toEqual([]); // no fence, no control: nothing runs
  await prepareSpawnView(160);
  expect(f.seen).toEqual(['near', 'edge']); expect(await near).toBe(true); expect(await edge).toBe(true);
  reachControl(f.level); f.paint(); f.paint();
  expect(await far).toBe(true); expect(f.seen).toEqual(['near', 'edge', 'far']);
});
