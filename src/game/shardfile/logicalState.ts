import * as v from 'valibot';
import type { ScriptLane } from '@wildshard/engine/script/lane';
import { LogicalStateSchema, type LogicalState } from './migrations';

const finite = v.pipe(v.number(), v.finite());
const fieldSchema = v.object({ id: v.number(), name: v.string(), type: v.picklist(['bool', 'i32', 'f64']) });
const declaration = v.object({ state: v.object({ shared: v.array(fieldSchema), player: v.array(fieldSchema) }) });
const laneState = v.object({ contract: v.string(), world: v.object({ shared: v.array(finite), players: v.array(v.object({ actorId: v.string(), values: v.array(finite) })) }) });
/** Extract only stable declared fields from a historical lane; WASM memory, pending effects, entity positions and budgets never migrate. */
export function logicalStateFromLane(version: number, text: string | null): LogicalState {
  if (text === null) return v.parse(LogicalStateSchema, { version, shared: [], players: [] });
  const input: unknown = JSON.parse(text), saved = v.parse(laneState, input);
  const contract: unknown = JSON.parse(saved.contract), fields = v.parse(declaration, contract).state;
  const values = (list: typeof fields.shared, data: number[]): LogicalState['shared'] => {
    if (list.length !== data.length) throw new Error('Logical field count mismatch');
    return list.map((entry, index) => {
      const value = data[index]; if (value === undefined || (entry.type === 'bool' && value !== 0 && value !== 1)) throw new Error('Invalid logical field value');
      return { ...entry, value: entry.type === 'bool' ? value === 1 : value };
    });
  };
  return v.parse(LogicalStateSchema, { version, shared: values(fields.shared, saved.world.shared),
    players: saved.world.players.map((player) => ({ actorId: player.actorId, fields: values(fields.player, player.values) })) });
}
/** Overlay migrated fields onto a freshly installed lane; new actors and all executable state remain freshly initialized. */
export function restoreLogicalLane(lane: ScriptLane | undefined, state: LogicalState): void {
  if (lane === undefined) {
    if (state.shared.length > 0 || state.players.some((player) => player.fields.length > 0)) throw new Error('Missing logical state lane');
    return;
  }
  const before = lane.world.checkpoint();
  const values = (fields: typeof lane.world.declaration.shared, saved: LogicalState['shared']): number[] => fields.map((field) => {
    const prior = saved.find((entry) => entry.id === field.id); if (prior === undefined) return field.default;
    const value = typeof prior.value === 'boolean' ? Number(prior.value) : prior.value;
    if (typeof value !== 'number') throw new Error('Non-numeric script state'); return value;
  });
  lane.world.restoreState({ ...before, shared: values(lane.world.declaration.shared, state.shared),
    players: before.players.map((player) => ({ actorId: player.actorId,
      values: values(lane.world.declaration.player, state.players.find((entry) => entry.actorId === player.actorId)?.fields ?? []) })) });
}
