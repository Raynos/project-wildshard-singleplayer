import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { NodeFrame, NodeUpdateType, TextureNode } from 'three/webgpu';
import { uniform } from 'three/tsl';
import { TextureUpdates } from '../src/engine/render/nodes/textureUpdates';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

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
