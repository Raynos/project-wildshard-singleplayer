import * as v from 'valibot';
import { isJsonData } from './json';
import { WorldSceneSurfaceSchema } from './worldSceneSurface';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const nonnegative = v.pipe(finite, v.minValue(0));
const integer = v.pipe(nonnegative, v.integer());
const word = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffffff));
const layerMask = v.pipe(v.number(), v.integer(), v.minValue(-0x80000000), v.maxValue(0xffffffff));
const list = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
const bits = (length: number) => v.pipe(v.array(word), v.length(length));
const finiteWords = (values: readonly number[], wide: boolean): boolean => {
  const buffer = Uint32Array.from(values).buffer;
  return (wide ? new Float64Array(buffer) : new Float32Array(buffer)).every(Number.isFinite);
};
const sphere = v.tuple([finite, finite, finite, nonnegative]);
const box = v.tuple([finite, finite, finite, finite, finite, finite]);
const geometry = v.strictObject({ library: id, model: id });
const knob = v.pipe(id, v.regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/u));
/** Distances remain live quality inputs after the geometry has been baked. */
export const WorldSceneDistanceSchema = v.union([nonnegative, v.strictObject({ knob, multiply: v.optional(nonnegative, 1), add: v.optional(nonnegative, 0) })]);
const distance = WorldSceneDistanceSchema;
const common = { id, parent: id, name: v.optional(v.string(), ''), matrixBits: v.exactOptional(bits(32)), transformBits: v.exactOptional(bits(20)),
  matrixAutoUpdate: v.optional(v.boolean(), true), layers: v.optional(layerMask, 1), visible: v.optional(v.boolean(), true),
  frustumCulled: v.optional(v.boolean(), true), castShadow: v.optional(v.boolean(), false), receiveShadow: v.optional(v.boolean(), false),
  renderOrder: v.optional(finite, 0), until: v.exactOptional(distance), castFrom: v.exactOptional(distance) };
const draw = { geometry, material: id, sphere, box: v.exactOptional(box) };
/** Frozen draw topology, including ordinary weld batches and their shared-buffer selection views. */
export const WorldSceneWeldNodeSchema = v.variant('kind', [
  v.strictObject({ ...common, kind: v.literal('group') }),
  v.strictObject({ ...common, kind: v.literal('anchor') }),
  v.strictObject({ ...common, ...draw, kind: v.literal('mesh') }),
  v.strictObject({ ...common, ...draw, kind: v.literal('batch') }),
  v.strictObject({ ...common, ...draw, kind: v.literal('instances'), capacity: v.pipe(integer, v.minValue(1), v.maxValue(8192)),
    count: v.pipe(integer, v.maxValue(8192)), matrixWords: list(word, 131072), instanceSphere: sphere, instanceBox: v.exactOptional(box) }),
  v.strictObject({ ...common, kind: v.literal('view'), batch: id, start: integer, count: integer, sphere, box }),
  v.strictObject({ ...common, kind: v.literal('cloud'), material: id, seedWords: list(word, 131072), sphere }),
  v.strictObject({ ...common, kind: v.literal('light'), color: v.pipe(word, v.maxValue(0xffffff)), intensity: nonnegative, distance: nonnegative, decay: nonnegative }),
]);
const hosted = v.strictObject({ meshes: list(id, 128), lists: list(v.strictObject({ unit: integer, matrixWords: list(word, 131072) }), 128) });
/** Fresh specimen materials copy only declared maps, retaining native constructor defaults (a world-scenes section's
 *  `mapped` material row is the same grammar). */
export const WorldSceneWeldMaterialSchema = v.strictObject({ id, kind: v.picklist(['standard', 'basic']),
  source: v.exactOptional(v.strictObject({ material: id, maps: list(v.picklist(['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']), 5) })),
  properties: WorldSceneSurfaceSchema.entries.properties, sky: v.optional(v.boolean(), false),
  blending: v.exactOptional(v.picklist([0, 1, 2, 3, 4, 5])), fog: v.exactOptional(v.boolean()) });
/** A weld captures roots and unit order; band values are resolved from current plumbing. */
const cull = v.strictObject({ roots: list(id, 128), origins: list(finite, 384), units: list(integer, 128), details: list(distance, 128), hosted: list(hosted, 128) });
const setRow = v.strictObject({ id, name: id, file: id, place: v.exactOptional(id), members: list(id, 128) });
const resource = v.variant('kind', [v.strictObject({ id, kind: v.literal('geometry'), source: geometry }),
  v.strictObject({ id, kind: v.literal('seeds'), words: v.pipe(list(word, 131072), v.check(values => values.length % 4 === 0 && finiteWords(values, false))) })]);
export const WorldSceneWeldSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Frozen scenes require plain JSON'),
  v.strictObject({ id, root: id, result: v.exactOptional(id), nodes: list(WorldSceneWeldNodeSchema, 4096), materials: v.optional(list(WorldSceneWeldMaterialSchema, 128), []), culls: v.optional(list(cull, 32), []),
    placements: v.optional(list(id, 128), []), sets: v.optional(list(setRow, 32), []), resources: v.optional(list(resource, 512), []) }),
  v.check(row => new Set(row.nodes.map(node => node.id)).size === row.nodes.length && new Set(row.materials.map(entry => entry.id)).size === row.materials.length
    && new Set(row.placements).size === row.placements.length && new Set(row.sets.map(entry => entry.id)).size === row.sets.length
    && new Set(row.resources.map(entry => entry.id)).size === row.resources.length
    && row.sets.every(entry => entry.members.every(member => row.placements.includes(member)))
    && (row.result === undefined || row.result === row.root || row.nodes.some(node => node.id === row.result))
    && row.nodes.every(node => node.id !== row.root
      && (node.matrixBits === undefined || finiteWords(node.matrixBits, true) && (!node.matrixAutoUpdate || node.transformBits !== undefined))
      && (node.transformBits === undefined || finiteWords(node.transformBits, true))
      && (node.kind !== 'instances' || node.count <= node.capacity && node.matrixWords.length === node.capacity * 16 && finiteWords(node.matrixWords, false))
      && (node.kind !== 'cloud' || node.seedWords.length % 4 === 0 && finiteWords(node.seedWords, false)))
    && row.culls.every(entry => entry.origins.length % 3 === 0 && entry.units.length === entry.details.length
      && entry.units.every(unit => unit < entry.origins.length / 3)
      && entry.hosted.every(set => set.lists.every(run => run.unit < entry.units.length && run.matrixWords.length % 16 === 0 && finiteWords(run.matrixWords, false))))
    && row.nodes.reduce((sum, node) => sum + (node.kind === 'instances' ? node.matrixWords.length : node.kind === 'cloud' ? node.seedWords.length : 0), 0) <= 1048576, 'Unique bounded frozen scene nodes and cull lanes'));
export type WorldSceneWeld = v.InferOutput<typeof WorldSceneWeldSchema>;
export type WorldSceneWeldNode = v.InferOutput<typeof WorldSceneWeldNodeSchema>;
const file = v.union([id, v.strictObject({ phone: id, desktop: id })]);
/** Geometry topology can follow an independent Debug quality override. */
export const WorldSceneWeldSourceSchema = v.strictObject({ id, file: v.union([file, v.strictObject({ knob, false: file, true: file })]) });
export function parseWorldSceneWeld(input: unknown): WorldSceneWeld { return v.parse(WorldSceneWeldSchema, input); }
