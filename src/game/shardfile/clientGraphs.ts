/**
 * The shardfile's graph materials on the client (SHARD-PLATFORM SF59 step 5): a `look.materials` (or skin binding) entry
 * `{ family: "graph", graph }` compiles to a node material through the engine's lazy graph back-end
 * (`render/graphBackend.ts`), so nothing here imports `three/webgpu` or `three/tsl`.
 *
 * - **Admitted names only:** every graph is validated against the shard's real binding lists (`graphBindingSources`: the
 *   day-key channels its look keys carry and its declared public numeric state fields), never a compiler default that
 *   allows any name. A graph that binds anything else is refused (it throws), whether the Debug row is on or off.
 * - **Params move, programs stay:** each bound param is a uniform the per-frame `tick` moves with `setParam`: a day binding
 *   samples the shard's own look keys at the frame owner's hour (G158: one world clock; the owner's fog and grade then
 *   apply on top through the engine epilogue), a state binding reads the live state source or the field's declared default.
 * - **Textures** resolve to the admitted, charged KTX2 library textures (colour role).
 * - **Budget:** a graph past the engine's per-program budget falls back to its family preset (a standard graph → the plain
 *   vertex-coloured PBR family, an unlit one → the plain emissive family) instead of compiling. So does every graph while the
 *   default-off Debug row (Look ▸ "Graph materials") is off: the first graph-compiled look waits for a physical-iPhone
 *   reading (RENDERING.md; sf59-tsl-spike.md §5's cost flag).
 * - **Outlines:** a compiled graph that declares `stages.outline` also has its hull material (`outline(material)`); the
 *   views attach it to every mesh they bind that material to as its second draw (`graphOutlineHook`, the engine's
 *   `attachOutline`: a child mesh over the same buffers, an instanced mesh's own matrices). A fallback preset has none, so a
 *   graph without an outline, or any graph while the row is off, draws exactly as before. The outline's instructions are
 *   already in the graph's admitted cost (`validateGraph` counts the `outlineVertex` / `outline` programs).
 */
import { Color, Mesh, SRGBColorSpace, type Material, type Object3D, type Texture } from 'three';
import { DEFAULT_GRAPH_BUDGET, validateGraph, type GraphBinding, type GraphIr, type GraphParamType } from '@wildshard/engine/core/materialGraph';
import { DATA_LOOK_DAY, dataLookClock, lookSample, sampleLook, type LookSample } from '@wildshard/engine/render/dataLook';
import type { GraphCompiler } from '@wildshard/engine/render/graphBackend';
import type { Scope } from '@wildshard/engine/app/scope';
import { graphBindingSources } from './materials';
import type { Shardfile } from './schema';

/** A graph material entry as the catalogue and a skin binding carry it. */
export interface GraphMaterialEntry { readonly family: 'graph'; readonly graph: unknown }
/** Is this material entry a graph (the family selector only; the graph itself is validated on compile)? */
export function isGraphEntry(entry: unknown): entry is GraphMaterialEntry {
  return typeof entry === 'object' && entry !== null && !Array.isArray(entry) && Reflect.get(entry, 'family') === 'graph';
}

/** Where bound params read their values: the frame owner's hour (0–24) and a declared state field's live value. */
export interface GraphSources {
  readonly hour?: () => number | null;
  readonly state?: (scope: 'shared' | 'player', name: string) => number | undefined;
}
/** What happened to each graph entry (tests, the debug handle). */
export interface GraphReadout { compiled: number; fallback: number; reasons: string[] }

/** A compiled graph's outline stage: its hull material and the attach that adds it to a mesh as the second draw. */
export interface GraphOutline { readonly material: Material; readonly attach: (mesh: Mesh) => Mesh }
/** Attach `material`'s outline (when its graph declares one) to every mesh under `root`; the hulls go with `scope`. */
export type GraphOutlineHook = (root: Object3D, material: Material, scope: Scope) => readonly Mesh[];

function isMesh(object: Object3D): object is Mesh { return object instanceof Mesh; }
/** every live body the hook outlined and every hull it attached (a root walked twice gets no second hull) */
const outlined = new WeakSet<Mesh>();
/**
 * The mesh-level outline hook over `outline` (a material's stage, or null): every mesh under `root` (root included) gets
 * the hull as a child; on `scope`'s disposal each hull leaves its parent and its own geometry (a shallow copy whose
 * attributes the body owns) is disposed. A material without an outline attaches nothing and touches no mesh.
 */
export function graphOutlineHook(outline: (material: Material) => GraphOutline | null): GraphOutlineHook {
  return (root, material, scope) => {
    const stage = outline(material);
    if (stage === null) return [];
    const bodies: Mesh[] = [];
    root.traverse((object) => { if (isMesh(object) && !outlined.has(object)) bodies.push(object); });
    return bodies.map((mesh) => {
      const hull = stage.attach(mesh);
      outlined.add(mesh); outlined.add(hull);
      scope.onDispose(() => { hull.removeFromParent(); hull.geometry.dispose(); outlined.delete(mesh); });
      return hull;
    });
  };
}

/** One bound param's feed, prepared once. */
interface Feed { readonly set: () => void }

/** A family entry a graph falls back to: the plain preset of its lighting model. */
export function graphFallbackEntry(graph: Pick<GraphIr, 'model' | 'doubleSided'>): Readonly<Record<string, unknown>> {
  // as clientMaterials' implicit family surfaces: plain and vertex-coloured, PBR dielectric
  const doubleSided = graph.doubleSided ?? false;
  return graph.model === 'unlit' ? { family: 'emissive', vertexColours: true, doubleSided } : { family: 'pbr', vertexColours: true, metalness: 0, doubleSided };
}

/**
 * The graph side of a shardfile's materials. `compiler` is null while the Debug row is off (every graph falls back);
 * `fallback` compiles a family entry on the family looks; `textures` resolves an admitted texture reference.
 */
export function clientGraphs(source: Pick<Shardfile, 'look' | 'state'>, options: { compiler: GraphCompiler | null; fallback: (entry: Readonly<Record<string, unknown>>) => Material; textures: (ref: string) => Texture }): {
  compile: (entry: GraphMaterialEntry) => Material; tick: (dt: number) => void; bind: (sources: GraphSources) => void; readout: GraphReadout;
  /** the outline stage of a material this compiled (null: no `stages.outline`, a fallback preset, or not a graph) */
  outline: (material: Material) => GraphOutline | null;
} {
  const lists = graphBindingSources(source), dayKeys = [...lists.day.keys()], stateFields = lists.state;
  const feeds: Feed[] = [], readout: GraphReadout = { compiled: 0, fallback: 0, reasons: [] };
  let sources: GraphSources = {}, dayBound = false;
  const ownClock = source.look.keys.length > 0 ? dataLookClock(source.look.day ?? DATA_LOOK_DAY, source.look.dayOverride) : null;
  const sample: LookSample = lookSample();
  const defaults = new Map<string, number>();
  for (const scope of ['shared', 'player'] as const) for (const field of source.state[scope]) if (typeof field.default === 'number') defaults.set(`${scope}.${field.name}`, field.default);
  const srgb = new Color();
  const outlines = new WeakMap<Material, GraphOutline>();

  const feed = (setParam: (name: string, value: readonly number[] | number) => void, param: string, type: GraphParamType, bind: GraphBinding): Feed => {
    if ('state' in bind) {
      const key = bind.state, dot = key.indexOf('.'), scope = key.slice(0, dot), name = key.slice(dot + 1);
      const fallback = defaults.get(key) ?? 0, live = scope === 'shared' || scope === 'player' ? scope : null;
      if (live === null) throw new Error(`material graph: state binding ${key} has no scope`);
      return { set: () => { setParam(param, sources.state?.(live, name) ?? fallback); } };
    }
    dayBound = true;
    const channel = bind.day, out = [0, 0, 0];
    const colour = (pick: (s: LookSample) => Color): Feed => ({ set: () => {
      const c = pick(sample);
      // key colours are stored linear; a `colour` param is written in sRGB (the compiler holds it linear), a vec3 takes them as they are
      if (type === 'colour') { srgb.copy(c); srgb.getRGB(srgb, SRGBColorSpace); out[0] = srgb.r; out[1] = srgb.g; out[2] = srgb.b; } else { out[0] = c.r; out[1] = c.g; out[2] = c.b; }
      setParam(param, out);
    } });
    const scalar = (pick: (s: LookSample) => number): Feed => ({ set: () => { setParam(param, pick(sample)); } });
    switch (channel) {
      case 'sky.zenith': return colour((s) => s.zenith);
      case 'sky.horizon': return colour((s) => s.horizon);
      case 'fog.colour': return colour((s) => s.fog);
      case 'sun.colour': return colour((s) => s.sun);
      case 'ambient.sky': return colour((s) => s.ambientSky);
      case 'ambient.ground': return colour((s) => s.ambientGround);
      case 'fog.density': return scalar((s) => s.fogDensity);
      case 'fog.near': return scalar((s) => s.fogNear ?? 0);
      case 'fog.far': return scalar((s) => s.fogFar ?? 0);
      case 'sun.intensity': return scalar((s) => s.sunIntensity);
      case 'ambient.intensity': return scalar((s) => s.ambientIntensity);
      default: throw new Error(`material graph: unknown day key ${channel}`);
    }
  };
  const hour = (): number => sources.hour?.() ?? ownClock?.hour ?? 12;
  const refresh = (): void => {
    if (dayBound && source.look.keys.length > 0) sampleLook(source.look.keys, hour() / 24, sample);
    for (const f of feeds) f.set();
  };

  const compile = (entry: GraphMaterialEntry): Material => {
    // validation with the admitted lists first: a refusal (an unknown binding, a bad program) throws, row on or off
    const checked = validateGraph(entry.graph, { dayKeys, stateFields, budget: DEFAULT_GRAPH_BUDGET });
    if (!checked.ok) {
      const refusals = checked.errors.filter((error) => !error.startsWith('budget:'));
      if (refusals.length > 0) throw new Error(`material graph refused:\n  ${refusals.join('\n  ')}`);
      // only the budget refused it: the shape is valid, so its lighting model picks the preset
      const shape: object = typeof entry.graph === 'object' && entry.graph !== null ? entry.graph : {};
      readout.fallback++; readout.reasons.push(checked.errors.join('; '));
      return options.fallback(graphFallbackEntry({ model: Reflect.get(shape, 'model') === 'unlit' ? 'unlit' : 'standard', doubleSided: Reflect.get(shape, 'doubleSided') === true }));
    }
    const ir = checked.graph;
    if (options.compiler === null) { readout.fallback++; readout.reasons.push('graph materials row off'); return options.fallback(graphFallbackEntry(ir)); }
    const compiler = options.compiler, compiled = compiler.compileGraph(ir, { dayKeys, stateFields, budget: DEFAULT_GRAPH_BUDGET, textures: options.textures });
    const hull = compiled.outline;
    if (hull !== null) outlines.set(compiled.material, { material: hull, attach: (mesh) => compiler.attachOutline(mesh, hull) });
    for (const { param, bind } of compiled.bindings) {
      const spec = ir.params?.[param]; if (spec === undefined) throw new Error(`material graph: no param ${param}`);
      const f = feed((name, value) => { compiled.setParam(name, value); }, param, spec.type, bind);
      feeds.push(f);
    }
    readout.compiled++;
    refresh(); // the first frame already carries the bound values
    return compiled.material;
  };
  return {
    compile, readout, outline: (material) => outlines.get(material) ?? null,
    tick: (dt) => { if (feeds.length === 0) return; if (sources.hour === undefined) ownClock?.update(dt); refresh(); },
    bind: (next) => { sources = { ...sources, ...next }; if (feeds.length > 0) refresh(); },
  };
}
