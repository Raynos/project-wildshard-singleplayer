import { expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { RenderRings, levelPorts, type RingPorts, type RingView } from '../src/game/grid/rings';

const here = { x: 0, z: 0, vx: 0, vz: 0 }, away = { x: 10_000, z: 0, vx: 0, vz: 0 };
const view = (): RingView => ({ mask: () => undefined, shadow: () => undefined, dispose: () => undefined });
it('cancels in-flight allocation before its claim leaves and discards the late result', () => {
  const allocator = new ResidencyAllocator(), root = new Scope('cancellation fixture');
  let child: Scope | undefined, complete: ((result: string | Error) => void) | undefined, allocations = 0;
  const trace: string[] = [];
  const rings = new RenderRings([{ instance: 'cell', origin: { x: 0, z: 0 } }], allocator,
    (_instance, level) => level === 'far' ? 1000 : null, {
      fetch: (_tile, done) => { complete = done; child = root.child('construction'); allocations++; child.onDispose(() => { allocations--; }); },
      upload: () => { throw new Error('Cancelled work cannot upload'); },
      cancel: (tile) => { expect(allocator.has(`render:${tile.key}`)).toBe(true); trace.push('cancel'); child?.dispose(); },
      discard: (_tile, data) => { expect(data).toBe('late'); trace.push('discard'); },
    }, { farPrefetch: 0, viewDistance: 100 });
  rings.step(here); expect(allocations).toBe(1);
  rings.step(away); expect(allocations).toBe(0); expect(allocator.entries()).toEqual([]);
  if (complete === undefined) throw new Error('Fixture requires an in-flight callback');
  complete('late'); rings.step(away);
  expect(trace).toEqual(['cancel', 'discard']); expect(root.census.disposers).toBe(0);
  rings.dispose(); root.dispose();
});

it('drops queued preparation and cancels its scope while retaining the claim through both cleanup calls', () => {
  const allocator = new ResidencyAllocator(), trace: string[] = [];
  const rings = new RenderRings([{ instance: 'cell', origin: { x: 0, z: 0 } }], allocator,
    (_instance, level) => level === 'far' ? 1000 : null, {
      fetch: (_tile, done) => { done('queued'); }, upload: view,
      discard: (tile) => { expect(allocator.has(`render:${tile.key}`)).toBe(true); trace.push('discard'); },
      cancel: (tile) => { expect(allocator.has(`render:${tile.key}`)).toBe(true); trace.push('cancel'); },
    }, { uploadsPerFrame: 0, farPrefetch: 0, viewDistance: 100 });
  rings.step(here); expect(rings.stats().queued).toBe(1);
  rings.dispose(); expect(trace).toEqual(['discard', 'cancel']); expect(allocator.entries()).toEqual([]);
});

it('delegates cancellation to the far and fine construction owners through levelPorts', () => {
  const trace: string[] = [];
  const ports = (label: string): RingPorts<string> => ({ fetch: (_tile, done) => { done(label); }, upload: view,
    cancel: () => { trace.push(label); } });
  const routed = levelPorts(ports('far'), ports('fine'));
  for (const level of ['far', 'l1', 'l0'] as const) routed.cancel?.({ key: level, instance: 'cell', level, x: 0, z: 0 });
  expect(trace).toEqual(['far', 'fine', 'fine']);
});

it('retires construction and claims when preparation or upload throws synchronously', () => {
  for (const phase of ['prepare', 'upload'] as const) {
    const allocator = new ResidencyAllocator(); let cancelled = 0;
    const rings = new RenderRings([{ instance: 'cell', origin: { x: 0, z: 0 } }], allocator,
      (_instance, level) => level === 'far' ? 1000 : null, {
        fetch: (_tile, done) => { if (phase === 'prepare') throw new Error('renderer failed'); done('prepared'); },
        upload: () => { throw new Error('renderer failed'); },
        cancel: (tile) => { expect(allocator.has(`render:${tile.key}`)).toBe(true); cancelled++; },
      });
    expect(() => rings.step(here)).toThrow('renderer failed'); expect(cancelled).toBe(1);
    expect(allocator.entries()).toEqual([]); rings.dispose();
  }
});

it('keeps retiring all cancelled claims when a renderer cleanup fails', () => {
  const allocator = new ResidencyAllocator(); let cancelled = 0;
  const rings = new RenderRings([{ instance: 'cell', origin: { x: 0, z: 0 } }, { instance: 'other', origin: { x: 0, z: 0 } }], allocator,
    (_instance, level) => level === 'far' ? 1000 : null, {
      fetch: (_tile, done) => { done('prepared'); }, upload: view,
      discard: () => { throw new Error('discard failed'); }, cancel: () => { cancelled++; },
    }, { uploadsPerFrame: 0 });
  rings.step(here); expect(() => rings.dispose()).toThrow('Ring tile cleanup failed');
  expect(cancelled).toBe(2); expect(allocator.entries()).toEqual([]);
});
