import { CompressedTexture, RenderTarget, Texture } from 'three';
import type { Renderer } from './renderer';

type Draw = Renderer['renderBufferDirect'];
type DrawTarget = Pick<Renderer, 'renderBufferDirect'>;
interface PropertyTarget { readonly properties: Pick<Renderer['properties'], 'get'> & Partial<Pick<Renderer['properties'], 'remove'>> }

/** Renderer-local phases, in draw order. A material substitution encloses every
 * observer; admission precedes ownership, and only a successful submission can
 * retire CPU data. Registration never adds another renderer wrapper. */
interface DrawHooks {
  outer?: (draw: Draw, ...args: Parameters<Draw>) => void;
  depth: number;
  generation: number;
  propertyEpoch: number;
  retire?: ((complete: boolean) => void) | undefined;
  labels?: Draw | undefined;
  material?: (...args: Parameters<Draw>) => Parameters<Draw>[3] | null;
  ownership?: { begin: Draw; end: () => void };
  memory?: Draw;
}

const draws = new WeakMap<object, DrawHooks>();

/** The sole engine renderBufferDirect hook. Keep the renderer's current target:
 * third-party draw adapters installed before us must still run. */
export function drawHooks(renderer: DrawTarget): DrawHooks {
  const installed = draws.get(renderer);
  if (installed !== undefined) return installed;
  const hooks: DrawHooks = { depth: 0, generation: 0, propertyEpoch: 0 };
  draws.set(renderer, hooks);
  const draw = renderer.renderBufferDirect.bind(renderer);
  const submit: Draw = (camera, scene, geometry, material, object, group) => {
    if (hooks.depth === 0) hooks.generation++;
    hooks.depth++; hooks.propertyEpoch++;
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
      hooks.depth--; hooks.propertyEpoch++;
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
interface PropertyObservation {
  texture: Texture | null;
  compressed: CompressedTexture | null;
  target: boolean;
  epoch: number;
  removal: number;
  version: number;
  sourceVersion: number;
  source: Texture['source'] | null;
}

/** One native property lookup, shared by allocation observers. The original
 * property identity reaches ownership/retirement before diagnostic proxies. */
export function propertyHooks(renderer: PropertyTarget): PropertyHooks {
  const installed = properties.get(renderer);
  if (installed !== undefined) return installed;
  const hooks: PropertyHooks = {};
  properties.set(renderer, hooks);
  const get = renderer.properties.get.bind(renderer.properties);
  const observations = new WeakMap<object, PropertyObservation>();
  let removal = 0;
  const remove = renderer.properties.remove?.bind(renderer.properties);
  if (remove !== undefined) renderer.properties.remove = resource => { removal++; remove(resource); };
  renderer.properties.get = (resource: unknown) => {
    if (typeof resource !== 'object' || resource === null) { hooks.ownership?.(resource); return get(resource); }
    let observed = observations.get(resource);
    if (observed === undefined) {
      const texture = isTexture(resource) ? resource : null;
      observed = { texture, compressed: isCompressed(resource) ? resource : null, target: resource instanceof RenderTarget,
        epoch: -1, removal: -1, version: -1, sourceVersion: -1, source: null };
      observations.set(resource, observed);
    }
    const texture = observed.texture, compressed = observed.compressed, drawing = draws.get(renderer);
    const epoch = drawing !== undefined && drawing.depth > 0 ? drawing.propertyEpoch : -1;
    // Repeated native reads in one submission have the same owner. Keep every
    // native lookup and diagnostic write, but observe its lifetime only once.
    // Nested draws, native removal and changed uploads all invalidate the pulse.
    const repeated = epoch >= 0 && observed.epoch === epoch && observed.removal === removal
      && (texture === null || (observed.version === texture.version && observed.source === texture.source && observed.sourceVersion === texture.source.version));
    if (!repeated) {
      if (texture !== null) hooks.texture?.(texture);
      if (compressed !== null) hooks.compressed?.before(compressed);
      hooks.ownership?.(resource);
    }
    // A callback can be registered during the native upload itself.
    if (texture !== null) hooks.uploaded?.(texture);
    const native: unknown = get(resource);
    if (!repeated) {
      if (compressed !== null) hooks.compressed?.after(compressed, native);
      observed.epoch = epoch; observed.removal = removal;
      if (texture !== null) { observed.version = texture.version; observed.source = texture.source; observed.sourceVersion = texture.source.version; }
    }
    return hooks.labels === undefined || (texture === null && !observed.target) ? native : hooks.labels(resource, native);
  };
  return hooks;
}
