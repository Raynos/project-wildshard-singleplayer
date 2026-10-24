import { MeshDepthMaterial, MeshDistanceMaterial } from 'three';
import type { Renderer } from './renderer';
import type { AssetService } from '../app/assets';
import type { Scope } from '../app/scope';
import { admitObjectDraw } from './drawGuards';

type ShadowRenderer = Pick<Renderer, 'renderBufferDirect'> & { shadowMap: Pick<Renderer['shadowMap'], 'render'> };
/** Install after upload observation: native shadow cache materials must be registered before their first upload.
 * Offscreen precompile depths belong to the warm-up owner, never to the renderer cache. */
export function installShadowMaterialOwnership(renderer: ShadowRenderer, assets: AssetService, scope: Scope): void {
  let drawing = false;
  const draw = renderer.renderBufferDirect.bind(renderer), shadows = renderer.shadowMap.render.bind(renderer.shadowMap);
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    if (!admitObjectDraw(camera, scene, geometry, material, object, group)) return;
    if (drawing && (material instanceof MeshDepthMaterial || material instanceof MeshDistanceMaterial) &&
      // asked by resource, not by key: a key string per shadow draw was garbage on every frame
      material !== object.customDepthMaterial && material !== object.customDistanceMaterial && !assets.isAcquired(material)) {
      const key = `renderer:shadow:${material.uuid}`;
      assets.register(key, material, { retain: true });
      scope.listenOnceEmitter(material, 'dispose', () => { assets.forgetDisposed(key); });
    }
    draw(camera, scene, geometry, material, object, group);
  };
  renderer.shadowMap.render = (lights, scene, camera) => {
    const previous = drawing; drawing = true;
    try { shadows(lights, scene, camera); } finally { drawing = previous; }
  };
}
