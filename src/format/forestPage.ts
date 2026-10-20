import * as v from 'valibot';
import { BuildingLifeLookSchema, BuildingLifeRowsSchema } from './buildings';
import { WorldSceneWeldSchema } from './worldSceneWeld';
import { PageWaterBindingSchema } from './pagePreparation';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const point = { x: n, y: n, z: n }, count = v.pipe(n, v.integer(), v.minValue(0));
const floor = v.strictObject({ ...point, hw: n, hd: n, rot: n });
const place = v.strictObject({ ...point, nx: n, ny: n, nz: n, rot: n, scale: n, r: n, g: n, b: n, matrix: v.pipe(v.array(n), v.length(16)) });
/** Client-only forest cover and living settlements, with native resources by id. */
export const ForestPageSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Forest page requires JSON rows'), v.strictObject({
  water: PageWaterBindingSchema, treeLooks: v.pipe(v.array(v.strictObject({ look: id, band: v.picklist(['trunk', 'cards', 'twigs', 'far']), fade: id, viewer: id })), v.maxLength(4)),
  id, graphs: v.array(id), wildlife: id,
  streams: v.strictObject({ group: id, water: id, spray: id }),
  trees: id, sliceMs: v.pipe(n, v.minValue(1), v.maxValue(100)), ground: v.strictObject({ appearance: id, layout: id, sources: v.array(id), kinds: v.pipe(v.array(v.strictObject({ id, geometry: id, model: id, name: id })), v.maxLength(6)),
    far: id, shadow: id, cells: v.strictObject({ size: n, pad: n, extraFar: n }) }),
  buildings: v.strictObject({ id, root: id, shells: id, life: BuildingLifeLookSchema,
    shared: id, shadow: id, sites: id,
    variants: v.pipe(v.array(v.strictObject({ tier: v.picklist(['phone', 'desktop']), shadow: v.boolean(), shared: v.boolean(), file: id })), v.maxLength(8)),
    light: v.strictObject({ count: v.pipe(count, v.maxValue(4)), color: n, intensity: n, distance: n, decay: n }),
    hearth: id, sunParam: id, lampsParam: id, shadeParam: id, nightShade: n, sightSlack: n,
    material: id, save: id, floors: v.pipe(v.array(floor), v.maxLength(128)), firePits: v.pipe(v.array(v.strictObject(point)), v.maxLength(16)),
  }), props: v.pipe(v.array(id), v.maxLength(3)),
}));
export type ForestPageRows = v.InferOutput<typeof ForestPageSchema>;
/** Layout counts remain independently admitted and bounded across all kinds. */
export const ForestGroundLayoutSchema = v.pipe(v.strictObject({ counts: v.array(count), layout: v.record(id, v.pipe(v.array(place), v.maxLength(40_000))) }),
  v.check(row => Object.values(row.layout).reduce((sum, entries) => sum + entries.length, 0) <= 40_000 && row.counts.length === Object.keys(row.layout).length
    && Object.values(row.layout).reduce((sum, entries) => sum + entries.length, 0) === row.counts.reduce((sum, amount) => sum + amount, 0), 'Invalid forest ground counts'));
export const LivingPageInputSchema = v.object({ graph: WorldSceneWeldSchema, life: BuildingLifeRowsSchema,
  geometry: v.array(v.object({ key: id, id, source: v.object({ library: id, model: id }) })) });
export const LivingPageSitesSchema = v.strictObject({ buildings: v.array(v.strictObject({ id, index: count, root: id, standalone: v.boolean() })),
  roofs: v.array(v.strictObject({ x: n, z: n, rot: n, w: n, d: n })) });
export type GroundPlacement = v.InferOutput<typeof place>;
