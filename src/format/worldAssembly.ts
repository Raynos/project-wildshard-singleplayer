import { isJsonData } from './json';
import { StreamedCoverSchema } from './streamedCover';
import { AmbientFlockSchema } from './ambientLife';
import * as v from 'valibot';
import { BuildingCloudPoseSchema } from './buildings';
import { HandleIdSchema } from './sceneRefs';
import { WorldEntryStepSchema } from './worldEntry';
import { RopeDeckSiteSchema, RopeDeckSpanSchema } from './ropeDeckSite';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const label = v.pipe(v.string(), v.minLength(1), v.maxLength(96));

/**
 * G571: a shard world's build as an ordered list of typed stages (game/shardfile/worldAssembly). Each stage loads one
 * admitted scene owner and publishes it as concrete entry-owner loans under its id: `place` an admitted scene placement
 * (its object, its Placed and its compiled floor), `site` a catalogue model site (its group, anchors, floor and Placed),
 * `mesh` / `group` an admitted scene part, `entry` declared world entry rows (format/worldEntry: their tier / variant
 * filter and row order) publishing the placements its applied rows loaded in row order, and when declared its `object`
 * (a scene part) and its `floor` (the compiled floor of one of its unconditional place rows).
 * `rope-deck` borrows loaded fixed draws to place a site and publish object/placed/floor/rope-deck loans;
 * `rope-chain` allocates from an earlier deck at its later stage, registers only fixed-post capture and publishes a
 * chain loan. A streamed-cover stage keeps original pre-read cells and native update/viewer authority,
 * reads its existing composition before one placement, and publishes object/placed loans without a second intake.
 * An ambient-flock stage borrows loaded draws and clones the original lent material to construct
 * one flock draw, publishing object/ambient-draw/ambient loans without installing an updater. A site life descriptor runs after that site's existing slice, creating its cloud before reading
 * the existing building-life file and publishing its concrete buildings loan. It adds no progress step. Per-frame interpolation stays with its existing entered owner. No row selects a phase or callback.
 */
export const WorldAssemblyStageSchema = v.variant('kind', [
  /** Borrow an already installed concrete world owner; no second intake or draw. */
  v.strictObject({ kind: v.literal('water-surface'), id, surface: id }),
  v.strictObject({ kind: v.literal('dressing-piece'), id, part: id }),
  v.strictObject({ kind: v.literal('dressing-anchor'), id, part: id, anchor: id }),
  v.strictObject({ kind: v.literal('dressing'), id, bindSets: v.boolean() }),
  v.strictObject({ kind: v.literal('fixed-draws'), id }),
  v.strictObject({ kind: v.literal('painted-reseed'), id, world: id }),
  v.strictObject({ kind: v.literal('painted-world'), id, world: id, weather: id,
    groups: v.pipe(v.array(v.strictObject({ name: id, object: id })), v.maxLength(16)),
    casters: v.pipe(v.array(id), v.maxLength(16)), forest: v.boolean() }),
  /** The weather occupies its exact ordered boundary without an extra progress slice. */
  v.strictObject({ kind: v.literal('weather'), id, file: id }),
  v.strictObject({ kind: v.literal('arena-script'), id, files: v.strictObject({ fight: id, geometry: id }), weather: id, anchor: id }),
  v.strictObject({ kind: v.literal('place'), id, label }),
  v.strictObject({ kind: v.literal('streamed-cover'), id, label, rows: StreamedCoverSchema, file: v.pipe(id, v.regex(/\.json$/)), placement: id,
    draws: v.pipe(v.record(id, id), v.maxEntries(64)), object: id, system: id }),
  v.strictObject({ kind: v.literal('ambient-flock'), id, label, rows: AmbientFlockSchema,
    draw: v.strictObject({ slot: id, look: id, castShadow: v.boolean() }), perches: v.pipe(v.array(v.strictObject({ x: finite, y: finite, z: finite })), v.maxLength(4096)) }),
  v.strictObject({ kind: v.literal('rope-deck'), id, label, site: RopeDeckSiteSchema, span: RopeDeckSpanSchema }),
  v.strictObject({ kind: v.literal('rope-chain'), id, label, deck: id, capture: id }),
  v.strictObject({ kind: v.literal('site'), id, label, model: id, choice: id,
    life: v.exactOptional(v.strictObject({ file: v.pipe(id, v.regex(/\.json$/)), root: HandleIdSchema, cloud: v.strictObject({ draw: id, look: id, pose: BuildingCloudPoseSchema }) })) }),
  v.strictObject({ kind: v.literal('mesh'), id, label, part: id }),
  v.strictObject({ kind: v.literal('group'), id, label, part: id }),
  v.strictObject({ kind: v.literal('entry'), id, label, rows: v.pipe(v.array(WorldEntryStepSchema), v.minLength(1), v.maxLength(1024)),
    object: v.exactOptional(v.strictObject({ as: v.picklist(['group', 'mesh', 'object']), part: id })), floor: v.exactOptional(id) }),
]);
/** Native checkpoints around one walk of the already-admitted stages. No row
 * names a callback, module, phase, object path or another run schedule. */
export const WorldConstructionSchema = v.strictObject({
  /** Optional for direct native construction; mandatory for the finite entry capability. */
  looks: v.exactOptional(v.strictObject({ unbound: v.pipe(v.array(id), v.maxLength(256)), bound: v.pipe(v.array(id), v.maxLength(256)) })),
  publish: v.exactOptional(v.strictObject({ draws: id, collection: id })),
  /** Snapshot only declared object loans at this construction boundary. */
  groups: v.exactOptional(v.pipe(v.array(v.strictObject({ name: id, object: id })), v.maxLength(64))),
  root: v.exactOptional(v.strictObject({ id, name: label })),
  /** Ending names remain authored data; the entered context selects standalone or cell. */
  variant: v.exactOptional(v.strictObject({ standalone: id, cell: id })),
  cells: v.exactOptional(v.strictObject({ phone: id, desktop: id })), seed: v.pipe(v.number(), v.integer(), v.minValue(0)),
  progress: v.strictObject({ kind: v.exactOptional(v.literal('checkpoints')), total: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2048)),
    start: v.exactOptional(label), finish: label, budgetMs: v.pipe(finite, v.minValue(0), v.maxValue(100)) }),
  checkpoints: v.pipe(v.array(v.strictObject({ stage: id, at: v.picklist(['before', 'after']),
    actions: v.pipe(v.array(v.variant('kind', [
      v.strictObject({ kind: v.literal('entry-floor'), floor: id }),
      v.strictObject({ kind: v.literal('slice') }),
      v.strictObject({ kind: v.literal('progress'), label, done: v.exactOptional(v.pipe(finite, v.minValue(0))) }),
      v.strictObject({ kind: v.literal('build-yield') }),
      v.strictObject({ kind: v.literal('macrotask') }),
      v.strictObject({ kind: v.literal('seed') }),
      v.strictObject({ kind: v.literal('require-baked'), id }),
    ])), v.minLength(1), v.maxLength(16)) })), v.maxLength(128)),
  gpu: v.exactOptional(v.strictObject({ label, roots: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ kind: v.literal('object'), id, when: v.exactOptional(v.strictObject({ variant: id })) }),
    v.strictObject({ kind: v.literal('placed'), id, when: v.exactOptional(v.strictObject({ variant: id })) }),
    v.strictObject({ kind: v.literal('scene-part'), as: v.picklist(['mesh', 'group', 'object']), id, when: v.exactOptional(v.strictObject({ variant: id })) }),
    v.strictObject({ kind: v.literal('baked'), id, when: v.exactOptional(v.strictObject({ variant: id })) }),
  ])), v.minLength(1), v.maxLength(256)) })),
});
export type WorldConstructionRows = v.InferOutput<typeof WorldConstructionSchema>;

export const WorldAssemblySchema = v.pipe(v.unknown(), v.check(isJsonData, 'World assembly requires plain JSON'), v.strictObject({ construction: v.exactOptional(WorldConstructionSchema), stages: v.pipe(v.array(WorldAssemblyStageSchema), v.minLength(1), v.maxLength(64)) }));
export type WorldAssemblyStage = v.InferOutput<typeof WorldAssemblyStageSchema>;
