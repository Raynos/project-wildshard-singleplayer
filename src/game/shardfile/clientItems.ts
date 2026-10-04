import type { ItemRuntime } from '@wildshard/engine/combat/items';
import { SCRIPT_STATE_OP } from '@wildshard/engine/script/state';
import type { ScriptLane } from '@wildshard/engine/script/lane';
import type { Shardfile } from './schema';

/** Project read-only tool values through the same finite, actor-scoped state transaction used by admitted effects. */
export function projectItemFields(source: Shardfile, runtimes: ReadonlyMap<string, ItemRuntime>, lane: Pick<ScriptLane, 'world'>, player: number): void {
  const effects = (source.targets.itemFields ?? []).map((row) => {
    const item = runtimes.get(row.item); if (item === undefined) throw new Error('Missing authoritative item projection');
    return { op: SCRIPT_STATE_OP.player, a: row.fieldId, b: row.property === 'fuel' ? item.remainingFuel : Number(item.lightOn), c: 0, d: 0 };
  });
  if (effects.length > 0) lane.world.prepare(effects, player, 0, 0).commit();
}
/** The same input/Debug/interaction scene routes an explicit tool action or a declared next-tick script event. */
export function clientScene(source: Shardfile, runtimes: ReadonlyMap<string, ItemRuntime>, fallback: (id: string) => void): (id: string) => void {
  const actions = new Map((source.targets.itemActions ?? []).map((row) => [row.scene, row]));
  return (id) => {
    const action = actions.get(id); if (action === undefined) { fallback(id); return; }
    const item = runtimes.get(action.item); if (item === undefined) throw new Error('Missing admitted scene item');
    item.queue(action.action);
  };
}
