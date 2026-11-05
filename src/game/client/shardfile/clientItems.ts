import type { ItemRuntime } from '@wildshard/engine/combat/items';
import { SCRIPT_STATE_OP } from '@wildshard/engine/script/state';
import type { ScriptEffect } from '@wildshard/engine/script/effects';
import type { ScriptLane } from '@wildshard/engine/script/lane';
import type { Shardfile } from '@wildshard/format/shardSchema';

/** A tool's direct input callback already queues its toggle; plumbing supplies its keys/touch and only the other scenes. */
export function handledItemInputs(source: Shardfile): ReadonlySet<string> {
  const handled = new Set<string>();
  for (const context of source.plumbing?.input ?? []) for (const action of context.actions) {
    const item = source.items.rows.find((row) => row.kind === 'tool' && row.action === action.id);
    if (item !== undefined && source.targets.itemActions?.some((row) => row.scene === action.scene && row.item === item.id && row.action === 3)) handled.add(action.id);
  }
  return handled;
}

interface ProjectionFrames { depth: number; frames: ScriptEffect[][] }
// Only numeric scratch survives here. The weak key is the existing item owner;
// neither the cache nor a retained error stack roots a host through a closure.
const projectionFrames = new WeakMap<ReadonlyMap<string, ItemRuntime>, ProjectionFrames>();
/** Project read-only tool values through the same finite, actor-scoped state transaction used by admitted effects.
 * The world consumes the private numeric rows synchronously. Nested reads use
 * separate frames; only four frames stay retained after the call. */
export function projectItemFields(source: Shardfile, runtimes: ReadonlyMap<string, ItemRuntime>, lane: Pick<ScriptLane, 'world'>, player: number): void {
  const rows = source.targets.itemFields;
  if (rows === undefined || rows.length === 0) return;
  let state = projectionFrames.get(runtimes);
  if (state === undefined) { state = { depth: 0, frames: [] }; projectionFrames.set(runtimes, state); }
  const at = state.depth++, effects = state.frames[at] ?? [];
  if (at < 4) state.frames[at] = effects;
  try {
    const length = rows.length;
    let used = 0;
    for (let index = 0; index < length; index++) {
      // The native world also skips absent rows in a sparse effect list.
      if (!(index in rows)) continue;
      const row = rows[index]; if (row === undefined) throw new Error('Missing authoritative item projection');
      const item = runtimes.get(row.item); if (item === undefined) throw new Error('Missing authoritative item projection');
      const value = row.property === 'fuel' ? item.remainingFuel : Number(item.lightOn), kept = effects[used];
      if (kept === undefined) effects[used] = { op: SCRIPT_STATE_OP.player, a: row.fieldId, b: value, c: 0, d: 0 };
      else { kept.op = SCRIPT_STATE_OP.player; kept.a = row.fieldId; kept.b = value; kept.c = 0; kept.d = 0; }
      used++;
    }
    effects.length = used;
    lane.world.prepare(effects, player, 0, 0).commit();
  } finally { state.depth--; }
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
