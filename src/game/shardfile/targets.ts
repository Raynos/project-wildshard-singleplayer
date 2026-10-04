import * as v from 'valibot';
import { hookRules } from './hooks';
import type { Shardfile } from './schema';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const coord = v.pipe(finite, v.minValue(-250), v.maxValue(250));
/** Named panels and colliders follow published state; interactions enqueue a named scene on the existing input path. */
export const TargetsSchema = v.strictObject({
  panels: v.pipe(v.array(v.strictObject({ panel: id, scope: v.picklist(['shared', 'player']), fieldId: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(0x7fffffff)), equals: finite, visibleWhenMatched: v.boolean(), colliders: v.array(id), activeWhenMatched: v.boolean() })), v.maxLength(64)),
  interactions: v.pipe(v.array(v.strictObject({ id, at: v.tuple([coord, coord, coord]), radius: v.pipe(finite, v.minValue(0.1), v.maxValue(8)), label: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), scene: id })), v.maxLength(64)),
});
/** Plain target bindings, without authored callbacks or collider mutations. */
export type ShardTargets = v.InferOutput<typeof TargetsSchema>;
/** Refuse dangling identities, private fields and two writers for the same visual or collider. */
export function targetRules(targets: ShardTargets, shard: Pick<Shardfile, 'state' | 'hooks' | 'sim'>, props: { panels: readonly { id: string }[]; colliders: readonly { id: string }[] } | null): string[] {
  const errors = hookRules({ conditions: targets.panels.map((row) => ({ id: row.panel, ...row })), scenes: [] }, shard.state);
  const panels = new Set(props?.panels.map((row) => row.id)), colliders = new Set(props?.colliders.map((row) => row.id)), scenes = new Set(shard.hooks.scenes.map((row) => row.id));
  const bound = targets.panels.flatMap((row) => row.colliders);
  if (new Set(bound).size !== bound.length || targets.panels.some((row) => !panels.has(row.panel) || row.colliders.some((collider) => !colliders.has(collider)))) errors.push('declared target panel/collider references');
  if (new Set(targets.interactions.map((row) => row.id)).size !== targets.interactions.length || targets.interactions.some((row) => !scenes.has(row.scene))) errors.push('declared target interaction scenes');
  if (targets.panels.length > 0 && shard.sim.bindings.length === 0) errors.push('target fields require script bindings');
  return errors;
}
/** The authoritative host applies collider activation after scripts; client and headless runs share this function. */
export function syncTargetColliders(targets: ShardTargets, colliders: ReadonlyMap<string, { setActive: (active: boolean) => void }>, read: (scope: 'shared' | 'player', id: number) => number): void {
  for (const row of targets.panels) {
    const active = (read(row.scope, row.fieldId) === row.equals) === row.activeWhenMatched;
    for (const idValue of row.colliders) {
      const collider = colliders.get(idValue); if (collider === undefined) throw new Error('Missing declared target collider'); collider.setActive(active);
    }
  }
}
