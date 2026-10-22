import * as v from 'valibot';
import { BuildingLifeLookSchema, BuildingLifeRowsSchema } from './buildings';
import { WorldSceneWeldSchema } from './worldSceneWeld';
import { PageWaterBindingSchema } from './pagePreparation';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const point = { x: n, y: n, z: n }, count = v.pipe(n, v.integer(), v.minValue(0));
const floor = v.strictObject({ ...point, hw: n, hd: n, rot: n }), tier = v.picklist(['phone', 'desktop']);
const place = v.strictObject({ ...point, nx: n, ny: n, nz: n, rot: n, scale: n, r: n, g: n, b: n, matrix: v.pipe(v.array(n), v.length(16)) });
/** Client-only forest cover and living settlements, with native resources by id. */
export const ForestPageSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Forest page requires JSON rows'), v.strictObject({
  water: PageWaterBindingSchema, treeLooks: v.pipe(v.array(v.strictObject({ look: id, band: v.picklist(['trunk', 'cards', 'twigs', 'far']), fade: id, viewer: id })), v.maxLength(4)),
  id, graphs: v.array(id), wildlife: id,
  streams: v.strictObject({ group: id, water: id, spray: id }),
  sliceMs: v.pipe(n, v.minValue(1), v.maxValue(100)), ground: v.strictObject({ appearance: id, layout: id, sources: v.array(id), kinds: v.pipe(v.array(v.strictObject({ id, geometry: id, model: id, name: id })), v.maxLength(6)),
    far: id, shadow: id, cells: v.strictObject({ size: n, pad: n, extraFar: n }) }),
  buildings: v.strictObject({ id, root: id, shells: id, life: BuildingLifeLookSchema,
    shared: id, shadow: id, sites: id,
    variants: v.pipe(v.array(v.strictObject({ tier: v.picklist(['phone', 'desktop']), shadow: v.boolean(), shared: v.boolean(), file: id })), v.maxLength(8)),
    light: v.strictObject({ count: v.pipe(count, v.maxValue(4)), color: n, intensity: n, distance: n, decay: n }),
    hearth: id, sunParam: id, lampsParam: id, shadeParam: id, nightShade: n, sightSlack: n,
    material: id, save: id, floors: v.pipe(v.array(floor), v.maxLength(128)), firePits: v.pipe(v.array(v.strictObject(point)), v.maxLength(16)),
  }), props: v.pipe(v.array(id), v.maxLength(3)),
  lanterns: v.strictObject({ texture: id, color: n, size: n, order: n, range: n, day: n, flicker: v.tuple([n, n, n, n]),
    light: v.strictObject({ color: n, intensity: n, distance: n, decay: n }), rows: v.pipe(v.array(v.strictObject({ id, at: v.tuple([n, n, n]) })), v.maxLength(16)) }),
  landmarks: v.pipe(v.array(v.union([v.strictObject({ place: id, tier: v.exactOptional(tier) }), v.strictObject({ object: id, tier: v.exactOptional(tier) })])), v.maxLength(48)),
}));
export type ForestPageRows = v.InferOutput<typeof ForestPageSchema>;
/** Layout counts remain independently admitted and bounded across all kinds. */
const groundCounts = (row: { readonly counts: readonly number[]; readonly layout: Readonly<Record<string, readonly unknown[]>> }): boolean => {
  const total = Object.values(row.layout).reduce((sum, entries) => sum + entries.length, 0);
  return total <= 40_000 && row.counts.length === Object.keys(row.layout).length && total === row.counts.reduce((sum, amount) => sum + amount, 0);
};
export const ForestGroundLayoutSchema = v.pipe(v.strictObject({ counts: v.array(count), layout: v.record(id, v.pipe(v.array(place), v.maxLength(40_000))) }),
  v.check(row => groundCounts(row), 'Invalid forest ground counts'));
export type ForestGroundLayout = v.InferOutput<typeof ForestGroundLayoutSchema>;
const GroundShellSchema = v.pipe(v.strictObject({ counts: v.array(count), layout: v.record(id, v.pipe(v.array(v.unknown()), v.maxLength(40_000))) }),
  v.check(row => groundCounts(row), 'Invalid forest ground counts'));
const GROUND_STEP = 1024, groundPlacements = v.array(place);
/** `ForestGroundLayoutSchema` in steps of 1024 placements, the same rules and output: Pine's layout (up to 40k
 *  placements) was one ~90 ms parse in a drawn frame. */
export function* forestGroundLayoutSteps(input: unknown): Generator<void, ForestGroundLayout> {
  const shell = v.parse(GroundShellSchema, input), layout: Record<string, GroundPlacement[]> = {};
  for (const [kind, entries] of Object.entries(shell.layout)) {
    const placements: GroundPlacement[] = [];
    for (let at = 0; at < entries.length; at += GROUND_STEP) { placements.push(...v.parse(groundPlacements, entries.slice(at, at + GROUND_STEP))); yield; }
    layout[kind] = placements;
  }
  return { counts: shell.counts, layout };
}
export const LivingPageInputSchema = v.object({ graph: WorldSceneWeldSchema, life: BuildingLifeRowsSchema,
  geometry: v.array(v.object({ key: id, id, source: v.object({ library: id, model: id }) })) });
export const LivingPageSitesSchema = v.strictObject({ buildings: v.array(v.strictObject({ id, index: count, root: id, standalone: v.boolean() })),
  roofs: v.array(v.strictObject({ x: n, z: n, rot: n, w: n, d: n })) });
export type GroundPlacement = v.InferOutput<typeof place>;
