import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { runPrecompile, waitForDrawnFrame } from '../src/engine/render/precompile';
import { Scope } from '../src/engine/app/scope';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

async function uploads(isolated: boolean, cancel = false, pause?: () => Promise<void>): Promise<{ frames: number[]; failure: unknown }> {
  const prior = scopeEnvironment(), textures = Array.from({ length: 3 }, (_, index) => {
    const texture = new THREE.DataTexture(new Uint8Array([index, 2, 3, 255]), 1, 1);
    texture.name = `image-${String(index)}`; texture.needsUpdate = true;
    return texture;
  });
  const images = textures.map(texture => texture.image), versions = textures.map(texture => texture.version);
  const frames: number[] = []; let frame = 0, current = true, failure: unknown;
  installScopeEnvironment({ targetKind: () => 'other', frame: paint => {
    queueMicrotask(() => { frame++; if (cancel) current = false; paint(frame); }); return frame;
  }, cancelFrame: () => undefined });
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Expected renderer prototype');
  const commands = { extensions: { has: () => false }, info: { programs: [] },
    initTexture: (texture: THREE.Texture) => {
      expect(texture).toBe(textures[frames.length]);
      expect(texture.image).toBe(images[frames.length]);
      expect(texture.version).toBe(versions[frames.length]);
      frames.push(frame);
    } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  try {
    await runPrecompile(renderer, new THREE.PerspectiveCamera(), [], 0, undefined, textures, () => current, isolated, pause);
  } catch (error) { failure = error; }
  finally { installScopeEnvironment(prior); for (const texture of textures) texture.dispose(); }
  return { frames, failure };
}

it('isolates unchanged image textures into separate paint opportunities while the default batches them', async () => {
  const isolated = await uploads(true), ordinary = await uploads(false);
  expect(isolated.failure).toBeUndefined(); expect(isolated.frames).toEqual([0, 1, 2]);
  expect(ordinary.failure).toBeUndefined(); expect(ordinary.frames).toEqual([0, 0, 0]);
});

it('stops the image inventory after its owner retires at the first yield', async () => {
  const cancelled = await uploads(true, true);
  expect(cancelled.frames).toEqual([0]);
  expect(String(cancelled.failure)).toContain('Shader warm-up owner left');
});

it('uses the supplied live presentation barrier after every isolated image upload', async () => {
  const pause = vi.fn().mockResolvedValue(undefined), result = await uploads(true, false, pause);
  expect(result.failure).toBeUndefined(); expect(result.frames).toEqual([0, 0, 0]);
  expect(pause).toHaveBeenCalledTimes(3);
});

function presentation() {
  const prior = scopeEnvironment(), scope = new Scope('draw-barrier-test');
  const frames = new Map<number, FrameRequestCallback>(); let id = 0, drawn = 7, current = true;
  installScopeEnvironment({ targetKind: () => 'other', frame: paint => { frames.set(++id, paint); return id; },
    cancelFrame: key => { frames.delete(key); } });
  return { scope, wait: () => waitForDrawnFrame(scope, () => drawn, () => current),
    draw: () => { drawn++; }, supersede: () => { current = false; },
    raf: () => { const pending = [...frames.values()]; frames.clear(); for (const paint of pending) paint(16); },
    close: () => { scope.dispose(); installScopeEnvironment(prior); } };
}

it('holds preparation across skipped rAFs until a fresh game draw and its paint opportunity', async () => {
  vi.useFakeTimers(); const host = presentation(); let released = false;
  try {
    const waiting = (async () => { await host.wait(); released = true; })();
    host.raf(); host.raf(); await vi.runAllTimersAsync();
    expect(released).toBe(false); expect(host.scope.census.rafs).toBe(1);
    host.draw(); host.raf(); await Promise.resolve();
    expect(released).toBe(false); expect(host.scope.census.timers).toBe(1);
    await vi.runAllTimersAsync(); await waiting;
    expect(released).toBe(true);
    expect(host.scope.census).toMatchObject({ rafs: 0, timers: 0, disposers: 0 });
  } finally { host.close(); vi.useRealTimers(); }
});

it.each(['retire', 'supersede', 'retire-after-draw'] as const)('rejects the draw barrier on %s without retaining scheduling handles', async mode => {
  vi.useFakeTimers(); const host = presentation();
  try {
    const refusal = expect(host.wait()).rejects.toThrow('Shader warm-up owner left');
    if (mode === 'retire-after-draw') { host.draw(); host.raf(); }
    if (mode === 'supersede') { host.supersede(); host.raf(); } else host.scope.dispose();
    await refusal; await vi.runAllTimersAsync();
    expect(host.scope.census).toMatchObject({ rafs: 0, timers: 0, disposers: 0 });
  } finally { host.close(); vi.useRealTimers(); }
});
