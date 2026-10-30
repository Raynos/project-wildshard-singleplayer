import { CompressedTexture, RenderTarget, Texture } from 'three';
import type { Renderer } from './renderer';

type Draw = Renderer['renderBufferDirect'];
type DrawTarget = Pick<Renderer, 'renderBufferDirect'>;
interface PropertyTarget { readonly properties: Pick<Renderer['properties'], 'get'> }

/** Renderer-local phases, in draw order. A material substitution encloses every
 * observer; admission precedes ownership, and only a successful submission can
 * retire CPU data. Registration never adds another renderer wrapper. */
interface DrawHooks {
  outer?: (draw: Draw, ...args: Parameters<Draw>) => void;
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
  const submit: Draw = (camera, scene, geometry, material, object, group) => {
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
  };
  renderer.renderBufferDirect = (camera, scene, geometry, material, object, group) => {
    if (hooks.outer === undefined) submit(camera, scene, geometry, material, object, group);
    else hooks.outer(submit, camera, scene, geometry, material, object, group);
  };
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
interface ResourceKind { texture: Texture | null; compressed: CompressedTexture | null; target: boolean }
const KIND = Symbol('renderer resource kind');
const frozenKinds = new WeakMap<object, ResourceKind>();
function resourceKind(resource: object): ResourceKind {
  const tagged: { readonly [KIND]?: ResourceKind } = resource;
  const known = tagged[KIND] ?? frozenKinds.get(resource);
  if (known !== undefined) return known;
  const kind: ResourceKind = { texture: resource instanceof Texture ? resource : null,
    compressed: resource instanceof CompressedTexture ? resource : null, target: resource instanceof RenderTarget };
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
    hooks.ownership?.(resource);
    const native: unknown = get(resource);
    if (compressed !== undefined && compressed !== null) hooks.compressed?.after(compressed, native);
    return hooks.labels === undefined || kind === undefined || (kind.texture === null && !kind.target) ? native : hooks.labels(resource, native);
  };
  return hooks;
}
