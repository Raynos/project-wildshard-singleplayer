import * as v from 'valibot';
import { isJsonData } from './json';
import { WorldSceneWeldSchema, type WorldSceneWeld } from './worldSceneWeld';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite(), v.minValue(-1e6), v.maxValue(1e6));
const list = <T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: T, max: number) => v.pipe(v.array(schema), v.maxLength(max));
const point = v.strictObject({ x: finite, y: finite, z: finite });
const surface = v.picklist(['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water', 'wood', 'metal', 'flesh', 'shell', 'ground', 'edge', 'felt', 'earth']);
const params = v.record(id, v.unknown());
const box = v.strictObject({ x: finite, z: finite, hw: v.pipe(finite, v.minValue(0)), hd: v.pipe(finite, v.minValue(0)), rot: finite, yTop: finite, yBottom: finite });
const floor = v.strictObject({ x: finite, z: finite, hw: v.pipe(finite, v.minValue(0)), hd: v.pipe(finite, v.minValue(0)), y: finite, rot: v.exactOptional(finite), slope: v.exactOptional(finite), tilt: v.exactOptional(finite), profile: v.exactOptional(v.pipe(v.array(v.tuple([finite, v.pipe(finite, v.minValue(0)), finite])), v.minLength(2), v.maxLength(8), v.check(knots => knots.every((k, i) => i === 0 || k[0] > (knots[i - 1]?.[0] ?? Infinity))))) });
const site = v.strictObject({ piece: v.exactOptional(id), origin: point, colliders: list(box, 2048), floors: list(floor, 4096), anchors: v.record(id, v.strictObject({ ...point.entries, yaw: finite })) });
const distance = v.pipe(finite, v.minValue(0));
const band = v.union([distance, v.strictObject({ phone: distance, desktop: distance })]);
const knob = v.pipe(id, v.regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+$/u));
const drawDistance = v.union([band, v.strictObject({ knob, multiply: v.optional(distance, 1), add: v.optional(distance, 0) })]);
const flag = v.union([v.boolean(), v.strictObject({ phone: v.boolean(), desktop: v.boolean() }), v.strictObject({ knob })]);
const draw = v.strictObject({ id, library: id, model: id, material: id, castShadow: v.optional(flag, false), receiveShadow: v.optional(v.boolean(), false), renderOrder: v.optional(finite, 0),
  until: v.exactOptional(drawDistance), depthOnly: v.exactOptional(v.boolean()), sphere: v.exactOptional(v.tuple([finite, finite, finite, v.pipe(finite, v.minValue(0))])) });
const levelSchema = v.strictObject({ from: band, draws: list(draw, 64) });
const distanceAt = (value: v.InferOutput<typeof band> | undefined, tier: 'phone' | 'desktop'): number => value === undefined ? Infinity : typeof value === 'number' ? value : value[tier];
const graphLeaf: v.GenericSchema<unknown, WorldSceneWeld | { file: string }> = v.union([WorldSceneWeldSchema, v.strictObject({ file: id })]);
const graphChoice = v.union([graphLeaf, v.strictObject({ phone: graphLeaf, desktop: graphLeaf })]);
const frozen = v.union([graphChoice, v.strictObject({ knob, false: graphChoice, true: graphChoice })]);
const choice = v.strictObject({ id, params, size: v.tuple([finite, finite, finite]), draws: list(draw, 64), scene: v.exactOptional(frozen), lods: v.optional(list(levelSchema, 8), []), colliders: list(v.unknown(), 2048), site: v.exactOptional(site) });
const model = v.strictObject({ key: id, id, name: id, file: id, category: v.picklist(['buildings', 'nature', 'creatures', 'people', 'gear', 'props']), pipeline: v.picklist(['code', 'blender', 'trellis', 'hunyuan', 'cc0']), surface: v.exactOptional(surface), specimenYaw: v.exactOptional(finite), defaults: params,
  variants: v.optional(list(v.strictObject({ id, label: id, params }), 128), []), assembly: v.optional(v.picklist(['weld', 'parts', 'objects', 'scene']), 'weld'), choices: list(choice, 128) });
/** Static model recipes over Z2's product libraries and material slots. No executable ports. */
export const WorldSceneModelsSchema: v.GenericSchema<unknown, WorldSceneModels> = v.pipe(v.unknown(), v.check(isJsonData, 'Scene model recipes require plain JSON'),
  v.strictObject({ product: v.pipe(id, v.regex(/^[a-z_][a-z0-9_-]{0,63}$/u)), models: list(model, 128) }),
  v.check(row => new Set(row.models.map(entry => entry.key)).size === row.models.length && new Set(row.models.map(entry => entry.id)).size === row.models.length
    && row.models.every(entry => entry.id.startsWith(`${row.product}/`) && entry.choices.length > 0 && new Set(entry.choices.map(value => value.id)).size === entry.choices.length
      && entry.choices.every(value => [value.draws, ...value.lods.map(level => level.draws)].every(parts => new Set(parts.map(part => part.id)).size === parts.length)
        && value.lods.every((level, i) => (['phone', 'desktop'] as const).every(tier => distanceAt(level.from, tier) === distanceAt(entry.choices[0]?.lods[i]?.from, tier)
          && (i === 0 || distanceAt(level.from, tier) > distanceAt(value.lods[i - 1]?.from, tier))))
        && value.lods.length === entry.choices[0]?.lods.length && (entry.assembly === 'parts' || value.lods.length === 0)
        && (entry.assembly === 'scene') === (value.scene !== undefined)
        && value.draws.every(part => part.depthOnly !== true || entry.assembly === 'objects'))), 'Unique scene model and choice identities with ordered shared LOD bands'));
export interface WorldSceneModels { product: string; models: v.InferOutput<typeof model>[] }
export function parseWorldSceneModels(input: unknown): WorldSceneModels { return v.parse(WorldSceneModelsSchema, input); }

/** Both topology choices are admitted before any model can allocate. */
export function worldSceneModelGraphs(entry: WorldSceneModels['models'][number]['choices'][number]): readonly v.InferOutput<typeof graphLeaf>[] {
  if (entry.scene === undefined) return [];
  const expand = (value: v.InferOutput<typeof graphChoice>): readonly v.InferOutput<typeof graphLeaf>[] => 'nodes' in value || 'file' in value ? [value] : [value.phone, value.desktop];
  return 'knob' in entry.scene ? expand(entry.scene.false).concat(expand(entry.scene.true)) : expand(entry.scene);
}
/** Resource declarations include frozen specimens, without allocating their owner-local materials. */
export function worldSceneModelResources(rows: WorldSceneModels, admitted: readonly WorldSceneWeld[] = []): { readonly geometry: readonly { readonly library: string; readonly model: string }[]; readonly materials: readonly string[] } {
  const choices = rows.models.flatMap(entry => entry.choices), graphs = choices.flatMap(worldSceneModelGraphs).flatMap(entry => 'file' in entry ? [] : [entry]).concat(admitted);
  const draws = choices.flatMap(entry => entry.draws.concat(entry.lods.flatMap(level => level.draws)));
  return { geometry: [...draws, ...graphs.flatMap(graph => graph.nodes.flatMap(node => 'geometry' in node ? [node.geometry] : []))],
    materials: [...draws.map(entry => entry.material), ...graphs.flatMap(graph => {
      const local = new Set(graph.materials.map(row => row.id));
      return graph.nodes.flatMap(node => 'material' in node && node.material !== '$shadow' && !local.has(node.material) ? [node.material] : [])
        .concat(graph.materials.flatMap(row => row.source === undefined || local.has(row.source.material) ? [] : [row.source.material]));
    })] };
}
