import { afterEach, expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, MeshStandardMaterial } from 'three';
import { AssetService } from '../src/engine/app/assets';
import { Scope } from '../src/engine/app/scope';
import { initializeTier, TIER } from '../src/engine/core/tier';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { AssetResidencyBridge } from '../src/game/grid/assetResidency';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { MemoryAdmission } from '../src/format/product';
import { staticGlb } from '../src/sdk/bake/glb';
import { readWorldSceneGeometry } from '../src/game/shardfile/worldSceneGeometry';

const originalTier = TIER;
afterEach(() => { initializeTier(originalTier); vi.restoreAllMocks(); });
function fixture(limit = 10000) {
  const source = new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  source.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  source.setAttribute('uv', new BufferAttribute(new Float32Array(6), 2));
  const material = new MeshStandardMaterial();
  const bytes = staticGlb([{ geometry: source, material, nativeAttributes: true }]);
  source.dispose(); material.dispose();
  const file = vi.fn((_name: string) => Promise.resolve(bytes));
  const product = { url: (name: string) => `/blobs/fixture/${name}`, file };
  const assets = new AssetService<BufferGeometry>();
  const allocator = new ResidencyAllocator({ playing: CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + Math.ceil(limit * CONTENT_CAPS.residentFactor), memory: new MemoryAdmission() });
  const bridge = new AssetResidencyBridge(allocator, geometry => {
    if (!(geometry instanceof BufferGeometry)) throw new Error('Expected fixture geometry');
    const attribute: unknown = geometry.getAttribute('position');
    if (!(attribute instanceof BufferAttribute)) throw new Error('Missing fixture position');
    return [{ identity: attribute.array.buffer, bytes: attribute.array.byteLength, kind: 'cpu' },
      { identity: attribute, bytes: attribute.array.byteLength, kind: 'gpu' }];
  });
  const detach = assets.bindResidency(bridge);
  return { assets, product, allocator, bytes, close: () => {
    for (const row of assets.retained()) assets.evictCached(row.key);
    detach(); bridge.dispose();
  } };
}
const row = { file: 'fixed.glb' };

test('re-entry skips decoding but every consumer gets a private deep copy and its own lease', async () => {
  const f = fixture(), first = new Scope('first'), second = new Scope('second');
  const a = await readWorldSceneGeometry(first, f.product, row, f.assets);
  const b = await readWorldSceneGeometry(second, f.product, row, f.assets);
  expect(f.product.file).toHaveBeenCalledTimes(1);
  expect(f.assets.retained().map(entry => entry.refs)).toEqual([2]);
  expect(f.allocator.cost().input.commons).toBe(72);
  const copyA = a.copy(), copyB = b.copy();
  expect(copyA.getAttribute('position').array.buffer).not.toBe(copyB.getAttribute('position').array.buffer);
  copyA.getAttribute('position').setX(0, 99);
  expect(copyB.getAttribute('position').getX(0)).toBe(0);
  a.done(); a.done(); first.dispose();
  expect(() => a.copy()).toThrow('disposed');
  expect(f.assets.retained().map(entry => entry.refs)).toEqual([1]);
  second.dispose(); b.done(); expect(f.assets.retained().map(entry => entry.refs)).toEqual([0]);
  const third = new Scope('third'), c = await readWorldSceneGeometry(third, f.product, row, f.assets);
  const copyC = c.copy(); expect(copyC.getAttribute('position').getX(0)).toBe(0);
  expect(f.product.file).toHaveBeenCalledTimes(1);
  c.done(); expect(() => c.copy()).toThrow('finished'); third.dispose();
  copyA.dispose(); copyB.dispose(); copyC.dispose(); f.close();
  expect(f.allocator.cost().input.commons).toBe(0);
});

test('content, tier, segment order and sorted channel mappings identify completed templates', async () => {
  const f = fixture(), scope = new Scope('profiles');
  initializeTier('phone');
  const declarations = [row, { file: 'changed.glb' },
    { ...row, segments: ['a.glb', 'b.glb'] }, { ...row, segments: ['b.glb', 'a.glb'] },
    { ...row, attributes: { normal: 'customNormal', uv: 'customUv' } }];
  for (const declaration of declarations) (await readWorldSceneGeometry(scope, f.product, declaration, f.assets)).done();
  initializeTier('desktop'); (await readWorldSceneGeometry(scope, f.product, row, f.assets)).done();
  expect(f.assets.retained()).toHaveLength(6);
  const reads = f.product.file.mock.calls.length;
  initializeTier('phone'); (await readWorldSceneGeometry(scope, f.product, { ...row, attributes: {} }, f.assets)).done();
  (await readWorldSceneGeometry(scope, f.product, { ...row, attributes: { uv: 'customUv', normal: 'customNormal' } }, f.assets)).done();
  expect(f.product.file).toHaveBeenCalledTimes(reads);
  scope.dispose(); f.close();
});

test('pressure refuses a live lease, then evicts idle storage and invalidates the decoder memo', async () => {
  const f = fixture(80), scope = new Scope('live');
  const a = await readWorldSceneGeometry(scope, f.product, row, f.assets);
  expect(f.allocator.reserve({ id: 'pressure', owner: 'platform', category: 'commons', bytes: 72, needed: true, distance: 0 })).toBeNull();
  a.done(); scope.dispose();
  const pressure = f.allocator.reserve({ id: 'pressure', owner: 'platform', category: 'commons', bytes: 72, needed: true, distance: 0 });
  expect(pressure).not.toBeNull(); expect(f.assets.retained()).toEqual([]); pressure?.release();
  const next = new Scope('next'); (await readWorldSceneGeometry(next, f.product, row, f.assets)).done();
  expect(f.product.file).toHaveBeenCalledTimes(2);
  next.dispose(); f.close();
});

test('cancelled readers neither publish nor strand a live claim, and concurrent readers share only completed geometry', async () => {
  const f = fixture(), cancelled = new Scope('cancelled'), live = new Scope('live');
  let release = (): void => undefined;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const product = { ...f.product, file: async (name: string) => { await wait; return f.product.file(name); } };
  const abandoned = readWorldSceneGeometry(cancelled, product, row, f.assets);
  const rejected = expect(abandoned).rejects.toThrow('disposed');
  const pending = readWorldSceneGeometry(live, product, row, f.assets);
  cancelled.dispose(); release(); await rejected;
  const held = await pending;
  expect(f.assets.retained().map(entry => entry.refs)).toEqual([1]);
  held.done(); live.dispose(); f.close();
});

test('concurrent cold readers do not retain duplicate templates', async () => {
  const f = fixture(), a = new Scope('a'), b = new Scope('b');
  const leases = await Promise.all([readWorldSceneGeometry(a, f.product, row, f.assets), readWorldSceneGeometry(b, f.product, row, f.assets)]);
  expect(f.assets.retained().map(entry => entry.refs)).toEqual([2]);
  expect(f.allocator.cost().input.commons).toBe(72);
  for (const held of leases) held.done(); a.dispose(); b.dispose(); f.close();
});

test('retiring ancestors refuse reads and acquisitions; malformed decode and refused claims leave no retained build', async () => {
  const f = fixture(), ancestor = new Scope('retiring'), child = ancestor.child('child');
  ancestor.onDispose(() => undefined); const steps = ancestor.disposeSteps(); steps.next();
  const acquire = vi.spyOn(f.assets, 'acquireResource');
  await expect(readWorldSceneGeometry(child, f.product, row, f.assets)).rejects.toThrow('retiring');
  expect(f.product.file).not.toHaveBeenCalled(); expect(acquire).not.toHaveBeenCalled();
  for (const step of steps) void step;
  const failed = new Scope('failed');
  await expect(readWorldSceneGeometry(failed, { ...f.product, file: () => Promise.resolve(new Uint8Array(1)) }, row, f.assets)).rejects.toThrow();
  const register = vi.spyOn(f.assets, 'register').mockImplementation(() => { throw new Error('Refused fixture allocation'); });
  await expect(readWorldSceneGeometry(failed, f.product, row, f.assets)).rejects.toThrow('Refused fixture allocation');
  expect(f.assets.retained()).toEqual([]); expect(f.allocator.entries()).toEqual([]);
  register.mockRestore(); failed.dispose(); f.close();
});
