import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const list = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
const point = v.strictObject({ x: finite, y: finite, z: finite });
const surface = v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']);
const params = v.record(id, v.unknown());
const box = v.strictObject({ x: finite, z: finite, hw: v.pipe(finite, v.minValue(0)), hd: v.pipe(finite, v.minValue(0)), rot: finite, yTop: finite, yBottom: finite });
const floor = v.strictObject({ x: finite, z: finite, hw: v.pipe(finite, v.minValue(0)), hd: v.pipe(finite, v.minValue(0)), y: finite, rot: v.exactOptional(finite), slope: v.exactOptional(finite), tilt: v.exactOptional(finite) });
const site = v.strictObject({ piece: v.exactOptional(id), origin: point, colliders: list(box, 2048), floors: list(floor, 4096), anchors: v.record(id, v.strictObject({ ...point.entries, yaw: finite })) });
const draw = v.strictObject({ id, library: id, model: id, material: id, castShadow: v.optional(v.boolean(), false), receiveShadow: v.optional(v.boolean(), false), renderOrder: v.optional(finite, 0),
  until: v.exactOptional(v.pipe(finite, v.minValue(0))), sphere: v.exactOptional(v.tuple([finite, finite, finite, v.pipe(finite, v.minValue(0))])) });
const levelSchema = v.strictObject({ from: v.pipe(finite, v.minValue(0)), draws: list(draw, 64) });
const choice = v.strictObject({ id, params, size: v.tuple([finite, finite, finite]), draws: list(draw, 64), lods: v.optional(list(levelSchema, 8), []), colliders: list(v.unknown(), 2048), site: v.exactOptional(site) });
const model = v.strictObject({ key: id, id, name: id, file: id, category: v.picklist(['buildings', 'nature', 'props', 'gear']), pipeline: v.picklist(['code', 'blender', 'trellis', 'hunyuan', 'cc0']), surface: v.exactOptional(surface), defaults: params,
  variants: v.optional(list(v.strictObject({ id, label: id, params }), 128), []), assembly: v.optional(v.picklist(['weld', 'parts']), 'weld'), choices: list(choice, 128) });
/** Static model recipes over Z2's product libraries and material slots. No executable ports. */
export const WorldSceneModelsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Scene model recipes require plain JSON'),
  v.strictObject({ product: v.pipe(id, v.regex(/^[a-z_][a-z0-9_-]{0,63}$/u)), models: list(model, 128) }),
  v.check(row => new Set(row.models.map(entry => entry.key)).size === row.models.length && new Set(row.models.map(entry => entry.id)).size === row.models.length
    && row.models.every(entry => entry.id.startsWith(`${row.product}/`) && entry.choices.length > 0 && new Set(entry.choices.map(value => value.id)).size === entry.choices.length
      && entry.choices.every(value => [value.draws, ...value.lods.map(level => level.draws)].every(parts => new Set(parts.map(part => part.id)).size === parts.length)
        && value.lods.every((level, i) => level.from === entry.choices[0]?.lods[i]?.from && (i === 0 || level.from > (value.lods[i - 1]?.from ?? Infinity)))
        && value.lods.length === entry.choices[0]?.lods.length && (entry.assembly === 'parts' || value.lods.length === 0))), 'Unique scene model and choice identities with ordered shared LOD bands'));
export type WorldSceneModels = v.InferOutput<typeof WorldSceneModelsSchema>;
export function parseWorldSceneModels(input: unknown): WorldSceneModels { return v.parse(WorldSceneModelsSchema, input); }
