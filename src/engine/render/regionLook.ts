/**
 * A level look's light model and fog scoped to one subtree of the page (SHARD-PLATFORM SF63): a grid region's materials
 * compile with its own level's `LookStrategy.lighting` / `fog` while every other material on the page keeps the page's.
 *
 * Why per-material chunk overrides (and not a frame-level switch or a recompiled page): a look's lighting and fog are
 * whole-chunk writes on three's global `ShaderChunk` (toon bands in `lights_physical_pars_fragment`, a ramp or painted
 * fog in `fog_*`), installed once per page before anything compiles. Rewriting the globals at cell entry would recompile
 * every program on the page (the road, the neighbours, the viewmodel) behind a screen on each crossing, and the next
 * neighbour drawn in the same frame would take the wrong look. Instead:
 *
 * 1. `captureLookChunks` runs the level's installs once in a sandbox: it snapshots `ShaderChunk` and the page's fog
 *    uniform list, runs the installs, keeps every chunk they changed and every fog uniform set they added, and puts the
 *    page's chunks and list back exactly. Cached per level id (a look's installs guard themselves to run once a page).
 * 2. `scopeLookChunks` patches each material under the region's root (a `patchShader` entry, last in the chain, so a
 *    material's own `#include <fog_fragment>` edits still land first): every `#include <chunk>` the overrides reach is
 *    inlined with the region's text, the captured fog uniforms are bound on that shader, and its program key gains
 *    `|look:<id>` (a region-keyed program variant: the same material type under the page look keeps its own program).
 *    A material that reaches no overridden chunk (or only fog chunks with `fog: false`) is left alone: no new program.
 *    Materials the asset cache shares (`isShared`) are left alone too (another region may draw them).
 *
 * The page's programs and chunk text never change, so a page booted as the level itself (SHARD SELECT) is untouched.
 * The patches leave with the region's scope. Generic engine code (E405): no level is named here.
 */
import * as THREE from 'three';
import type { Scope } from '../app/scope';
import { captureFogUniforms } from '../world/Atmosphere';
import { PATCH_ORDER, patchShader, type ShaderSource } from './shaderPatches';
import type { FogModel, LightingRig } from './look';

/** A level look's chunk text and fog uniforms, as its installs would have left them on the page now. */
export interface LookChunks {
  readonly id: string;
  /** chunk name → the region's text (only the chunks the installs changed) */
  readonly chunks: Readonly<Record<string, string>>;
  /** the uniform sets its installs added to the fog uniforms (`addFogUniforms`) */
  readonly uniforms: readonly Readonly<Record<string, THREE.IUniform>>[];
}

const captured = new Map<string, LookChunks | null>();
/** three's chunk table, read and written by name (its type lists the shipped names only) */
const readChunk = (name: string): string | undefined => { const text: unknown = Reflect.get(THREE.ShaderChunk, name); return typeof text === 'string' ? text : undefined; };
const chunkNames = (): string[] => Object.keys(THREE.ShaderChunk);

/**
 * Run the look's light model and fog installs in a sandbox and return what they changed (null: they changed nothing,
 * e.g. the page already runs the same look). The page's `ShaderChunk` and fog uniform list are restored exactly.
 */
export function captureLookChunks(id: string, look: { readonly lighting?: LightingRig; readonly fog?: FogModel }): LookChunks | null {
  const known = captured.get(id);
  if (known !== undefined) return known;
  const before = new Map(chunkNames().map((name) => [name, readChunk(name)]));
  let uniforms: Record<string, THREE.IUniform>[] = [];
  const changed: Record<string, string> = {};
  try {
    uniforms = captureFogUniforms(() => { look.lighting?.install(); look.fog?.install(); });
  } finally {
    for (const name of chunkNames()) {
      const now = readChunk(name), was = before.get(name);
      if (now !== undefined && now !== was) changed[name] = now;
      if (was === undefined) Reflect.deleteProperty(THREE.ShaderChunk, name); else Reflect.set(THREE.ShaderChunk, name, was);
    }
  }
  const result = Object.keys(changed).length === 0 && uniforms.length === 0 ? null : { id, chunks: changed, uniforms };
  captured.set(id, result);
  return result;
}

/** three's built-in shader for a material type (`ShaderLib`); ShaderMaterials carry their own source */
const SHADER_LIB: Readonly<Record<string, string>> = {
  MeshBasicMaterial: 'basic', LineBasicMaterial: 'basic', MeshLambertMaterial: 'lambert', MeshPhongMaterial: 'phong',
  MeshStandardMaterial: 'physical', MeshPhysicalMaterial: 'physical', MeshToonMaterial: 'toon', MeshMatcapMaterial: 'matcap',
  PointsMaterial: 'points', LineDashedMaterial: 'dashed', MeshDepthMaterial: 'depth', MeshNormalMaterial: 'normal',
  SpriteMaterial: 'sprite', MeshDistanceMaterial: 'distance', ShadowMaterial: 'shadow',
};
const INCLUDE = /^[ \t]*#include +<([\w\d./]+)>/gm;

/** the overridden chunks a source reaches through its includes (nested ones too) */
function reached(source: string, overrides: Readonly<Record<string, string>>, seen = new Set<string>()): Set<string> {
  const out = new Set<string>();
  for (const match of source.matchAll(INCLUDE)) {
    const name = match[1];
    if (name === undefined || seen.has(name)) continue;
    seen.add(name);
    if (Object.hasOwn(overrides, name)) out.add(name);
    const text = readChunk(name);
    if (text !== undefined) for (const inner of reached(text, overrides, seen)) out.add(inner);
  }
  return out;
}

/** inline every include that reaches an override with the region's text (the rest stay includes for three) */
function inline(source: string, overrides: Readonly<Record<string, string>>, depth = 0): string {
  if (depth > 16) return source;
  return source.replace(INCLUDE, (whole, name: string) => {
    if (Object.hasOwn(overrides, name)) return inline(overrides[name] ?? '', overrides, depth + 1);
    const text = readChunk(name);
    return text !== undefined && reached(text, overrides).size > 0 ? inline(text, overrides, depth + 1) : whole;
  });
}

const UNIFORM = /\buniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/g;
/** the uniform names the region's chunks declare */
const declared = (look: LookChunks): Set<string> => new Set(Object.values(look.chunks).flatMap((text) => [...text.matchAll(UNIFORM)].map((m) => m[1] ?? '')));
/**
 * Drop the later declarations of a uniform the region's chunks declare (GLSL refuses a redeclaration): a material that
 * declared a look uniform itself for a page without the look (`ownUniforms`) now also receives the region's chunk that
 * declares it. The first declaration stays, so it still precedes every use. Only the chunks' own names are touched, so
 * a three chunk's `#if` / `#else` pair of one uniform is never cut.
 */
function dedupeUniforms(source: string, names: ReadonlySet<string>): string {
  const seen = new Set<string>();
  return source.replace(UNIFORM, (statement, name: string) => {
    if (!names.has(name)) return statement;
    if (seen.has(name)) return '';
    seen.add(name); return statement;
  });
}

/** Which overridden chunks a material's program would read (empty: leave it alone). */
export function lookChunksFor(material: THREE.Material, look: LookChunks): ReadonlySet<string> {
  let vertex: string, fragment: string;
  if (material instanceof THREE.ShaderMaterial) { vertex = material.vertexShader; fragment = material.fragmentShader; } else {
    const lib = SHADER_LIB[material.type], shader = lib === undefined ? undefined : THREE.ShaderLib[lib];
    if (shader === undefined) return new Set();
    vertex = shader.vertexShader; fragment = shader.fragmentShader;
  }
  const hit = reached(`${vertex}\n${fragment}`, look.chunks);
  const fogged: unknown = Reflect.get(material, 'fog');
  return fogged === true ? hit : new Set([...hit].filter((name) => !name.startsWith('fog_')));
}

/** Apply the region's chunks to one shader source (the patch body; exposed for tests). */
export function applyLookChunks(shader: Pick<ShaderSource, 'vertexShader' | 'fragmentShader' | 'uniforms'>, look: LookChunks): void {
  const names = declared(look);
  shader.vertexShader = dedupeUniforms(inline(shader.vertexShader, look.chunks), names);
  shader.fragmentShader = dedupeUniforms(inline(shader.fragmentShader, look.chunks), names);
  for (const set of look.uniforms) for (const [name, uniform] of Object.entries(set)) if (!Object.hasOwn(shader.uniforms, name)) shader.uniforms[name] = uniform;
}

const isMaterial = (value: unknown): value is THREE.Material => value instanceof THREE.Material;

/** What `scopeLookChunks` reads of the region. */
export interface LookScopeOptions {
  /** materials another owner shares (the asset cache's): left on the page look */
  readonly isShared?: (material: THREE.Material) => boolean;
}

/**
 * Scope the look to `root`'s materials; returns `sweep`, which patches the materials added since (call it each frame
 * before the region draws, and once right away). A material compiled before its patch is recompiled once.
 */
export function scopeLookChunks(root: THREE.Object3D, look: LookChunks, scope: Scope, options: LookScopeOptions = {}): { sweep: () => number; patched: () => number } {
  const done = new WeakSet<THREE.Material>();
  let count = 0;
  const visit = (material: THREE.Material): void => {
    if (done.has(material)) return;
    done.add(material);
    if (options.isShared?.(material) === true || lookChunksFor(material, look).size === 0) return;
    // three keys a program by its shader id (or a ShaderMaterial's original source id) and this key, never the patched text
    patchShader(material, 'region.look', PATCH_ORDER.view + 40, (shader) => { applyLookChunks(shader, look); }, { scope, key: (before) => `${before}|look:${look.id}` });
    material.needsUpdate = true; count++;
  };
  const sweep = (): number => {
    if (scope.disposed) return count;
    const before = count;
    root.traverse((node) => {
      const material: unknown = Reflect.get(node, 'material');
      const list: readonly unknown[] = Array.isArray(material) ? material : [material];
      for (const m of list) if (isMaterial(m)) visit(m);
    });
    return count - before;
  };
  return { sweep, patched: () => count };
}
