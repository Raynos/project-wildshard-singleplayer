import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { NodeFrame, NodeUpdateType, TextureNode } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { TextureUpdates } from '../src/engine/render/nodes/textureUpdates';

class Bitmap { readonly width = 0; }
vi.stubGlobal('ImageBitmap', Bitmap);
afterAll(() => { vi.unstubAllGlobals(); });

test('flip policy matches every image kind and keeps custom image getters live', () => {
  // Node has no DOM: only ImageBitmap identity affects this policy. Other image
  // fixtures keep their source shape without pretending to supply a GL upload.
  const bitmap = new Bitmap(), target = new THREE.Texture(bitmap);
  target.isRenderTargetTexture = true;
  const depth = new THREE.DepthTexture(4, 4), framebuffer = new THREE.FramebufferTexture(4, 4);
  const image = new THREE.Texture({ tagName: 'IMG', src: 'image.webp' });
  const canvas = new THREE.Texture({ tagName: 'CANVAS', width: 4, height: 4 });
  const data = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const compressed = new THREE.CompressedTexture([], 4, 4);
  const custom = new THREE.Texture();
  let borrowed: unknown = bitmap, reads = 0;
  Object.defineProperty(custom, 'image', { get: () => { reads++; return borrowed; } });
  const cases: readonly (readonly [string, THREE.Texture, boolean])[] = [
    ['target', target, true], ['depth', depth, true], ['framebuffer', framebuffer, true],
    ['bitmap', new THREE.Texture(bitmap), true], ['HTMLImage', image, false],
    ['canvas', canvas, false], ['data', data, false], ['compressed', compressed, false],
    ['custom getter', custom, true],
  ];
  const updates = new TextureUpdates(new NodeFrame());
  for (const [name, texture, bitmapFlip] of cases) {
    const sampler = new TextureNode(texture), flip = { value: false };
    sampler.updateType = NodeUpdateType.OBJECT; Reflect.set(sampler, '_flipYUniform', flip);
    for (const flipY of [true, false]) {
      texture.flipY = flipY;
      updates.update([sampler]);
      const alwaysFlip = texture === target || texture === depth || texture === framebuffer;
      expect(flip.value, `${name}, flipY=${String(flipY)}`).toBe(alwaysFlip || (bitmapFlip && flipY));
    }
  }
  expect(reads).toBeGreaterThan(0);
  const sampler = new TextureNode(custom), flip = { value: false };
  sampler.updateType = NodeUpdateType.OBJECT; Reflect.set(sampler, '_flipYUniform', flip);
  custom.flipY = true; updates.update([sampler]); expect(flip.value).toBe(true);
  borrowed = image.image; updates.update([sampler]); expect(flip.value).toBe(false);
  for (const [, texture] of cases) texture.dispose();
});

test('flip-only static samples avoid unused matrix work while UV and object reads stay live per draw', () => {
  const depth = new THREE.DepthTexture(4, 4), ordinary = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const sampler = new TextureNode(depth), flip = { value: false };
  Reflect.set(sampler, '_flipYUniform', flip); sampler.updateType = NodeUpdateType.OBJECT;
  const depthMatrix = vi.spyOn(depth, 'updateMatrix');
  const transformed = new TextureNode(ordinary), transform = { value: new THREE.Matrix3() };
  Reflect.set(transformed, '_matrixUniform', transform); transformed.updateType = NodeUpdateType.OBJECT;
  const uvMatrix = vi.spyOn(ordinary, 'updateMatrix');
  const seen: number[] = [], objectRead = uniform(0).onObjectUpdate(frame => { seen.push(frame.object?.position.x ?? -1); return seen.length; });
  const material = new THREE.MeshBasicMaterial(), geometry = new THREE.PlaneGeometry();
  const frame = new NodeFrame();
  const nodes = [sampler, objectRead, transformed], start = frame.renderId;
  const textures = new TextureUpdates(frame), update = (): void => { textures.update(nodes); };
  try {
    for (const x of [2, 7, 11]) {
      const object = new THREE.Mesh(geometry, material); object.position.x = x;
      frame.object = object; frame.material = material;
      update();
      expect(flip.value).toBe(x !== 7);
      sampler.value = x === 2 ? ordinary : depth; // same-frame retargets must not be cached away.
    }
    expect(seen).toEqual([2, 7, 11]);
    expect(frame.renderId - start).toBe(3);
    expect(depthMatrix).not.toHaveBeenCalled();
    expect(uvMatrix).toHaveBeenCalledTimes(3);
    expect(transform.value).toBe(ordinary.matrix);
    const other = new TextureNode(depth), otherFlip = {value: true};
    other.referenceNode = sampler; other.updateType = NodeUpdateType.OBJECT;
    Reflect.set(other, '_flipYUniform', otherFlip);
    const retarget = uniform(0).onObjectUpdate(() => {sampler.value = ordinary; return 0;});
    textures.update([sampler, retarget, other]);
    expect(flip.value).toBe(true); expect(otherFlip.value).toBe(false);

    // Explicit frame scheduling still uses the stock node dispatcher.
    sampler.updateType = NodeUpdateType.FRAME; sampler.value = ordinary;
    ordinary.isRenderTargetTexture = true; frame.frameId++; update();
    expect(flip.value).toBe(true);
    ordinary.isRenderTargetTexture = false; update();
    expect(flip.value).toBe(true);
    frame.frameId++; update(); expect(flip.value).toBe(false);
    expect(depthMatrix).not.toHaveBeenCalled();
    sampler.updateType = NodeUpdateType.OBJECT; sampler.value = depth;
    // A later builder can add a UV matrix to a previously flip-only node.
    Reflect.set(sampler, '_matrixUniform', { value: new THREE.Matrix3() });
    update();
    expect(depthMatrix).toHaveBeenCalledOnce();
  } finally { depthMatrix.mockRestore(); uvMatrix.mockRestore(); geometry.dispose(); material.dispose(); depth.dispose(); ordinary.dispose(); }
});
