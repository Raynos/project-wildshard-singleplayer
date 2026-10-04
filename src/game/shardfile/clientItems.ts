import type { ItemRuntime } from '@wildshard/engine/combat/items';
import { SCRIPT_STATE_OP } from '@wildshard/engine/script/state';
import type { ScriptLane } from '@wildshard/engine/script/lane';
import type { Shardfile } from './schema';

/** A tool's direct input callback already queues its toggle; plumbing supplies its keys/touch and only the other scenes. */
export function handledItemInputs(source: Shardfile): ReadonlySet<string> {
  const handled = new Set<string>();
  for (const context of source.plumbing?.input ?? []) for (const action of context.actions) {
    const item = source.items.rows.find((row) => row.kind === 'tool' && row.action === action.id);
    if (item !== undefined && source.targets.itemActions?.some((row) => row.scene === action.scene && row.item === item.id && row.action === 3)) handled.add(action.id);
  }
  return handled;
}

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
