import { emptyShardfile } from '@wildshard/sharddev/author';
import declared from '../outputs.json' with { type: 'json' };
import source from '../data/source.json' with { type: 'json' };
import glowFlicker from '../data/glowFlicker.graph.json' with { type: 'json' };
import poolFlicker from '../data/poolFlicker.graph.json' with { type: 'json' };
import poolStreaks from '../data/poolStreaks.graph.json' with { type: 'json' };
import poster from '../data/poster.graph.json' with { type: 'json' };
import paving from '../data/paving.graph.json' with { type: 'json' };
import kit from '../data/kit.graph.json' with { type: 'json' };
import landmark from '../data/landmark.graph.json' with { type: 'json' };
import landmarkDusk from '../data/landmarkDusk.graph.json' with { type: 'json' };
import landmarkNoon from '../data/landmarkNoon.graph.json' with { type: 'json' };
import landmarkCrimson from '../data/landmarkCrimson.graph.json' with { type: 'json' };
import kitPlanks from '../data/kitPlanks.graph.json' with { type: 'json' };
import lava from '../data/lava.graph.json' with { type: 'json' };
import lagoon from '../data/lagoon.graph.json' with { type: 'json' };
import mapSettings from '../data/map.json' with { type: 'json' };
import audioBindings from '../data/audioBindings.json' with { type: 'json' };
import { generatePlotAudioProject, type PlotAudioBinding } from './audioProject';
import type { OutputProgramResult, ProjectGenerationContext } from '@wildshard/sharddev/projectGeneration';
import { rasterSceneMap } from '@wildshard/sharddev/bake/groundMap';
import { ideaWorld, type PlotIdea } from './plotBake.mjs';

/** One declared tiled plot per idea. The shared look contains only materials
 *  the tiled worlds bind; the live poster keeps its original graph. */
const look: { materials: { billboard: { family: string; graph: typeof poster; } };
  grade: (typeof source)["look"]["grade"]; clock: string;
  familyLooks: (typeof source)["look"]["familyLooks"]; families: (typeof source)["look"]["families"];
  day: (typeof source)["look"]["day"]; dayOverride: number; keys: (typeof source)["look"]["keys"];
} = { ...source.look, materials: { billboard: { family: 'graph', graph: poster } } };

const { why: _why, ...tiledMaterials } = source.tiledMaterials;
/** G641: a tiled plot's look adds the kit's materials (generators/tiledPlot.mjs) */
// NM10: the lanterns, windows and their light pools flicker a little, each on its own phase (world position), unlit as the
// emissive family drew them (glow x2.4 +-12 %, pool additive x1.2 +-8 %); the glow also moves and lights the marked
// fireflies and sky lanterns (kit.mjs `mover`)
const tiledLook: { materials: {
  glow: { family: string; graph: typeof glowFlicker; };
  pool: { family: string; graph: typeof poolFlicker | typeof poolStreaks; };
  paving: { family: string; graph: typeof paving; }; kit: { family: string; graph: typeof kit; };
  landmark: { family: string; graph: typeof landmark; };
  water: (typeof source)["tiledMaterials"]["water"] | { family: string; graph: typeof lava | typeof lagoon; };
  billboard: (typeof look)["materials"]["billboard"];
}; grade: (typeof look)["grade"]; clock: string;
  familyLooks: (typeof look)["familyLooks"]; families: (typeof look)["families"];
  day: (typeof look)["day"]; dayOverride: number; keys: (typeof look)["keys"]; } = { ...look, materials: { ...look.materials, ...tiledMaterials,
  glow: { family: 'graph', graph: glowFlicker }, pool: { family: 'graph', graph: poolFlicker },
  // RM5.1: the paving ruled in its material (flagstones, joints, per-stone shade and wear; no texture), over its vertex colours
  paving: { family: 'graph', graph: paving },
  // RM5.3: the kit's ruled trim by each face's band (data/trim.json): plain, roof tile, timber, plaster, awning stripe, stone
  kit: { family: 'graph', graph: kit },
  // RM6.4: the gate unlit in its own texture (the static transport binds its colour map), shaded by the fixed dusk sun and
  // a warm fill, its gold trim glowing and its foot warmed by its light pools
  landmark: { family: 'graph', graph: landmark } } };

/** One idea row's output (validated whole by the build's parseShardfile; SF88g: one per idea). */
function project(row: { readonly slug: string; readonly idea: string; readonly name: string; readonly accent: string; readonly layout?: string; readonly scaffold?: boolean; readonly worldMaterials?: Readonly<Record<string, string>>; readonly landmarkLight?: string; readonly coarseLandmark?: string; readonly kitGround?: string; readonly pool?: string; readonly water?: string; readonly lookKeys?: (typeof source)["look"]["keys"]; readonly lookGrade?: (typeof source)["look"]["grade"]; readonly lookDay?: { readonly day: (typeof source)["look"]["day"]; readonly dayOverride: number } }): (Omit<ReturnType<typeof emptyShardfile>, "identity" | "accent" | "spawn" | "look" | "world"> & {
    identity: { slug: string; name: string; author: string; revision: number; seed: number; };
    accent: string;
    spawn: (typeof source)["spawn"];
    look: typeof tiledLook;
    // NM5: its own near view from its coarse tiles, so the road sees the tiles instead of the far proxy
    world: { glb: string; colliders: string; far: string; detail: string; coarse: string; farMode: string; near: string; materials: Record<string, string>; };
}) {
  if ('placeholder' in row) throw new Error('open-plots: placeholder worlds are retired');
  const identity = { slug: row.slug, name: `Open Plot · ${row.name}`, author: source.author, revision: source.revision, seed: source.seed };
  // D111: a row's own look key (its sky, fog, sun and fill) replaces the shared one for that idea alone
  const keys = row.lookKeys ?? source.look.keys;
  // OB5: a row's own grade (its saturation and contrast) and its own sun clock (its hour and arc) replace the shared ones for
  // that idea alone (Coral Drift's high noon sun, where the shared 17:17 sun lit its pale boards grey)
  const grade = row.lookGrade ?? source.look.grade, day = row.lookDay?.day ?? source.look.day, dayOverride = row.lookDay?.dayOverride ?? source.look.dayOverride;
  // G641: a row with a layout is a tiled plot; its far proxy is its far-only stand-ins alone (NM0's farMode 'replace')
  // OB2: a row's `landmarkLight: "dusk"` lights its landmark by a neutral dusk fill (a natural landmark: bark and moss)
  // in place of the gate's warm lilac fill (RM6.4), the same graph and size with its own light
  // OB5: `landmarkLight: "noon"` lights it by a bright noon fill (Coral Drift's arch), the same graph and size again
  // OB10: `landmarkLight: "crimson"` keeps the gate's dusk light and deepens its reds to crimson (Night Market's gate)
  const daylit = row.landmarkLight === 'dusk' ? landmarkDusk : row.landmarkLight === 'noon' ? landmarkNoon : row.landmarkLight === 'crimson' ? landmarkCrimson : undefined;
  const lit = daylit === undefined ? tiledLook : { ...tiledLook, materials: { ...tiledLook.materials, landmark: { family: 'graph', graph: daylit } } };
  // OB4: a row's `water: "lava"` draws its water as molten lava (data/lava.graph.json: unlit, its vertex colour as the
  // molten colour, dark crust plates drifting over it in world metres), the lava kind any volcanic plot shares
  // OB5: `water: "lagoon"` draws it as a shallow lagoon (data/lagoon.graph.json: its vertex colour lifted, a slow swell and
  // a bright caustic web where two drifting world-metre noise fields cross), the lagoon kind any tropical plot shares
  const waterGraph = row.water === 'lava' ? lava : row.water === 'lagoon' ? lagoon : undefined;
  const molten = waterGraph === undefined ? lit : { ...lit, materials: { ...lit.materials, water: { family: 'graph', graph: waterGraph } } };
  // OB2: a row's `kitGround: "planks"` rules its ground as boardwalk boards in place of flagstones (data/kitPlanks.graph.json:
  // the kit graph with its own ground rule, scripts/open-plots/ruled-graphs.py)
  const planked = row.kitGround === 'planks' ? { ...molten, materials: { ...molten.materials, kit: { family: 'graph', graph: kitPlanks } } } : molten;
  // OB2: a row's `pool: "streaks"` draws its pools in the streak pool graph (data/poolStreaks.graph.json: the pool flicker,
  // plus the lanterns' reflections the bake lays on its water, kit.mjs waterStreaks, stretched toward the camera)
  const tiled = row.pool === 'streaks' ? { ...planked, materials: { ...planked.materials, pool: { family: 'graph', graph: poolStreaks } } } : planked;
  if (row.layout !== undefined) return { ...emptyShardfile(identity), identity, accent: row.accent, spawn: source.spawn, look: { ...tiled, keys, grade, day, dayOverride },
    // NM5: its own near view from its coarse tiles, so the road sees the tiles instead of the far proxy
    // RM8.2: its kit models draw only at L0 (`detail_`); their boxes stand in at L1 (`coarse_`)
    world: { glb: `assets/${row.idea}/world.glb`, colliders: 'nodes:collide_', far: 'far_', detail: 'detail_', coarse: 'coarse_', farMode: 'replace', near: 'coarse',
      materials: row.worldMaterials ?? (row.scaffold === true ? { Paving: 'paving', Kit: 'kit', Glow: 'glow', Pool: 'pool' }
        : { Paving: 'paving', Kit: 'kit', Water: 'water', Glow: 'glow', Pool: 'pool', Landmark: 'landmark', Poster: 'billboard',
          // OB10: a row's `coarseLandmark: "lit"` draws its coarse (L1) landmark in its landmark graph, in its vertex colours
          // (no texture: meshMap colourOrVertex), so the road entry sees it lit as the near model is, not dark in the kit
          ...(row.coarseLandmark === 'lit' ? { LandmarkCoarse: 'landmark' } : {}) }) },
  };
  throw new Error('open-plots: a plot needs its tiled layout');
}

const [first] = declared.outputs;
if (first === undefined) throw new Error('open-plots: outputs.json needs an idea row');

/** Every output, keyed by its product slug (`wildshard build --output=<slug>`, scripts/shard-outputs.mjs). */
export const outputs: Record<string, ReturnType<typeof project>> = Object.fromEntries(declared.outputs.map((row): [string, ReturnType<typeof project>] => [row.slug, project(row)]));

const bindings: Readonly<Record<string, PlotAudioBinding>> = audioBindings;
/** A real binding opts one output into ordinary generated-declaration admission;
 * absent bindings preserve the original world object, including every peer look. */
export const audioOutputs: Record<string, ReturnType<typeof project> | ((ctx: ProjectGenerationContext) => ReturnType<typeof generatePlotAudioProject<ReturnType<typeof project>>>)> = Object.fromEntries(declared.outputs.map(row => {
  const original = outputs[row.slug], binding = bindings[row.idea];
  if (original === undefined) throw new Error('Missing plot world declaration');
  if (binding === undefined) return [row.slug, original];
  if (binding.idea !== row.idea || binding.source.manifestKey !== row.idea) throw new Error('Plot audio binding identity differs');
  return [row.slug, (ctx: ProjectGenerationContext) => generatePlotAudioProject(ctx, original, binding)];
}));

/** The first idea's output: the project's default build. */
export const product: ReturnType<typeof project> = project(first);

/** A repo-relative bake input as the build's declared input name: public files under `/assets/`, this folder's own files
 *  relative to it (`scripts/wildshard.mjs`'s input roots). */
const PLOT_ASSETS = '/assets/open-plots/';
function inputName(path: string): string {
  if (path.startsWith('public/assets/open-plots/')) return PLOT_ASSETS + path.slice('public/assets/open-plots/'.length);
  if (path.startsWith('src/shards/open-plots/')) return path.slice('src/shards/open-plots/'.length);
  throw new Error(`open-plots: undeclared bake input ${path}`);
}
const decoded = (bytes: Uint8Array | undefined): unknown => {
  if (bytes === undefined) throw new Error('open-plots: missing layout input');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); return value;
};
/** Every file one idea's tiled bake reads (repo-relative): its layout,
 *  its kit families, its landmark near / far models and its poster picture. */
async function bakeInputs(ctx: Pick<ProjectGenerationContext, 'cached'>, row: PlotIdea): Promise<string[]> {
  if (row.layout === undefined) throw new Error('open-plots: a plot needs its tiled layout');
  const file = `src/shards/open-plots/data/layouts/${row.layout}.json`;
  const read = await ctx.cached({ id: `layout-${row.idea}`, inputs: [inputName(file)] }, inputs => inputs);
  const layout = decoded(read.get(inputName(file)));
  if (typeof layout !== 'object' || layout === null || !('landmark' in layout) || !('posters' in layout)) throw new Error('open-plots: invalid layout inputs');
  const { landmark: mark, posters } = layout;
  const families: unknown = 'kit' in layout ? layout.kit : [];
  const landmarkValid = mark === null ? row.scaffold === true : typeof mark === 'object' && 'near' in mark && 'far' in mark && typeof mark.near === 'string' && typeof mark.far === 'string';
  const posterValid = posters === null ? row.scaffold === true : typeof posters === 'object' && 'image' in posters && typeof posters.image === 'string';
  if (!landmarkValid || !posterValid || !Array.isArray(families) || !families.every((family): family is string => typeof family === 'string')) throw new Error('open-plots: invalid layout inputs');
  const landmarks = mark !== null && typeof mark === 'object' && 'near' in mark && 'far' in mark && typeof mark.near === 'string' && typeof mark.far === 'string' ? [mark.near, mark.far] : [];
  const pictures = posters !== null && typeof posters === 'object' && 'image' in posters && typeof posters.image === 'string' ? [posters.image] : [];
  return [file, ...families.map(family => `public/assets/open-plots/kit/${family}.glb`), ...landmarks, ...pictures];
}
/** GR9 (G783): one idea's build program: its world GLB baked in the build from declared, cached inputs and its map lattice
 *  painted from that world (its own `data/map.json` output row), in place of the retired `open-plots-world` job. */
async function plotProgram(ctx: ProjectGenerationContext, row: PlotIdea): Promise<OutputProgramResult> {
  const paths = await bakeInputs(ctx, row), glb = `assets/${row.idea}/world.glb`;
  const files = await ctx.cached({ id: `world-${row.idea}`, native: true, inputs: paths.map(inputName) }, async inputs => {
    const read = (path: string): Uint8Array => {
      const bytes = inputs.get(inputName(path)); if (bytes === undefined) throw new Error(`open-plots: undeclared bake input ${path}`); return bytes;
    };
    const { readImagePixels, writeImagePixels, normalizeWorldGlb } = ctx;
    if (writeImagePixels === undefined || normalizeWorldGlb === undefined) throw new Error('open-plots: the build adapter lacks the plot bake tools');
    const world = await ideaWorld(row, read, { readImagePixels, writeImagePixels, normalizeWorldGlb });
    const need = (name: string): Uint8Array => { if (name !== glb) throw new Error(`open-plots: map reads only its world (${name})`); return world; };
    const map = await rasterSceneMap(mapSettings, { input: need, bytes: need, json: name => { throw new Error(`open-plots: map reads no rows (${name})`); } }, { output: row.slug, glbs: [glb] });
    return new Map([['world.glb', world], ['map.rgba', map.pixels]]);
  });
  const world = files.get('world.glb'), pixels = files.get('map.rgba');
  if (world === undefined || pixels?.byteLength !== 1000 * 1000 * 4) throw new Error('open-plots: world or map cache inventory differs');
  return { world, map: { pixels } };
}

/** GR9: each output's build program, keyed by its product slug (beside `outputs`, which stay the declarations). */
export const programs: Record<string, (ctx: ProjectGenerationContext) => Promise<OutputProgramResult>> = Object.fromEntries(
  declared.outputs.map((row): [string, (ctx: ProjectGenerationContext) => Promise<OutputProgramResult>] => [row.slug, ctx => plotProgram(ctx, row)]));
