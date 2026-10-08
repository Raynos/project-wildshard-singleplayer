import { expect, it, vi } from 'vitest';
import { DataTexture, Group, Scene, Texture } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { rebakeGpuContent } from '../../../src/engine/core/gpuOnly';
import { StaticBake, bakeUniforms } from '../../../src/shards/nalati-grasslands/look/bake';
import { fakeWorld } from '../../fake/world';

it('retires the actual bake global, caster roots, shared sampler and GPU-recovery callback over two entries', () => {
  const window = {}; vi.stubGlobal('window', window);
  try {
    for (let visit = 0; visit < 2; visit++) {
      const scope = new Scope('look'), canvas = {}, caster = new Group(); caster.userData['canvas'] = canvas;
      const height = new DataTexture(), bake = new StaticBake(fakeWorld().game.asGame().renderer, new Scene(), height, scope);
      bake.add(caster);
      const invalidate = vi.spyOn(bake, 'invalidate');
      expect(Reflect.get(window, '__bake')).toBe(bake);
      expect(bakeUniforms.tBakeShadow.value).toBeInstanceOf(Texture);
      rebakeGpuContent(); expect(invalidate).toHaveBeenCalledOnce();
      scope.dispose();
      expect(Object.hasOwn(window, '__bake')).toBe(false);
      expect(Reflect.get(bake, 'roots')).toEqual([]);
      expect(bakeUniforms.tBakeShadow.value).toBeNull(); expect(bakeUniforms.tBakeContact.value).toBeNull();
      rebakeGpuContent(); expect(invalidate).toHaveBeenCalledOnce(); height.dispose();
    }
  } finally { vi.unstubAllGlobals(); }
});
