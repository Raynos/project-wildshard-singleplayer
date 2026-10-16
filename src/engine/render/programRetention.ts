import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, type Camera, type Scene } from 'three';
import type { Scope } from '../app/scope';
import type { Renderer } from './renderer';

/** A native program-cache reference, independent of geometry, textures and live material uniforms. */
export interface ProgramReference { readonly cacheKey: string; usedTimes: number }
export const RETAINED_PROGRAM_LIMIT = 512;
/** Conservative admission estimate; native driver storage remains a measured, report-only quantity. */
export const RETAINED_PROGRAM_BYTES = 256 * 1024;

/** Add one material-owned reference per unique compiled key. Preflight before changing any reference count. */
export function pinProgramReferences(held: Map<string, ProgramReference>, programs: readonly ProgramReference[]): number {
  const unique = new Map(programs.map(program => [program.cacheKey, program]));
  const added = [...unique].filter(([key]) => !held.has(key));
  if (held.size + added.length > RETAINED_PROGRAM_LIMIT) throw new Error('Loading program inventory exceeds its bound');
  for (const [key, program] of unique) {
    if (!Number.isSafeInteger(program.usedTimes) || program.usedTimes < 1 || held.has(key) && held.get(key) !== program) throw new Error('Invalid loading program reference');
  }
  for (const [key, program] of added) { program.usedTimes += 1; held.set(key, program); }
  return held.size;
}

function programMap(value: unknown): value is Map<string, ProgramReference> {
  if (!(value instanceof Map)) return false;
  const entries: Iterable<[unknown, unknown]> = value.entries();
  for (const [key, program] of entries) {
    if (typeof key !== 'string' || typeof program !== 'object' || program === null
      || Reflect.get(program, 'cacheKey') !== key || typeof Reflect.get(program, 'usedTimes') !== 'number') return false;
  }
  return true;
}

/** Keep warm programs through temporary-world retirement. Three's ordinary material disposal releases both its
 * program array AND key map; never destroy native handles or mutate the renderer's cache lists ourselves.
 * Call only for the reload-only loading experiment, before any temporary content owner is allocated. */
export function retainRendererPrograms(renderer: Renderer, owner: Scope, camera: Camera, scene: Scene): { capture: () => number } {
  if (owner.disposed) throw new Error('Loading programs require a live page owner');
  const holder = owner.own(new MeshBasicMaterial()), geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  try { renderer.compile(new Mesh(geometry, holder), camera, scene); } finally { geometry.dispose(); }
  const properties: unknown = Reflect.get(renderer, 'properties');
  const get: unknown = typeof properties === 'object' && properties !== null ? Reflect.get(properties, 'get') : undefined;
  const data: unknown = typeof get === 'function' ? Reflect.apply(get, properties, [holder]) : undefined;
  const held: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'programs') : undefined;
  if (!programMap(held)) throw new Error('Renderer lacks its ordinary material program owner');
  return { capture: () => {
    if (owner.disposed) throw new Error('Loading program owner left');
    return pinProgramReferences(held, renderer.info.programs ?? []);
  } };
}
