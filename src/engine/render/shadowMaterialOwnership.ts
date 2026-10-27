import { InstancedMesh, MeshDepthMaterial, MeshDistanceMaterial, SkinnedMesh, type Material, type Object3D } from 'three';
import type { Renderer } from './renderer';
import type { AssetService } from '../app/assets';
import type { Scope } from '../app/scope';
import { admitObjectDraw } from './drawGuards';

type ShadowRenderer = Pick<Renderer, 'renderBufferDirect'> & { shadowMap: Pick<Renderer['shadowMap'], 'render'> };

/**
 * js-heap H1: three's shadow pass draws every caster without a depth material of its own with ONE stock
 * MeshDepthMaterial. Plain, instanced and skinned casters ask it for different programs (its instancing and skinning
 * parameters), so it re-evaluated its program (getParameters, ~100 fields, and the key string) at every change of kind:
 * three times a frame on the idle Template, the page's biggest idle allocation. A classic caster that is instanced or
 * skinned now draws its shadow with a depth material shared by its kind (its first shadow draw assigns it as the
 * caster's `customDepthMaterial`), so each depth material always sees one kind. Program keys do not name the material,
 * so the kinds link the programs the stock material already had. Casters whose depth draw needs a per-material variant
 * (a map, alpha map, displacement or clipping planes) and node materials (their own depth variants) stay as they were.
 */
function depthKind(object: Object3D, depth: MeshDepthMaterial): string | null {
  const own: unknown = Reflect.get(object, 'material');
  const materials: readonly unknown[] = Array.isArray(own) ? own : [own];
  if (materials.some(m => typeof m === 'object' && m !== null && Reflect.get(m, 'isNodeMaterial') === true)) return null;
  if (depth.map !== null || depth.alphaMap !== null || depth.displacementMap !== null || (depth.clippingPlanes?.length ?? 0) > 0) return null;
  if (object instanceof InstancedMesh) return `instanced${object.instanceColor === null ? '' : '+colour'}${object.morphTexture === null ? '' : '+morph'}`;
  if (object instanceof SkinnedMesh) return 'skinned';
  return null;
}

/** Install after upload observation: native shadow cache materials must be registered before their first upload.
 * Offscreen precompile depths belong to the warm-up owner, never to the renderer cache. */
export function installShadowMaterialOwnership(renderer: ShadowRenderer, assets: AssetService, scope: Scope): void {
  let drawing = false;
  const kinds = new Map<string, MeshDepthMaterial>();
  const kindOf = (key: string): MeshDepthMaterial => {
    let kind = kinds.get(key);
    if (kind === undefined) {
      kind = new MeshDepthMaterial();
      kinds.set(key, kind);
      assets.register(`renderer:shadow-kind:${key}`, kind, { retain: true });
      const material: Material = kind;
      scope.listenOnceEmitter(material, 'dispose', () => { kinds.delete(key); assets.forgetDisposed(`renderer:shadow-kind:${key}`); });
    }
    return kind;
  };
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
    if (drawing && material instanceof MeshDepthMaterial && object.customDepthMaterial === undefined) {
      const kind = depthKind(object, material);
      if (kind !== null) object.customDepthMaterial = kindOf(kind);
    }
    draw(camera, scene, geometry, material, object, group);
  };
  renderer.shadowMap.render = (lights, scene, camera) => {
    const previous = drawing; drawing = true;
    try { shadows(lights, scene, camera); } finally { drawing = previous; }
  };
}
