import { expect, it } from 'vitest';
import * as THREE from 'three';
import { runPrecompile } from '../src/engine/render/precompile';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

async function uploads(isolated: boolean, cancel = false): Promise<{ frames: number[]; failure: unknown }> {
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
    await runPrecompile(renderer, new THREE.PerspectiveCamera(), [], 0, undefined, textures, () => current, isolated);
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
