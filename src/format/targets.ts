import * as v from 'valibot';
import { isJsonData } from './json';
import { hookRules, type ShardHooks } from './hooks';
import type { StateSchema } from './state';
import type { ShardScriptBindings } from './scripts';
import type { ShardItems } from './items';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const coord = v.pipe(finite, v.minValue(-250), v.maxValue(250));
/** Named panels and colliders follow published state; interactions enqueue a named scene on the existing input path. */
export const TargetsSchema: v.GenericSchema<ShardTargetsInput, ShardTargets> = v.strictObject({
  panels: v.pipe(v.array(v.strictObject({ panel: id, scope: v.picklist(['shared', 'player']), fieldId: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), equals: finite, visibleWhenMatched: v.boolean(), colliders: v.array(id), activeWhenMatched: v.boolean() })), v.maxLength(64)),
  interactions: v.pipe(v.array(v.strictObject({ id, at: v.tuple([coord, coord, coord]), radius: v.pipe(finite, v.minValue(0.1), v.maxValue(8)), label: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), scene: id })), v.maxLength(64)),
  itemActions: v.exactOptional(v.pipe(v.array(v.strictObject({ scene: id, item: id, action: v.picklist([3, 4]) })), v.maxLength(64))),
  itemFields: v.exactOptional(v.pipe(v.array(v.strictObject({ item: id, fieldId: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), property: v.picklist(['fuel', 'lit']) })), v.maxLength(64))),
});
/** Plain target bindings, without authored callbacks or collider mutations. */

/** Refuse dangling identities, private fields and two writers for the same visual or collider. */
export function targetRules(targets: ShardTargets, shard: { state: v.InferOutput<typeof StateSchema>; hooks: ShardHooks; sim: { scripts: readonly string[]; bindings: ShardScriptBindings }; items: ShardItems }, props: { panels: readonly { id: string }[]; colliders: readonly { id: string }[] } | null): string[] {
  const errors = hookRules({ conditions: targets.panels.map((row) => ({ id: row.panel, ...row })), scenes: [] }, shard.state);
  const panels = new Set(props?.panels.map((row) => row.id)), colliders = new Set(props?.colliders.map((row) => row.id)), scenes = new Set(shard.hooks.scenes.map((row) => row.id));
  const bound = targets.panels.flatMap((row) => row.colliders);
  if (new Set(bound).size !== bound.length || targets.panels.some((row) => !panels.has(row.panel) || row.colliders.some((collider) => !colliders.has(collider)))) errors.push('declared target panel/collider references');
  if (new Set(targets.interactions.map((row) => row.id)).size !== targets.interactions.length || targets.interactions.some((row) => !scenes.has(row.scene))) errors.push('declared target interaction scenes');
  if (targets.panels.length > 0 && shard.sim.bindings.length === 0) errors.push('target fields require script bindings');
  const actions = targets.itemActions ?? [], fields = targets.itemFields ?? [];
  if (new Set(actions.map((row) => row.scene)).size !== actions.length || actions.some((row) => !scenes.has(row.scene) || !shard.items.rows.some((item) => item.id === row.item && item.kind === 'tool'))) errors.push('declared item action scenes');
  if (new Set(fields.map((row) => row.fieldId)).size !== fields.length || fields.some((row) => {
    const field = shard.state.player.find((entry) => entry.id === row.fieldId), tool = shard.items.rows.find((item) => item.id === row.item && item.kind === 'tool');
    return tool === undefined || field === undefined || field.privacy === 'host' || field.type !== (row.property === 'lit' ? 'bool' : 'f64') || (field.min ?? 0) > 0 || (field.max ?? 1) < 1;
  })) errors.push('declared item state projections');
  if (fields.length > 0 && shard.sim.scripts.length === 0) errors.push('item projections require declared state lane');
  return errors;
}

/** Ordered native ray and aim projections. Owners are concrete entered loans;
 * declarations contain only ids, memory exclusions and readiness policy. */
export const CombatTargetRowsSchema: v.GenericSchema<CombatTargetRowsInput, CombatTargetRows> = v.pipe(v.unknown(), v.check(isJsonData, 'Combat targets require plain JSON data'), v.strictObject({
  ray: v.exactOptional(v.strictObject({ sources: v.pipe(v.array(id), v.maxLength(32), v.check(ids => new Set(ids).size === ids.length)),
    result: v.picklist(['copy', 'in-place']), requires: v.exactOptional(v.literal('population.wildlife')) })),
  aim: v.exactOptional(v.strictObject({ exclude: v.pipe(v.array(v.strictObject({ field: id, equals: finite })), v.maxLength(16)),
    append: v.pipe(v.array(id), v.maxLength(32), v.check(ids => new Set(ids).size === ids.length)) })),
}), v.check(row => row.ray !== undefined || row.aim !== undefined));


/** Concrete entered owner selection for the existing ordered target reducer. */
export const DeclaredCombatTargetsSchema: v.StrictObjectSchema<{
  kind:v.LiteralSchema<'combat.targets',undefined>; rows:v.GenericSchema<unknown,CombatTargetRows>;
  bindings:v.GenericSchema<unknown,{id:string;kind:'arena-room'|'timed-encounters';owner:string}[]>;
},undefined> = v.strictObject({kind:v.literal('combat.targets'),rows:CombatTargetRowsSchema,
  bindings:v.pipe(v.array(v.strictObject({id,kind:v.picklist(['arena-room','timed-encounters']),owner:id})),v.maxLength(32),v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length,'Unique target owner bindings'))});

/** Admitted data contracts, independent of validator implementation metadata. */
export type ShardTargetsInput = ShardTargets;
interface ShardTargetsFields {
    panels: ({
        panel: string;
        scope: 'shared' | 'player';
        fieldId: number;
        equals: number;
        visibleWhenMatched: boolean;
        colliders: (string)[];
        activeWhenMatched: boolean;
    })[];
    interactions: ({
        id: string;
        at: [
            number,
            number,
            number
        ];
        radius: number;
        label: string;
        scene: string;
    })[];
    itemActions?: ({
        scene: string;
        item: string;
        action: 3 | 4;
    })[];
    itemFields?: ({
        item: string;
        fieldId: number;
        property: 'fuel' | 'lit';
    })[];
}
export type ShardTargets = { [Key in keyof ShardTargetsFields]: ShardTargetsFields[Key] };
export type CombatTargetRowsInput = unknown;
interface CombatTargetRowsFields {
    ray?: {
        sources: (string)[];
        result: 'copy' | 'in-place';
        requires?: 'population.wildlife';
    };
    aim?: {
        exclude: ({
            field: string;
            equals: number;
        })[];
        append: (string)[];
    };
}
export type CombatTargetRows = { [Key in keyof CombatTargetRowsFields]: CombatTargetRowsFields[Key] };
