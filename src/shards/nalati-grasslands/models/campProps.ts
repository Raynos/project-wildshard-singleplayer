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
import { defineModel } from '@wildshard/engine/models/model';
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
