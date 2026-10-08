import { expect, it, vi } from 'vitest';
import { AssetService } from '../../src/engine/app/assets';
import { Scope } from '../../src/engine/app/scope';
import { withOwner } from '../../src/engine/app/ownership';

it('injects accounting only for explicit cached resources, replaying pre-existing caches and releasing actual retirements', () => {
  const assets = new AssetService(), cached = { dispose: vi.fn() }, engine = { dispose: vi.fn() };
  assets.register('cached', cached, { retain: true, cache: true });
  assets.register('engine', engine, { retain: true });
  const observe = vi.fn(), release = vi.fn(), register = vi.fn(() => ({ observe, release }));
  const detach = assets.bindResidency({ register });
  expect(register).toHaveBeenCalledOnce(); expect(register.mock.calls[0]?.slice(0, 2)).toEqual(['cached', cached]);
  const scope = new Scope('draw'); assets.observeResidency(cached, scope);
  expect(observe).toHaveBeenCalledWith(scope);
  assets.forgetDisposed('cached'); expect(release).toHaveBeenCalledOnce();
  detach(); expect(release).toHaveBeenCalledOnce(); expect(engine.dispose).not.toHaveBeenCalled();
});

it('captures synchronous registration ownership and rolls back a refused bridge without losing the resource', () => {
  const assets = new AssetService(), scope = new Scope('resident'), resource = { dispose: vi.fn() };
  const register = vi.fn((_key: string, _resource: object, _owner: Scope | null) => { throw new Error('refused'); });
  const detach = assets.bindResidency({ register });
  expect(() => withOwner(scope, () => assets.register('cached', resource, { retain: true, cache: true }))).toThrow('refused');
  expect(assets.has('cached')).toBe(false); expect(assets.isAcquired(resource)).toBe(false);
  expect(register).toHaveBeenCalledWith('cached', resource, scope, expect.any(Function));
  detach(); assets.register('cached', resource, { retain: true, cache: true });
  expect(assets.has('cached')).toBe(true); expect(resource.dispose).not.toHaveBeenCalled();
});

it('refuses eviction while acquired and keeps a failed native disposal charged', () => {
  const assets = new AssetService(), release = vi.fn<() => void>(), dispose = vi.fn<() => void>();
  assets.bindResidency({ register: () => ({ observe: () => undefined, release }) });
  const resource = { dispose }; assets.register('cache', resource, { retain: true, cache: true });
  assets.acquire('cache'); expect(assets.evictCached('cache')).toBe(false); expect(dispose).not.toHaveBeenCalled();
  assets.release('cache'); dispose.mockImplementationOnce(() => { throw new Error('native failed'); });
  expect(() => assets.evictCached('cache')).toThrow('native failed'); expect(assets.has('cache')).toBe(true); expect(release).not.toHaveBeenCalled();
  expect(assets.evictCached('cache')).toBe(true); expect(assets.has('cache')).toBe(false); expect(release).toHaveBeenCalledOnce();
});
