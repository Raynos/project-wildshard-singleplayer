import { InstancedMesh, Material, MeshDepthMaterial, MeshDistanceMaterial, SkinnedMesh, type Object3D } from 'three';
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
 * so the kinds link the programs the stock material already had. three copies each caster's own depth facts (map, alpha
 * map and test, side, clipping, displacement, wireframe) onto whatever depth material it draws, a custom one too, so a
 * kind is also keyed by those facts of the caster's material: the plan-end probe found every Template `family:pbr`
 * caster skipped, as its white filler map reached the stock material first. A caster whose depth three would give a
 * per-material variant (`WebGLShadowMap.getDepthMaterial`: a map or alpha map with an alpha test, displacement, shadow
 * clipping, alpha to coverage) and a vertex-moving graph (the graph back-end's own depth variant, `graphShadowDepth`)
 * stay as they were; a multi-material caster takes a kind only when every one of its materials has the same depth facts.
 */
function depthKind(object: Object3D): string | null {
  const own: unknown = Reflect.get(object, 'material');
  const materials: readonly unknown[] = Array.isArray(own) ? own : [own];
  const facts = materials.map(depthFacts);
  const first = facts[0];
  if (first === undefined || first === null || facts.some(fact => fact !== first)) return null;
  const base = object instanceof InstancedMesh ? `instanced${object.instanceColor === null ? '' : '+colour'}${object.morphTexture === null ? '' : '+morph'}`
    : object instanceof SkinnedMesh ? 'skinned' : null;
  return base === null ? null : `${base}|${first}`;
}

/** the depth facts three copies from a caster's material onto its depth material, or null where three gives that material
 *  a depth variant of its own (or the graph back-end does) */
function depthFacts(own: unknown): string | null {
  if (!(own instanceof Material)) return null;
  if (Reflect.get(own, 'isNodeMaterial') === true && own.userData['graphShadowDepth'] === true) return null;
  const field = (name: string): unknown => Reflect.get(own, name);
  const has = (name: string): boolean => { const value = field(name); return value !== null && value !== undefined; };
  const displacement = field('displacementScale');
  if ((has('displacementMap') && displacement !== 0) || ((has('map') || has('alphaMap')) && own.alphaTest > 0) || own.alphaToCoverage
    || (own.clipShadows && (own.clippingPlanes?.length ?? 0) > 0)) return null;
  const facts = [has('map') ? 'map' : '', has('alphaMap') ? 'alpha' : '', own.alphaTest > 0 ? 'test' : '', has('displacementMap') ? 'displace' : '',
    field('wireframe') === true ? 'wire' : '', `side${String(own.shadowSide ?? own.side)}`];
  return facts.filter(fact => fact !== '').join('+');
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
      assets.register(`renderer:shadow-kind:${key}`, kind, { retain: true, native: true });
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
      // native: three disposes a per-material depth variant with its source, maybe while a resident still leases it
      assets.register(key, material, { retain: true, native: true });
      scope.listenOnceEmitter(material, 'dispose', () => { assets.forgetDisposed(key); });
    }
    if (drawing && material instanceof MeshDepthMaterial && object.customDepthMaterial === undefined) {
      const kind = depthKind(object);
      if (kind !== null) object.customDepthMaterial = kindOf(kind);
    }
    draw(camera, scene, geometry, material, object, group);
  };
  renderer.shadowMap.render = (lights, scene, camera) => {
    const previous = drawing; drawing = true;
    try { shadows(lights, scene, camera); } finally { drawing = previous; }
  };
}
