import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, MeshBasicMaterial, Texture, WebGLRenderTarget } from 'three';
import { Scope, AssetService } from '#engine/index';

const originalRaf = globalThis.requestAnimationFrame;
const originalCancelRaf = globalThis.cancelAnimationFrame;
afterEach(() => {
  vi.useRealTimers();
  vi.stubGlobal('requestAnimationFrame', originalRaf);
  vi.stubGlobal('cancelAnimationFrame', originalCancelRaf);
});

describe('scope ownership', () => {
  it('disposes in reverse order exactly once and counts real geometry/material/texture resources', () => {
    const scope = new Scope('test'), log: string[] = [];
    const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), texture = new Texture();
    geometry.addEventListener('dispose', () => { log.push('geometry'); });
    material.addEventListener('dispose', () => { log.push('material'); });
    texture.addEventListener('dispose', () => { log.push('texture'); });
    expect(scope.own(geometry)).toBe(geometry);
    scope.own(geometry);
    scope.own(material);
    scope.own(texture);
    scope.onDispose(() => { log.push('last'); });
    expect(scope.census).toMatchObject({ geometries: 1, materials: 1, textures: 1, disposers: 1 });
    const snapshot = scope.census;
    snapshot.geometries = 99;
    expect(scope.census.geometries).toBe(1);
    scope.dispose(); scope.dispose();
    expect(log).toEqual(['last', 'texture', 'material', 'geometry']);
    expect(Object.values(scope.census).every((count) => count === 0)).toBe(true);
  });

  it('classifies targets and meshes and removes only owned physics/audio handles', () => {
    const scope = new Scope('level'), log: string[] = [];
    const target = new WebGLRenderTarget();
    target.addEventListener('dispose', () => { log.push('target'); });
    scope.own(target);
    scope.own({ isInstancedMesh: true, dispose: () => { log.push('mesh'); } });
    scope.own({ dispose: () => { log.push('resource'); } });
    scope.ownBody({ remove: () => { log.push('body'); } });
    scope.ownSound({ stop: () => { log.push('stop'); }, disconnect: () => { log.push('disconnect'); } });
    expect(scope.census).toMatchObject({ renderTargets: 1, meshes: 1, resources: 1, bodies: 1, sounds: 1 });
    scope.dispose();
    expect(log).toEqual(['stop', 'disconnect', 'body', 'resource', 'mesh', 'target']);
  });

  it('owns children at their registration position, aggregates live counts, and detaches disposed children', () => {
    const parent = new Scope('parent'), log: string[] = [];
    parent.onDispose(() => { log.push('first'); });
    const child = parent.child('child');
    child.ownBody({ remove: () => { log.push('child'); } });
    parent.onDispose(() => { log.push('last'); });
    expect(parent.census.bodies).toBe(1);
    expect(parent.census.disposers).toBe(3);
    parent.dispose();
    expect(log).toEqual(['last', 'child', 'first']);
    expect(child.disposed).toBe(true);
    const alreadyClosed = parent.child('closed');
    expect(alreadyClosed.disposed).toBe(true);
    expect(Object.values(parent.census).every((count) => count === 0)).toBe(true);
    const another = new Scope('another'), detached = another.child('detached');
    detached.dispose();
    expect(another.census.disposers).toBe(0);
    another.dispose();
  });

  it('finishes all cleanup even when resources fail and immediately frees late ownership', () => {
    const scope = new Scope('test'), callback = vi.fn<() => void>();
    scope.onDispose(callback);
    scope.onDispose(() => { throw new Error('failed'); });
    scope.ownSound({ stop: () => { throw new Error('sound'); }, disconnect: callback });
    expect(() => scope.dispose()).toThrow(AggregateError);
    expect(callback).toHaveBeenCalledTimes(2);
    scope.dispose();
    scope.own({ dispose: callback });
    scope.onDispose(callback);
    expect(callback).toHaveBeenCalledTimes(4);
    expect(Object.values(scope.census).every((count) => count === 0)).toBe(true);
  });

  it('removes listeners and updates the census for once and aborted listeners', () => {
    const scope = new Scope('test'), target = new EventTarget(), listener = vi.fn<() => void>();
    scope.listen(target, 'test', listener);
    scope.listen(target, 'once', listener, { once: true });
    const abort = new AbortController();
    scope.listen(target, 'abort', listener, { signal: abort.signal });
    expect(scope.census.listeners).toBe(3);
    target.dispatchEvent(new Event('once'));
    target.dispatchEvent(new Event('once'));
    expect(scope.census.listeners).toBe(2);
    abort.abort();
    expect(scope.census.listeners).toBe(1);
    scope.listen(target, 'already', listener, { signal: abort.signal });
    expect(scope.census.listeners).toBe(1);
    target.dispatchEvent(new Event('test'));
    scope.dispose();
    scope.listen(target, 'closed', listener);
    for (const type of ['test', 'once', 'abort', 'already', 'closed']) target.dispatchEvent(new Event(type));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('removes completed timeout/raf counts and cancels pending timers and frames', () => {
    vi.useFakeTimers();
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      frameId++; frames.set(frameId, fn); return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
    const scope = new Scope('test'), timer = vi.fn<() => void>(), frame = vi.fn<() => void>();
    scope.timeout(5, timer);
    scope.interval(10, timer);
    scope.raf(frame);
    expect(scope.census).toMatchObject({ timers: 2, rafs: 1 });
    vi.advanceTimersByTime(5);
    expect(scope.census.timers).toBe(1);
    const pendingFrame = frames.get(1);
    frames.delete(1);
    pendingFrame?.(42);
    expect(frame).toHaveBeenCalledExactlyOnceWith(42);
    expect(scope.census.rafs).toBe(0);
    scope.raf(frame);
    scope.timeout(50, timer);
    vi.advanceTimersByTime(5);
    expect(timer).toHaveBeenCalledTimes(2);
    scope.dispose();
    scope.timeout(1, timer); scope.interval(1, timer); scope.raf(frame);
    vi.advanceTimersByTime(100);
    expect(timer).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(scope.census).toMatchObject({ timers: 0, rafs: 0 });
  });
});

describe('shared assets', () => {
  it('releases a scoped acquisition without disposing engine-retained resources', () => {
    const assets = new AssetService(), engine = new Scope('engine'), level = engine.child('level');
    const dispose = vi.fn<() => void>(), resource = { dispose };
    assets.register('shared', resource, { retain: true });
    expect(assets.acquire('shared')).toBe(resource);
    level.onDispose(() => assets.release('shared'));
    expect(assets.retained()).toEqual([{ key: 'shared', refs: 1, retained: true }]);
    level.dispose();
    expect(dispose).not.toHaveBeenCalled();
    expect(assets.retained()).toEqual([{ key: 'shared', refs: 0, retained: true }]);
    engine.dispose();
  });

  it('frees a nonretained asset only when its last acquisition is released', () => {
    const assets = new AssetService(), dispose = vi.fn<() => void>();
    assets.register('temporary', { dispose });
    assets.acquire('temporary'); assets.acquire('temporary');
    const snapshot = assets.retained();
    expect(snapshot).toEqual([{ key: 'temporary', refs: 2, retained: false }]);
    assets.release('temporary');
    expect(dispose).not.toHaveBeenCalled();
    expect(snapshot[0]?.refs).toBe(2);
    assets.release('temporary');
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(assets.retained()).toEqual([]);
    expect(() => assets.acquire('temporary')).toThrow('Unknown asset');
  });

  it('rejects missing keys, duplicate registrations, and unbalanced releases', () => {
    const assets = new AssetService(), resource = { dispose: vi.fn<() => void>() };
    assets.register('retained', resource, { retain: true });
    expect(() => assets.register('retained', resource)).toThrow('already registered');
    expect(() => assets.release('retained')).toThrow('no reference');
    expect(() => assets.release('missing')).toThrow('no reference');
    expect(() => assets.acquire('missing')).toThrow('Unknown asset');
    assets.acquire('retained'); assets.release('retained');
    expect(() => assets.release('retained')).toThrow('no reference');
    expect(resource.dispose).not.toHaveBeenCalled();
  });
});
