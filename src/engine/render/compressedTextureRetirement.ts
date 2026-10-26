import * as THREE from 'three';
import type { Renderer } from './renderer';
import { assertCompressedMipmapsUnchanged, finalizeCompressedMipmaps, immutableCompressedMipmaps } from './compressedMipmaps';

type DrawTarget = Pick<Renderer, 'properties' | 'renderBufferDirect'>;
const installed = new WeakMap<DrawTarget, WeakSet<THREE.Texture>>();

/** Observe completed first draws without importing upload scheduling or boot services.
 * Explicit immutable inputs need both native versions. Loader inputs keep their final-preparation fence. */
export function installCompressedTextureRetirement(renderer: DrawTarget): WeakSet<THREE.Texture> {
  let final = installed.get(renderer);
  if (final === undefined) { final = new WeakSet(); installed.set(renderer, final); observeDraws(renderer, final); }
  return final;
}

// A loader upload is not a draw: its caller may still change the sampler. Observe the
// textures Three actually binds, including shader-injected uniforms, and retire only
// after that first real draw succeeds. No source walk or second frame scheduler.
function observeDraws(renderer: DrawTarget, final: WeakSet<THREE.Texture>): void {
  const get = renderer.properties.get.bind(renderer.properties);
  const draw = renderer.renderBufferDirect.bind(renderer);
  const bound = new Set<THREE.Texture>();
  const retired = new WeakMap<THREE.Texture, unknown>();
  /** the draw each texture was last checked in: a draw asks for a bound texture's properties several times, and the
   *  retirement checks (its sampler fields, its allocation) need one look a draw (G639); outside a draw, every time */
  const checked = new WeakMap<THREE.Texture, number>();
  let depth = 0, drawGen = 0;
  renderer.properties.get = object => {
    if (object instanceof THREE.CompressedTexture) {
      // three's own lookup, once: it returns the same properties object every time (G639: a draw asks several times)
      if (depth > 0 && checked.get(object) === drawGen) { const properties: unknown = get(object); if (final.has(object) || immutableCompressedMipmaps(object)) bound.add(object); return properties; }
      if (depth > 0) checked.set(object, drawGen);
      assertCompressedMipmapsUnchanged(object);
      const native = retired.get(object);
      const properties: unknown = get(object);
      if (native !== undefined && (typeof properties !== 'object' || properties === null || Reflect.get(properties, '__webglTexture') !== native)) {
        throw new Error(`Compressed texture ${object.name || object.id} lost its allocation after mip retirement`);
      }
      if (depth > 0 && (final.has(object) || immutableCompressedMipmaps(object))) bound.add(object);
      return properties;
    }
    return get(object);
  };
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    if (depth === 0) drawGen++;
    depth++; let complete = false;
    try { draw(camera, scene, geometry, material, object, group); complete = true; }
    finally {
      depth--;
      if (depth === 0) {
        if (complete && bound.size > 0) for (const texture of bound) {
          const properties: unknown = get(texture);
          // A direct immutable draw has no earlier loader readiness fence. Retain
          // its bytes unless native texture and source versions both completed.
          if (immutableCompressedMipmaps(texture)) {
            const source: unknown = get(texture.source);
            if (typeof properties !== 'object' || properties === null || Reflect.get(properties, '__webglTexture') === undefined
              || Reflect.get(properties, '__version') !== texture.version || typeof source !== 'object' || source === null
              || Reflect.get(source, '__version') !== texture.source.version) continue;
          }
          if (typeof properties === 'object' && properties !== null) retired.set(texture, Reflect.get(properties, '__webglTexture'));
          finalizeCompressedMipmaps(texture); final.delete(texture);
        }
        bound.clear();
      }
    }
  };
}

