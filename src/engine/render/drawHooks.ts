import { BatchedMesh, BufferGeometry, CompressedTexture, InstancedMesh, Material, MeshDepthMaterial, MeshDistanceMaterial, RenderTarget, Texture } from 'three';
import type { Renderer } from './renderer';

type Draw = Renderer['renderBufferDirect'];
type ShadowDraw = (draw: Draw, camera: Parameters<Draw>[0], scene: Parameters<Draw>[1], geometry: Parameters<Draw>[2],
  material: MeshDepthMaterial | MeshDistanceMaterial, object: Parameters<Draw>[4], group: Parameters<Draw>[5]) => void;
type DrawTarget = Pick<Renderer, 'renderBufferDirect'>;
interface PropertyTarget { readonly properties: Pick<Renderer['properties'], 'get'> }

/** Renderer-local phases, in draw order. A material substitution encloses every
 * observer; admission precedes ownership, and only a successful submission can
 * retire CPU data. Registration never adds another renderer wrapper. */
interface DrawHooks {
  shadow?: ShadowDraw;
  depth: number;
  generation: number;
  retire?: ((complete: boolean) => void) | undefined;
  labels?: Draw | undefined;
  material?: (...args: Parameters<Draw>) => Parameters<Draw>[3] | null;
  ownership?: { begin: Draw; end: () => void };
  memory?: Draw;
}

const draws = new WeakMap<DrawTarget, DrawHooks>();

/** The sole engine renderBufferDirect hook. Keep the renderer's current target:
 * third-party draw adapters installed before us must still run. */
export function drawHooks(renderer: DrawTarget): DrawHooks {
  const installed = draws.get(renderer);
  if (installed !== undefined) return installed;
  const hooks: DrawHooks = { depth: 0, generation: 0 };
  draws.set(renderer, hooks);
  const draw = renderer.renderBufferDirect.bind(renderer);
  let continuation = false;
  const continueShadow: Draw = (camera, scene, geometry, material, object, group) => {
    continuation = true; submit(camera, scene, geometry, material, object, group);
  };
  function submit(camera: Parameters<Draw>[0], scene: Parameters<Draw>[1], geometry: Parameters<Draw>[2],
    material: Parameters<Draw>[3], object: Parameters<Draw>[4], group: Parameters<Draw>[5]): void {
    // Consume this continuation before entering native draw code: any nested
    // cast still takes its own shadow substitution and restores its own state.
    const continued = continuation; continuation = false;
    const shadow = continued || hooks.shadow === undefined ? null : resourceKind(material).shadow;
    if (shadow !== null && hooks.shadow !== undefined) {
      hooks.shadow(continueShadow, camera, scene, geometry, shadow, object, group); return;
    }
    if (hooks.depth === 0) hooks.generation++;
    hooks.depth++;
    let complete = false;
    try {
      hooks.labels?.(camera, scene, geometry, material, object, group);
      const selected = hooks.material === undefined ? material : hooks.material(camera, scene, geometry, material, object, group);
      if (selected !== null) {
        try {
          hooks.ownership?.begin(camera, scene, geometry, selected, object, group);
          draw(camera, scene, geometry, selected, object, group);
        } finally { hooks.ownership?.end(); }
      }
      complete = true;
    } finally {
      hooks.depth--;
      if (hooks.depth === 0 && hooks.retire !== undefined) {
        const retire = hooks.retire; hooks.retire = undefined; retire(complete);
      }
    }
    hooks.memory?.(camera, scene, geometry, material, object, group);
  }
  renderer.renderBufferDirect = submit;
  return hooks;
}

interface PropertyHooks {
  texture?: (resource: Texture) => void;
  uploaded?: (resource: Texture) => void;
  compressed?: { before: (resource: CompressedTexture) => void; after: (resource: CompressedTexture, properties: unknown) => void };
  ownership?: (resource: unknown) => void;
  labels?: (resource: unknown, properties: unknown) => unknown;
}
const properties = new WeakMap<PropertyTarget, PropertyHooks>();
interface ResourceKind { texture: Texture | null; compressed: CompressedTexture | null; target: boolean; owned: boolean; shadow: MeshDepthMaterial | MeshDistanceMaterial | null }
const KIND = Symbol('renderer resource kind');
const frozenKinds = new WeakMap<object, ResourceKind>();
function resourceKind(resource: object): ResourceKind {
  const tagged: { readonly [KIND]?: ResourceKind } = resource;
  const known = tagged[KIND] ?? frozenKinds.get(resource);
  if (known !== undefined) return known;
  const texture = resource instanceof Texture ? resource : null, target = resource instanceof RenderTarget;
  const kind: ResourceKind = { texture, compressed: resource instanceof CompressedTexture ? resource : null, target,
    shadow: resource instanceof MeshDepthMaterial || resource instanceof MeshDistanceMaterial ? resource : null,
    owned: texture !== null || target || resource instanceof BufferGeometry || resource instanceof Material || resource instanceof InstancedMesh || resource instanceof BatchedMesh };
  // This immutable, non-enumerable record holds only its own resource. It has
  // no renderer, callback or Scope edge, so it cannot extend their lifetimes.
  if (Object.isExtensible(resource)) Object.defineProperty(resource, KIND, { value: kind });
  else frozenKinds.set(resource, kind);
  return kind;
}

/** One native property lookup, shared by allocation observers. The original
 * property identity reaches ownership/retirement before diagnostic proxies. */
export function propertyHooks(renderer: PropertyTarget): PropertyHooks {
  const installed = properties.get(renderer);
  if (installed !== undefined) return installed;
  const hooks: PropertyHooks = {};
  properties.set(renderer, hooks);
  const get = renderer.properties.get.bind(renderer.properties);
  renderer.properties.get = (resource: unknown) => {
    const kind = typeof resource === 'object' && resource !== null ? resourceKind(resource) : undefined;
    const texture = kind?.texture, compressed = kind?.compressed;
    if (texture !== undefined && texture !== null) { hooks.texture?.(texture); hooks.uploaded?.(texture); }
    if (compressed !== undefined && compressed !== null) hooks.compressed?.before(compressed);
    // Native Source/camera/object metadata is not a disposable upload. The
    // ownership consumer previously repeated six class checks to ignore it.
    if (kind?.owned === true) hooks.ownership?.(resource);
    const native: unknown = get(resource);
    if (compressed !== undefined && compressed !== null) hooks.compressed?.after(compressed, native);
    return hooks.labels === undefined || kind === undefined || (kind.texture === null && !kind.target) ? native : hooks.labels(resource, native);
  };
  return hooks;
}
