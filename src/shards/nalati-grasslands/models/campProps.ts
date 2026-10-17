/**
 * The camps' props (E306 / E315 second pass): every code-built thing that stands in the spring camp and the summer camp
 * (src/shards/nalati-grasslands/world/NomadCamp.ts, SummerCamp.ts; the camp builders' blocks and src/shards/nalati-grasslands/world/props.ts's helpers,
 * moved there verbatim) — felt rugs (syrmak pattern) laid out, on a drying rack and over a rope line; coopered barrels;
 * the iron stove with its pipe; the two-wheeled cart (arba); the saddle on its trestle; the carved hitching rail where
 * TULPAR waits; the water trough; the round pole corral with its gate, its hay pile and feed trough; the yard's ribbon
 * pole; the eagle's perch; a bench, the chopping block, the milk cans; the summer camp's tether line, kurt drying board
 * and ribbon post. (The kazan, chests, woodpile, churns, ground saddles and the perched eagle are generated GLBs:
 * ./campGenerated.ts; the yurts: ./yurt.ts.)
 *
 * SHARD-PLATFORM M3 (the places bake): the painters run offline only (../generators/campProps.ts, painted into each camp's
 * ONE mesh by ../generators/places.ts, the camp's rng stream in the old builder's order); the page draws the bake
 * (../world/placeBake.ts). Here are the models' defs: the camps place them, the Explorer shows their baked specimens.
 */
import type { Box } from '../world/solid';
import { defineModel } from '@wildshard/engine/models/model';
import { generatedModel, type FieldstoneParams, type SignpostParams } from '../world/painted';
import { bakedPainted } from '../world/placeBake';

export interface HitchingRailParams { readonly length: number; readonly height: number }
export interface CorralParams { readonly r: number; readonly posts: number }
export interface SpanParams {
  /** the far end, relative to the placement (the near end) */
  readonly dx: number;
  readonly dz: number;
}
export interface RugParams { readonly w: number; readonly h: number; readonly pal: number }
export interface PalsParams { readonly pals: readonly number[] }
export interface BarrelParams { readonly s: number }
export interface RugLineParams extends SpanParams { readonly pals: readonly number[] }

/** how high the eagle's perch stands: its T-bar is at `at.y + EAGLE_PERCH_H + 0.08`, the eagle's feet 4 cm above */
export const EAGLE_PERCH_H = 2.55;

// ── the models ────────────────────────────────────────────────────────────────────────────────────────────────────

const FILE = 'src/shards/nalati-grasslands/generators/campProps.ts';

export const ribbonPole = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/ribbon-pole', name: 'Yard ribbon pole', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const eaglePerch = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/eagle-perch', name: "Eagle's perch", category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const stove = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/stove', name: 'Camp stove', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const campBench = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/camp-bench', name: 'Camp bench', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const rugRack = defineModel<PalsParams>(bakedPainted<PalsParams>({
  id: 'nalati-grasslands/rug-rack', name: 'Rug drying rack', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { pals: [0, 1, 2] },
}));
export const feltRug = defineModel<RugParams>(bakedPainted<RugParams>({
  id: 'nalati-grasslands/felt-rug', name: 'Felt rug (syrmak)', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { w: 1.5, h: 2.2, pal: 1 },
  variants: [0, 1, 2, 3].map((pal) => ({ id: `palette-${pal}`, label: ['Red', 'Blue', 'Orange', 'Teal'][pal] ?? 'Red', params: { pal } })),
}));
export const cart = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/cart', name: 'Cart (arba)', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const barrel = defineModel<BarrelParams>(bakedPainted<BarrelParams>({
  id: 'nalati-grasslands/barrel', name: 'Barrel', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { s: 1 },
}));
export const hitchingRail = defineModel<HitchingRailParams>(bakedPainted<HitchingRailParams>({
  id: 'nalati-grasslands/hitching-rail', name: 'Hitching rail', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { length: 6.5, height: 1.1 },
}));
export const waterTrough = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/water-trough', name: 'Water trough', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const saddleRack = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/saddle-rack', name: 'Saddle rack', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const corral = defineModel<CorralParams>(bakedPainted<CorralParams>({
  id: 'nalati-grasslands/corral', name: 'Pole corral', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { r: 9, posts: 26 },
}));
export const hayPile = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/hay-pile', name: 'Hay pile', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const feedTrough = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/feed-trough', name: 'Feed trough', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const rugLine = defineModel<RugLineParams>(bakedPainted<RugLineParams>({
  id: 'nalati-grasslands/rug-line', name: 'Rug line', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { dx: 4.4, dz: 2.6, pals: [1, 3, 0] },
}));
export const choppingBlock = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/chopping-block', name: 'Chopping block', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const milkCans = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/milk-cans', name: 'Milk cans', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const tetherLine = defineModel<SpanParams>(bakedPainted<SpanParams>({
  id: 'nalati-grasslands/tether-line', name: 'Tether line', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { dx: 0, dz: 8 },
}));
export const kurtBoard = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/kurt-board', name: 'Kurt drying board', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));
export const ribbonPost = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/ribbon-post', name: 'Ribbon post', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {},
}));

// ── the rock places' models (painted by ../generators/places.ts; drawn by ../world/index.ts, ../world/Cairn.ts) ──────

const PLACES_FILE = 'src/shards/nalati-grasslands/generators/places.ts';

export const eagleRock = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/eagle-rock', name: 'Eagle Rock', category: 'nature', pipeline: 'code', file: PLACES_FILE, surface: 'rock', defaults: {},
}));
export const windCairn = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/wind-cairn', name: 'Wind Cairn', category: 'props', pipeline: 'code', file: PLACES_FILE, surface: 'stone', defaults: {},
}));

// Static world models share this catalog and the existing places bake.
export interface CragLedgeParams {
  /** the slab's width across the slope and its depth out of it (m) */
  readonly w: number;
  readonly d: number;
  /** snow settles on its top above this height */
  readonly snowLine: number;
}

export const cragLedge = defineModel<CragLedgeParams>(bakedPainted<CragLedgeParams>({
  id: 'nalati-grasslands/crag-ledge', name: 'Crag ledge', category: 'nature', pipeline: 'code',
  file: PLACES_FILE, surface: 'rock',
  defaults: { w: 5, d: 3.5, snowLine: 60 },
}));

export interface LeopardCaveParams {
  /** snow settles on its tops above this height */
  readonly snowLine: number;
}

export const leopardCave = defineModel<LeopardCaveParams>(bakedPainted<LeopardCaveParams>({
  id: 'nalati-grasslands/leopard-cave', name: "Leopard's cave", category: 'nature', pipeline: 'code',
  file: PLACES_FILE, surface: 'rock',
  defaults: { snowLine: 60 },
}));

export interface KurganEntranceParams {
  /** the ground at the mound's foot on the door axis (where the steps come down to) */
  readonly footY: number;
}

export const kurganEntrance = defineModel<KurganEntranceParams>(bakedPainted<KurganEntranceParams>({
  id: 'nalati-grasslands/kurgan-entrance', name: 'Kurgan entrance', category: 'buildings', pipeline: 'code',
  file: PLACES_FILE, surface: 'wood',
  defaults: { footY: -0.9 },
}));

export interface KurganKerbParams {
  /** radius, metres */
  readonly s: number;
  /** lying flat on its side (robbed and toppled) */
  readonly fallen: boolean;
}

export const kurganKerb = defineModel<KurganKerbParams>(bakedPainted<KurganKerbParams>({
  id: 'nalati-grasslands/kurgan-kerb', name: 'Kurgan kerb stone', category: 'props', pipeline: 'code',
  file: PLACES_FILE, surface: 'stone',
  defaults: { s: 0.45, fallen: false },
  variants: [{ id: 'standing', label: 'Standing', params: {} }, { id: 'fallen', label: 'Fallen', params: { fallen: true } }],
}));


export const fieldstoneBaked = defineModel<FieldstoneParams>(bakedPainted<FieldstoneParams>({
  id: 'nalati-grasslands/fieldstone', name: 'Fieldstone', category: 'nature', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/campProps.ts', surface: 'stone',
  defaults: { s: 0.3, squash: 0.55, rough: 0.22, lift: 0.1, look: 'kurgan' },
  variants: [
    { id: 'kurgan', label: 'Kurgan field', params: {} },
    { id: 'rubble', label: 'Tower rubble', params: { s: 0.6, squash: 0.7, rough: 0.25, lift: -0.2, look: 'rubble' } },
  ],
}));

export interface LogParams {
  /** its ends, relative to the placement (normally the near end: 0, 0; see `logEnds`) */
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly r: number;
  /** bleached driftwood on a gravel bar (else a fallen spruce, mossed) */
  readonly drift: boolean;
}


export interface StumpParams { readonly s: number }
export interface OvooParams { readonly s: number }
export interface ClutterParams { readonly kind: number }
export const CLUTTER_KINDS = ['Firewood tipi', 'Dung-cake stack', 'Chopping block', 'Pots and a bucket', 'Sacks', 'Folded felts', 'Kumis churn'] as const;


export const fallenLog = defineModel<LogParams>(bakedPainted<LogParams>({
  id: 'nalati-grasslands/fallen-log', name: 'Fallen log', category: 'nature', pipeline: 'code', file: PLACES_FILE, surface: 'wood',
  defaults: { ax: 0, az: 0, bx: 4.5, bz: 1.2, r: 0.3, drift: false },
  variants: [{ id: 'spruce', label: 'Spruce', params: {} }, { id: 'driftwood', label: 'Driftwood', params: { drift: true, r: 0.22 } }],
}));
export const stump = defineModel<StumpParams>(bakedPainted<StumpParams>({
  id: 'nalati-grasslands/stump', name: 'Spruce stump', category: 'nature', pipeline: 'code', file: PLACES_FILE, surface: 'wood',
  defaults: { s: 0.3 },
}));
export const ovoo = defineModel<OvooParams>(bakedPainted<OvooParams>({
  id: 'nalati-grasslands/ovoo', name: 'Ovoo cairn', category: 'props', pipeline: 'code', file: PLACES_FILE, surface: 'stone',
  defaults: { s: 1 },
}));
export const viewpointPole = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/viewpoint-pole', name: 'Viewpoint ribbon pole', category: 'props', pipeline: 'code', file: PLACES_FILE, surface: 'wood',
  defaults: {},
}));
export const skyGateway = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/sky-gateway', name: 'Sky road gateway', category: 'props', pipeline: 'code', file: PLACES_FILE, surface: 'wood',
  defaults: {},
}));
export const campClutter = defineModel<ClutterParams>(bakedPainted<ClutterParams>({
  id: 'nalati-grasslands/camp-clutter', name: 'Camp clutter', category: 'props', pipeline: 'code', file: PLACES_FILE, surface: 'wood',
  defaults: { kind: 0 },
  variants: CLUTTER_KINDS.map((label, kind) => ({ id: label.toLowerCase().replaceAll(' ', '-'), label, params: { kind } })),
}));

export interface FenceParams {
  /** the run's points, relative to the placement: (x, z), the first (0, 0) */
  readonly pts: readonly (readonly [number, number])[];
  /** post height (m) and spacing along the run */
  readonly h: number;
  readonly spacing: number;
}


export const fence = defineModel<FenceParams>(bakedPainted<FenceParams>({
  id: 'nalati-grasslands/fence', name: 'Split-rail fence', category: 'props', pipeline: 'code',
  file: PLACES_FILE, surface: 'wood',
  defaults: { pts: [[0, 0], [0, 7.2], [2.4, 12]], h: 1.15, spacing: 2.4 },
}));

export type RockTint = 'granite' | 'warm' | 'cool';

export interface GraniteOutcropParams {
  /** the block: width (along the contour), height, depth; how rough its surface */
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly rough: number;
  /** its tip into the slope (radians about its own x / z) */
  readonly pitch: number;
  readonly roll: number;
  /** its tint; absent: drawn from the stream after the block's shape (`draw`: of two, granite / warm, or of three) */
  readonly tint?: RockTint;
  readonly draw?: 2 | 3;
  /** how much lichen on its tops */
  readonly lichen: number;
  /** it collides (as the hull of what it draws) */
  readonly solid: boolean;
}

export type BoulderLook = 'lean' | 'channel' | 'bank' | 'bed' | 'streambank';

export interface RoundedBoulderParams {
  /** radius, metres */
  readonly r: number;
  readonly look: BoulderLook;
  /** its tint; absent: drawn from the stream after its shape, cool with these odds, else granite */
  readonly tint?: RockTint;
  readonly coolOdds?: number;
  readonly solid: boolean;
}


export const graniteOutcrop = defineModel<GraniteOutcropParams>(bakedPainted<GraniteOutcropParams>({
  id: 'nalati-grasslands/granite-outcrop', name: 'Granite outcrop', category: 'nature', pipeline: 'code', file: PLACES_FILE, surface: 'rock',
  defaults: { w: 4.2, h: 1.6, d: 2.4, rough: 0.22, pitch: 0.12, roll: 0, tint: 'granite', lichen: 0.55, solid: true },
  variants: [
    { id: 'escarpment', label: 'Escarpment', params: {} },
    { id: 'rim', label: 'Rim band', params: { w: 5.5, h: 2.2, d: 2.8, rough: 0.24, tint: 'warm', lichen: 0.5 } },
  ],
}));

export const roundedBoulder = defineModel<RoundedBoulderParams>(bakedPainted<RoundedBoulderParams>({
  id: 'nalati-grasslands/rounded-boulder', name: 'Rounded boulder', category: 'nature', pipeline: 'code', file: PLACES_FILE, surface: 'rock',
  defaults: { r: 0.9, look: 'bank', tint: 'cool', solid: false },
  variants: [
    { id: 'bank', label: 'River bank', params: {} },
    { id: 'channel', label: 'In the current', params: { look: 'channel' } },
    { id: 'lean', label: 'Leaning on a block', params: { look: 'lean', tint: 'granite', r: 0.7 } },
    { id: 'streambank', label: 'Meltwater bank', params: { look: 'streambank', r: 1.1 } },
  ],
}));


export const kokparGoal = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/kokpar-goal', name: 'Kokpar goal', category: 'props', pipeline: 'code',
  file: PLACES_FILE, surface: 'earth',
  defaults: {},
}));


export const kokparPost = defineModel<object>(bakedPainted<object>({
  id: 'nalati-grasslands/kokpar-post', name: 'Kokpar marker post', category: 'props', pipeline: 'code',
  file: PLACES_FILE, surface: 'wood',
  defaults: {},
}));

export interface StoneStepParams {
  /** the tread's width across the flight and its depth along it, the block's height (m) */
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** its shape's seed (the stair's step number) */
  readonly seed: number;
}


export const stoneStep = defineModel<StoneStepParams>(bakedPainted<StoneStepParams>({
  id: 'nalati-grasslands/stone-step', name: 'Stone step', category: 'props', pipeline: 'code',
  file: PLACES_FILE, surface: 'stone',
  defaults: { width: 1.8, depth: 0.4, height: 0.6, seed: 0x5a1 },
}));

export const signpostBaked = defineModel<SignpostParams>(bakedPainted<SignpostParams>({
  id: 'nalati-grasslands/signpost', name: 'Carved signpost', category: 'props', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/signpost.ts', surface: 'wood',
  defaults: { boards: [{ text: 'NOMAD CAMP', dir: Math.PI / 2 }, { text: 'SKY GRASSLAND', dir: Math.PI }, { text: 'KUNES BRIDGE', dir: 0 }] },
}));

export const kazan = defineModel<object>(generatedModel<object>({
  id: 'nalati-grasslands/kazan', name: 'Kazan on its tripod', category: 'props', pipeline: 'trellis', file: PLACES_FILE, surface: 'wood',
  defaults: {},
}, { id: 'nalati-grasslands/kazan', name: 'cauldron' }));

export const chest = defineModel<object>(generatedModel<object>({
  id: 'nalati-grasslands/chest', name: 'Sandyq chest', category: 'props', pipeline: 'trellis', file: PLACES_FILE, surface: 'wood',
  defaults: {},
}, { id: 'nalati-grasslands/chest', name: 'chest' }));

export const firewood = defineModel<FirewoodParams>(generatedModel<FirewoodParams>({
  id: 'nalati-grasslands/firewood', name: 'Firewood stack', category: 'props', pipeline: 'trellis', file: PLACES_FILE, surface: 'wood',
  defaults: { dy: 0 },
}, { id: 'nalati-grasslands/firewood', name: 'firewood' }));

export const kumisChurn = defineModel<ChurnParams>(generatedModel<ChurnParams>({
  id: 'nalati-grasslands/kumis-churn', name: 'Kumis churn', category: 'props', pipeline: 'trellis', file: PLACES_FILE, surface: 'wood',
  defaults: { hw: 0.28, h: 1.1 },
}, { id: 'nalati-grasslands/kumis-churn', name: 'kumis-churn' }));

export const groundSaddle = defineModel<object>(generatedModel<object>({
  id: 'nalati-grasslands/ground-saddle', name: 'Saddle on the grass', category: 'props', pipeline: 'trellis', file: PLACES_FILE, surface: 'wood',
  defaults: {},
}, { id: 'nalati-grasslands/ground-saddle', name: 'saddle' }));

export const perchedEagle = defineModel<object>(generatedModel<object>({
  id: 'nalati-grasslands/perched-eagle', name: 'Golden eagle on its perch', category: 'props', pipeline: 'trellis', file: PLACES_FILE, surface: 'wood',
  defaults: {},
}, { id: 'nalati-grasslands/perched-eagle', name: 'eagle' }));

export interface FirewoodParams {
  /** a turn of this copy off its pile's line (a pile is two stacks side by side) */
  readonly dy: number;
  /** the pile's one box (world space), carried by the first stack of a pile */
  readonly pile?: Box;
}

export interface ChurnParams {
  /** its box's half-width and height */
  readonly hw: number;
  readonly h: number;
}

export const watchtower = defineModel<object>(generatedModel<object>({
  id: 'nalati-grasslands/watchtower', name: 'Watchtower', category: 'buildings', pipeline: 'hunyuan',
  file: PLACES_FILE, surface: 'stone',
  defaults: {},
}, { id: 'nalati-grasslands/watchtower', name: 'watchtower', look: { rim: 0.3, bands: 0.8 } }));

export const saddledHorse = defineModel<object>(generatedModel<object>({
  id: 'nalati-grasslands/saddled-horse', name: 'Saddled horse (standing)', category: 'props', pipeline: 'hunyuan',
  file: PLACES_FILE, surface: 'flesh',
  defaults: {},
}, { id: 'nalati-grasslands/saddled-horse', name: 'horse-saddled', look: { rim: 0.8, bands: 0.85 } }));

export const kokparRider = defineModel<object>(generatedModel<object>({
  id: 'nalati-grasslands/kokpar-rider', name: 'Kokpar rider', category: 'people', pipeline: 'hunyuan',
  file: PLACES_FILE, surface: 'flesh',
  defaults: {},
}, { id: 'nalati-grasslands/kokpar-rider', name: 'kokpar-rider', look: { rim: 0.8, bands: 0.85 } }));
