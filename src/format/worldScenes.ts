import * as v from 'valibot';
import { isJsonData } from './json';
import { WorldSceneBindingsSchema } from './clientChannels';
import { WorldScenePlacementSchema } from './worldScenePlacement';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const triple = v.tuple([finite, finite, finite]);
const bounded = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
const strings = v.pipe(v.record(id, id), v.check(rows => Object.keys(rows).length <= 128));
const reference = v.strictObject({ library: id, model: id });
const library = v.variant('kind', [
  v.strictObject({ id, kind: v.literal('owned'), models: bounded(v.strictObject({ id, file: id, attributes: v.optional(strings, {}) }), 128) }),
  v.strictObject({ id, kind: v.literal('pool'), files: bounded(v.strictObject({ file: id, parts: bounded(id, 128) }), 32), painted: v.optional(bounded(v.strictObject({ id, file: id, geometry: id }), 32), []) }),
]);
const material = v.variant('kind', [
  v.strictObject({ id, kind: v.literal('source'), load: v.optional(v.picklist(['resident', 'placement']), 'resident'), url: id, aliases: v.optional(v.record(id, id), {}), part: v.optional(v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(127)), 0),
    anisotropy: v.optional(v.pipe(finite, v.minValue(1), v.maxValue(16)), 1), anisotropyMaps: v.optional(bounded(v.picklist(['map', 'normalMap', 'roughnessMap', 'aoMap']), 4), ['map', 'normalMap']), envMapIntensity: v.optional(finite, 1) }),
  v.strictObject({ id, kind: v.literal('lowpoly'), variant: id, properties: v.optional(v.strictObject({ flatShading: v.exactOptional(v.boolean()), roughness: v.exactOptional(finite) }), {}) }),
  v.strictObject({ id, kind: v.literal('basic'), properties: v.strictObject({ vertexColors: v.exactOptional(v.boolean()), color: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff))), side: v.exactOptional(v.picklist([0, 1, 2])) }) }),
  v.strictObject({ id, kind: v.literal('look'), look: id, over: v.exactOptional(reference) }),
  v.strictObject({ id, kind: v.literal('standard'), sky: v.exactOptional(v.boolean()), properties: v.strictObject({ color: v.exactOptional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff))), roughness: v.exactOptional(finite),
    metalness: v.exactOptional(finite), transparent: v.exactOptional(v.boolean()), opacity: v.exactOptional(finite), depthWrite: v.exactOptional(v.boolean()), vertexColors: v.exactOptional(v.boolean()) }) }),
]);
const box = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite, hx: v.pipe(finite, v.minValue(0)), hy: v.pipe(finite, v.minValue(0)), hz: v.pipe(finite, v.minValue(0)), yaw: v.exactOptional(finite), rot: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, w: finite })) });
const surface = v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']);
const point = v.strictObject({ x: finite, y: finite, z: finite });
const treads = v.strictObject({ kind: v.literal('treads'), from: point, to: point, width: v.pipe(finite, v.minValue(0)), count: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256)), surface: v.exactOptional(surface) });
const registry = v.strictObject({ id, name: id, file: id, category: v.picklist(['ground', 'nature', 'buildings', 'props']), part: id,
  colliders: bounded(v.variant('kind', [box, treads]), 2048), surface: v.exactOptional(surface), solidFloor: v.optional(v.boolean(), false) });
const instance = v.strictObject({ id, position: v.exactOptional(triple), rotation: v.exactOptional(triple) });
const step = v.strictObject({ id, scene: v.exactOptional(id), variants: v.exactOptional(v.strictObject({ standalone: id, cell: id })),
  geometry: v.optional(v.pipe(v.record(id, reference), v.check(rows => Object.keys(rows).length <= 128)), {}),
  materials: v.optional(strings, {}), registry: v.optional(bounded(registry, 128), []),
  publish: v.optional(WorldSceneBindingsSchema, {}), repeat: v.exactOptional(bounded(instance, 128)),
  instanceAttributes: v.optional(bounded(v.strictObject({ part: id, name: id, width: v.picklist([1, 2, 3, 4]), values: bounded(finite, 32768) }), 32), []),
  bounds: v.optional(bounded(v.strictObject({ part: id, sphere: v.strictObject({ center: triple, radius: v.pipe(finite, v.minValue(0)) }) }), 128), []),
});
const unique = (rows: readonly { readonly id: string }[]) => new Set(rows.map(row => row.id)).size === rows.length;
/** Client-only static assembly. Recipes, slots and named references are bounded plain data. */
export const WorldScenesSchema = v.pipe(v.unknown(), v.check(isJsonData, 'World scenes require plain JSON'),
  v.strictObject({ version: v.literal(1), libraries: bounded(library, 32), materials: bounded(material, 128), steps: bounded(step, 64), catalogue: v.exactOptional(id),
    placements: v.optional(bounded(v.union([WorldScenePlacementSchema, v.strictObject({ id, file: id })]), 128), []) }),
  v.check(row => unique(row.libraries) && unique(row.materials) && unique(row.steps) && unique(row.placements) && (row.placements.length === 0 || row.catalogue !== undefined)
    && row.libraries.every(entry => entry.kind === 'owned' ? unique(entry.models) : new Set(entry.files.flatMap(file => file.parts)).size === entry.files.flatMap(file => file.parts).length && unique(entry.painted) && entry.painted.every(model => entry.files.some(file => file.parts.includes(model.geometry))))
    && row.steps.every(entry => (entry.scene === undefined) !== (entry.variants === undefined) && (entry.repeat === undefined || unique(entry.repeat))), 'Unique scene identities and exactly one recipe source'));
type ParsedWorldScenes = v.InferOutput<typeof WorldScenesSchema>;
export type WorldScenesSection = Omit<ParsedWorldScenes, 'placements'> & { readonly placements?: ParsedWorldScenes['placements'] };
/** Reject executable values, duplicate identities and unknown fields before allocating visuals. */
export function parseWorldScenes(input: unknown): ParsedWorldScenes { return v.parse(WorldScenesSchema, input); }
