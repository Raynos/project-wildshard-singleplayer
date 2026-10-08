import { expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { RuntimeRenderDependencies } from '../src/game/grid/runtimeRenderDependencies';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';

const dependency = { id: 'materials.verified', jsBytes: 20_000_000, gpuBytes: 20_000_000 };
it('charges one shared resource, holds it and disposes it only after its last consumer', () => {
  const allocator = new ResidencyAllocator(), page = new Scope('page'), shared = new RuntimeRenderDependencies(allocator, page);
  const baseline = page.census;
  const a = shared.acquire(dependency, 'first'), b = shared.acquire(dependency, 'second');
  if (a === null || b === null) throw new Error('Fixture requires two admitted references');
  expect(a.scope).toBe(b.scope); expect(allocator.entries()).toMatchObject([{ bytes: 40_000_000, refs: 2, holds: 2 }]);
  let disposed = 0;
  a.scope.onDispose(() => { expect(allocator.has('runtime-render:dependency:materials.verified')).toBe(true); disposed++; });
  a.release(); a.release(); expect(disposed).toBe(0); expect(b.scope.disposed).toBe(false);
  b.release(); expect(disposed).toBe(1); expect(allocator.entries()).toEqual([]); expect(page.census).toEqual(baseline);
  page.dispose(); expect(page.census.disposers).toBe(0);
});

it('refuses dependency allocation before construction when the budget cannot admit it', () => {
  const allocator = new ResidencyAllocator({ playing: 350_000_000 }), page = new Scope('page'), shared = new RuntimeRenderDependencies(allocator, page);
  expect(shared.acquire(dependency, 'first')).toBeNull(); expect(allocator.entries()).toEqual([]);
  shared.dispose(); expect(() => shared.acquire(dependency, 'first')).toThrow('disposed'); page.dispose();
});

it('refuses a reused identity with changed CPU/GPU ownership even when its total is unchanged', () => {
  const allocator = new ResidencyAllocator(), page = new Scope('page'), shared = new RuntimeRenderDependencies(allocator, page);
  const first = shared.acquire(dependency, 'first');
  if (first === null) throw new Error('Fixture requires a dependency');
  expect(() => shared.acquire({ ...dependency, jsBytes: 10_000_000, gpuBytes: 30_000_000 }, 'other')).toThrow('changed shape');
  expect(allocator.entries()).toMatchObject([{ refs: 1, holds: 1 }]); page.dispose(); first.release();
  expect(first.scope.disposed).toBe(true); expect(allocator.entries()).toEqual([]);
});

it('keeps dependency admission through cleanup failures and releases all page references', () => {
  const allocator = new ResidencyAllocator(), page = new Scope('page'), shared = new RuntimeRenderDependencies(allocator, page);
  const first = shared.acquire(dependency, 'first');
  if (first === null) throw new Error('Fixture requires a dependency');
  first.scope.onDispose(() => { throw new Error('renderer disposal failed'); });
  expect(() => page.dispose()).toThrow('renderer disposal failed'); expect(allocator.entries()).toEqual([]);
  first.release(); expect(() => shared.acquire(dependency, 'first')).toThrow('disposed');
});

it('refuses resurrection when a Developer warning observer disposes the page during reserve', () => {
  const memory = new MemoryAdmission(() => true), allocator = new ResidencyAllocator({ playing: 350_000_000, memory });
  const page = new Scope('page'), shared = new RuntimeRenderDependencies(allocator, page);
  const unsubscribe = memory.subscribe(() => { if (memory.reports().length > 0) page.dispose(); });
  expect(() => shared.acquire(dependency, 'first')).toThrow('disposed during admission');
  expect(page.disposed).toBe(true); expect(allocator.entries()).toEqual([]); unsubscribe();
});
