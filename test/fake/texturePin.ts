import { installAppIdentity } from '../../src/engine/app/identity';
import { WILDSHARD_IDENTITY } from '../../src/game/identity';

/**
 * G386: a test's texture pin, as a capture's init script sets `window.__wildshardHarness.textures` before the boot (the
 * Debug ▸ GPU textures row is retired). `undefined` removes the pin: the shipped policy, what every player gets.
 */
export function pinTextures(textures: 'ktx2' | 'img' | undefined): void {
  installAppIdentity(textures === undefined ? WILDSHARD_IDENTITY : { ...WILDSHARD_IDENTITY, harness: () => ({ seed: 0, capture: null, textures }) });
}
