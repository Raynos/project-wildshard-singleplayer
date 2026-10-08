import { afterEach, expect, it, vi } from 'vitest';
import { Scene, Texture } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import type { LookComposeContext } from '../../../src/engine/render/look';
import { skyReachLook } from '../../../src/shards/far-reach/look/render';
import { legacyDouble } from '../../fake/FakeGame';

const originalFetch = globalThis.fetch;
const originalBitmap = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalBitmap === undefined) Reflect.deleteProperty(globalThis, 'createImageBitmap');
  else Object.defineProperty(globalThis, 'createImageBitmap', originalBitmap);
  vi.restoreAllMocks();
});

function sources() {
  const close = vi.fn<() => void>(), disposed = vi.spyOn(Texture.prototype, 'dispose');
  globalThis.fetch = () => Promise.resolve(new Response(new Blob(['paint'])));
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true,
    value: () => Promise.resolve({ width: 4, height: 4, close } satisfies ImageBitmap) });
  return { close, disposed };
}

it('retires all four eager Sky look sources once when the regional frame never composes them', async () => {
  const { close, disposed } = sources();
  const look = await skyReachLook();
  expect(close).not.toHaveBeenCalled();
  look.dispose?.(); look.dispose?.();
  expect(disposed).toHaveBeenCalledTimes(4);
  expect(close).toHaveBeenCalledTimes(4);
});

it('transfers the eager sources to the composing scope before partial composition can fail', async () => {
  const { close, disposed } = sources(), scope = new Scope('standalone.look');
  const look = await skyReachLook();
  if (look.mode === 'replace') throw new Error('Sky look changed composition mode');
  const context = legacyDouble<LookComposeContext>({ scope, scene: new Scene(), engineChain: () => [] });
  // Deliberately fail at the first effect access after asset adoption; the real compose performs that transfer.
  Object.defineProperty(context, 'fx', { get: () => { throw new Error('Fixture effects failure'); } });
  expect(() => look.compose(context)).toThrow('Fixture effects failure');
  look.dispose?.();
  expect(disposed).not.toHaveBeenCalled();
  scope.dispose(); scope.dispose(); look.dispose?.();
  expect(disposed).toHaveBeenCalledTimes(4);
  expect(close).toHaveBeenCalledTimes(4);
});
