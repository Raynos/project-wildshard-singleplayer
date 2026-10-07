import { expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry } from 'three';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';
import { PlatformRenderAdmissionError, PlatformRenderResidency } from '../src/game/grid/renderResidency';
import { runtimeAccountedBytes } from '../src/game/grid/runtimeCost';
import { DRIFTWOOD_RUNTIME_COST } from '../src/shards/driftwood-isle/data/runtimeCost';

it('accounts CPU and GPU bytes before constructing a mesh and keeps the claim through resource disposal', () => {
  const scope = new Scope('render-admission'), allocator = new ResidencyAllocator(), admission = new PlatformRenderResidency(allocator, scope);
  const bytes = 9 * Float32Array.BYTES_PER_ELEMENT + 3 * Uint32Array.BYTES_PER_ELEMENT, plan = { id: 'solid', jsBytes: bytes, gpuBytes: bytes };
  let claimedDuringCleanup = false;
  const geometry = admission.allocate(plan, (owner) => {
    expect(allocator.entries()).toMatchObject([{ id: 'platform:render:solid', owner: 'platform', bytes: 2 * bytes, refs: 1, needed: true }]);
    const value = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(9), 3)).setIndex(new BufferAttribute(new Uint32Array(3), 1));
    owner.onDispose(() => { claimedDuringCleanup = allocator.has('platform:render:solid'); value.dispose(); }); return value;
  });
  expect(geometry.getAttribute('position').array.byteLength + (geometry.getIndex()?.array.byteLength ?? 0)).toBe(bytes);
  expect(allocator.cost().accounted).toBe(2 * bytes);
  scope.dispose(); scope.dispose(); expect(claimedDuringCleanup).toBe(true); expect(allocator.entries()).toEqual([]);
});

it('keeps the pre-G173 measured refusal before any array/canvas allocation', () => {
  const scope = new Scope('measured-render'), page = new PageResidency();
  const previousMeasurement = { ...DRIFTWOOD_RUNTIME_COST, webContentMB: 606.097, glMB: 282.4, rev: '6c0aaea4f', evidence: 'progress/memory/sf22a-repeat-6c0aaea4f/summary.json' };
  page.admitHome('driftwood-isle', runtimeAccountedBytes(previousMeasurement));
  const admission = new PlatformRenderResidency(page.allocator, scope), before = page.allocator.entries(); let allocated = false;
  try {
    expect(() => admission.allocate({ id: 'roads', jsBytes: 20_000_000, gpuBytes: 20_000_000 }, () => { allocated = true; })).toThrow(PlatformRenderAdmissionError);
    expect(allocated).toBe(false); expect(page.allocator.entries()).toEqual(before);
  } finally { scope.dispose(); page.dispose(); }
});

it('rolls back a partially built stage after its resources are disposed and preserves unrelated claims', () => {
  const scope = new Scope('render-rollback'), allocator = new ResidencyAllocator(), admission = new PlatformRenderResidency(allocator, scope);
  const other = allocator.reserve({ id: 'library:home', category: 'library', owner: 'home', bytes: 100, distance: 0, needed: true });
  if (other === null) throw new Error('Fixture library refused');
  let cleaned = 0;
  try {
    expect(() => admission.allocate({ id: 'grain', jsBytes: 512, gpuBytes: 1024 }, (owner) => {
      owner.onDispose(() => { expect(allocator.has('platform:render:grain')).toBe(true); cleaned++; }); throw new Error('Texture upload failed');
    })).toThrow('Texture upload failed');
    expect(cleaned).toBe(1); expect(allocator.entries()).toMatchObject([{ id: 'library:home', bytes: 100 }]);
    admission.allocate({ id: 'grain', jsBytes: 512, gpuBytes: 1024 }, (owner) => { owner.onDispose(() => { cleaned++; }); });
    scope.dispose(); expect(cleaned).toBe(2); expect(allocator.entries()).toMatchObject([{ id: 'library:home', bytes: 100 }]);
  } finally { scope.dispose(); other.release(); }
});

it('refuses independent duplicate allocation, malformed costs and use after session teardown', () => {
  const scope = new Scope('render-invalid'), allocator = new ResidencyAllocator(), admission = new PlatformRenderResidency(allocator, scope);
  const plan = { id: 'void', jsBytes: 144, gpuBytes: 144 }; let calls = 0;
  const build = (): void => { calls++; };
  admission.allocate(plan, build);
  expect(() => admission.allocate(plan, build)).toThrow('already exists');
  for (const invalid of [{ ...plan, id: '' }, { ...plan, jsBytes: -1 }, { ...plan, gpuBytes: Number.NaN }, { ...plan, gpuBytes: 1.5 },
    { ...plan, jsBytes: Number.MAX_SAFE_INTEGER, gpuBytes: 1 }]) {
    expect(() => admission.allocate(invalid, build)).toThrow('Invalid platform render byte plan');
  }
  scope.dispose(); expect(() => admission.allocate(plan, build)).toThrow('disposed');
  expect(calls).toBe(1); expect(allocator.entries()).toEqual([]);
});

it('refunds the new claim if an eviction callback closes the session during admission', () => {
  const scope = new Scope('closing-render'), allocator = new ResidencyAllocator({ playing: 600_000_000 });
  const victim = allocator.reserve({ id: 'far:old', category: 'far', owner: 'old', bytes: 180_000_000, distance: 1000,
    needed: false, evictSync: () => { scope.dispose(); } });
  if (victim === null) throw new Error('Fixture far proxy refused');
  const admission = new PlatformRenderResidency(allocator, scope); let allocated = false;
  expect(() => admission.allocate({ id: 'roads', jsBytes: 25_000_000, gpuBytes: 25_000_000 }, () => { allocated = true; })).toThrow('disposed');
  expect(allocated).toBe(false); expect(allocator.entries()).toEqual([]); victim.release();
});

it('preserves construction and cleanup failures while still releasing its claim', () => {
  const scope = new Scope('render-cleanup-error'), allocator = new ResidencyAllocator(), admission = new PlatformRenderResidency(allocator, scope);
  let failure: unknown;
  try {
    admission.allocate({ id: 'grain', jsBytes: 512, gpuBytes: 1024 }, (owner) => {
      owner.onDispose(() => { throw new Error('Texture cleanup failed'); }); throw new Error('Texture upload failed');
    });
  } catch (error) { failure = error; }
  if (!(failure instanceof AggregateError)) throw new Error('Expected combined failure');
  expect(failure.errors[0]).toMatchObject({ message: 'Texture upload failed' });
  const cleanup: unknown = failure.errors[1];
  if (!(cleanup instanceof Error)) throw new Error('Expected cleanup error');
  expect(cleanup.message).toContain('Texture cleanup failed');
  expect(allocator.entries()).toEqual([]); scope.dispose();
});
