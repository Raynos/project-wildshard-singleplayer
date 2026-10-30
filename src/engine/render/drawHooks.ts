import { CompressedTexture, Texture } from 'three';
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
const isTexture = (value: unknown): value is Texture => value instanceof Texture;
const isCompressed = (value: unknown): value is CompressedTexture => value instanceof CompressedTexture;

/** One native property lookup, shared by allocation observers. The original
 * property identity reaches ownership/retirement before diagnostic proxies. */
export function propertyHooks(renderer: PropertyTarget): PropertyHooks {
  const installed = properties.get(renderer);
  if (installed !== undefined) return installed;
  const hooks: PropertyHooks = {};
  properties.set(renderer, hooks);
  const get = renderer.properties.get.bind(renderer.properties);
  renderer.properties.get = (resource: unknown) => {
    const texture = isTexture(resource), compressed = texture && isCompressed(resource);
    if (texture) { hooks.texture?.(resource); hooks.uploaded?.(resource); }
    if (compressed) hooks.compressed?.before(resource);
    hooks.ownership?.(resource);
    const native: unknown = get(resource);
    if (compressed) hooks.compressed?.after(resource, native);
    return hooks.labels === undefined ? native : hooks.labels(resource, native);
  };
  return hooks;
}
