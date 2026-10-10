import type { SimCommand } from '@wildshard/engine/sim';
import * as v from 'valibot';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0x7fffffff));
/** Strict bounded player, script and event inputs admitted at the worker tick boundary. */
export const TickCommandSchema = v.variant('kind', [
  // `hover: true` is the HOVER press this tick: on or off the hoverboard (SimCommand.hover); `jump: true` / `dodge: true`
  // the JUMP / DODGE press (SimCommand.jump / .dodge). `heavy` is a HELD state, not a press: the HEAVY hold is down this
  // tick (the touch ATTACK hold, the desktop latch), aimed at `targetId` when the crosshair is on one; the first tick
  // without it releases. The runtime's weapon reads it with its own law (SweptMeleeCore.step's `held`; a hold-to-release
  // weapon's charge); SimHost has no heavy of its own. `dive` / `surface` are held booleans read by the installed water law.
  v.pipe(v.strictObject({ kind: v.literal('player'), moveX: finite, moveZ: finite, yaw: finite, attack: v.optional(v.strictObject({ targetId: text })), hover: v.optional(v.literal(true)),
    jump: v.optional(v.literal(true)), dodge: v.optional(v.literal(true)), heavy: v.optional(v.strictObject({ targetId: v.optional(text) })),
    dive: v.exactOptional(v.boolean()), surface: v.exactOptional(v.boolean()),
    commandVersion: v.exactOptional(v.literal(1)), steer: v.exactOptional(v.strictObject({ keyX: v.pipe(finite, v.minValue(-1), v.maxValue(1)), keyY: v.pipe(finite, v.minValue(-1), v.maxValue(1)),
      stickX: v.pipe(finite, v.minValue(-1), v.maxValue(1)), stickY: v.pipe(finite, v.minValue(-1), v.maxValue(1)) })), sprint: v.exactOptional(v.boolean()), crouch: v.exactOptional(v.boolean()) }),
    v.check(command => command.commandVersion === 1 || (command.steer === undefined && command.sprint === undefined && command.crouch === undefined), 'Raw movement requires commandVersion 1')),
  v.strictObject({ kind: v.literal('script'), actorId: text, value: finite }),
  v.strictObject({ kind: v.literal('event'), type: natural, target: natural, value: finite }),
]);
/** A detached input admitted before the fixed tick; every source shares the shard's one command allowance. */
export type HeadlessCommand = v.InferOutput<typeof TickCommandSchema>;
/** The same detached player command for both native worker paths; absent optional fields stay absent. */
export function simPlayerCommand(command: Extract<HeadlessCommand, { kind: 'player' }>): SimCommand {
  return { moveX: command.moveX, moveZ: command.moveZ, yaw: command.yaw,
    ...(command.attack === undefined ? {} : { attack: { ...command.attack } }),
    ...(command.hover === undefined ? {} : { hover: command.hover }), ...(command.jump === undefined ? {} : { jump: command.jump }),
    ...(command.dodge === undefined ? {} : { dodge: command.dodge }),
    ...(command.dive === undefined ? {} : { dive: command.dive }), ...(command.surface === undefined ? {} : { surface: command.surface }),
    ...(command.commandVersion === undefined ? {} : { commandVersion: command.commandVersion }),
    ...(command.steer === undefined ? {} : { steer: { ...command.steer } }),
    ...(command.sprint === undefined ? {} : { sprint: command.sprint }), ...(command.crouch === undefined ? {} : { crouch: command.crouch }) };
}
/** Command provenance is retained for auditing; splitting a batch never grants another allowance. */
export interface HeadlessCommandSource { source: string; commands: readonly HeadlessCommand[] }
/** Detached gameplay facts and coin effects published only after a completed tick. */
export const TickEffectSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('fact'), name: text, actorId: text }),
  v.strictObject({ kind: v.literal('coins'), amount: finite, actorId: text }),
]);
/** Only completed, in-budget ticks can expose these durable quest requests to the parent. */
export type HeadlessEffect = v.InferOutput<typeof TickEffectSchema>;
/** Validated tick result carrying its continuation, effects and optional script cost observations. */
export const TickCommitSchema = v.strictObject({ tick: natural, snapshot: v.pipe(v.string(), v.maxLength(32_000_000)), effects: v.pipe(v.array(TickEffectSchema), v.maxLength(1024)), fuelUsed: v.exactOptional(natural), scriptMicros: v.exactOptional(v.pipe(finite, v.minValue(0))) });
/** Complete same-engine continuation and effects from one atomically committed worker tick. */
export type HeadlessTickCommit = v.InferOutput<typeof TickCommitSchema>;
/** Worker request grammar for a bounded command step or an explicit finish proof. */
export const WorkerRequestSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('step'), commands: v.pipe(v.array(TickCommandSchema), v.maxLength(1024)) }),
  v.strictObject({ kind: v.literal('finish') }),
]);
/** Validate and copy ordered source batches against one aggregate per-tick command allowance. */
export function tickCommands(sources: readonly HeadlessCommandSource[], limit: number): HeadlessCommand[] {
  if (!Number.isInteger(limit) || limit < 0 || limit > 1024 || sources.length > 1024) throw new Error('Invalid tick command allowance');
  let count = 0;
  for (const source of sources) { v.parse(text, source.source); count += source.commands.length; if (count > limit) throw new Error('Aggregate commandsPerTick exceeded'); }
  return sources.flatMap(source => source.commands.map(command => v.parse(TickCommandSchema, command)));
}
