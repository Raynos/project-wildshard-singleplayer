import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9.:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const at = v.pipe(finite, v.minValue(-10000), v.maxValue(10000));
const radius = v.pipe(finite, v.minValue(0), v.maxValue(600));
const positive = v.pipe(radius, v.minValue(0.001));
const speed = v.pipe(radius, v.maxValue(40));
const turn = v.pipe(radius, v.maxValue(30));
const seconds = v.pipe(positive, v.maxValue(600));
const angle = v.pipe(finite, v.minValue(-2 * Math.PI), v.maxValue(2 * Math.PI));
const motion = { speed, turn, ground: v.optional(v.boolean(), false) };
const ready = v.variant('kind', [
  v.strictObject({ kind: v.literal('over'), radius: positive, height: positive }),
  v.strictObject({ kind: v.literal('band'), tolerance: positive }),
  // The platform supplies the admitted strike's range, rather than duplicating it in a move.
  v.strictObject({ kind: v.literal('range'), strike: v.exactOptional(id) }),
]);
/** Data-only fixed-step motion. Decisions, strike selection, rewards and phase transitions are not moves. */
export const ActorMoveSchema = v.variant('kind', [
  v.strictObject({ id, kind: v.literal('orbit'), ...motion, center: v.tuple([at, at]), r: positive, y: at, lead: v.exactOptional(angle), angularSpeed: v.exactOptional(turn) }),
  v.pipe(v.strictObject({ id, kind: v.literal('stalk'), ...motion, standOff: radius, above: v.exactOptional(at), altitude: v.exactOptional(at),
    retreat: v.optional(v.boolean(), false), constantSpeed: v.optional(v.boolean(), false), ready, giveUp: v.exactOptional(seconds) }),
    v.check(row => (row.above === undefined) !== (row.altitude === undefined), 'one stalk altitude source')),
  v.strictObject({ id, kind: v.literal('dive'), ...motion, slope: radius, skim: at, altitude: at, aimHeight: at,
    targetAltitude: v.optional(v.boolean(), false), contactCompletes: v.optional(v.boolean(), true), maxSeconds: seconds, strike: v.exactOptional(id) }),
  v.pipe(v.strictObject({ id, kind: v.literal('climb'), ...motion, seconds, speedBonus: v.optional(speed, 0), altitude: at }),
    v.check(row => row.speed + row.speedBonus <= 40, 'bounded combined climb speed')),
  v.strictObject({ id, kind: v.literal('takeoff'), ...motion, perch: id, altitude: at, seconds, bank: v.pipe(radius, v.maxValue(Math.PI / 2)) }),
  v.strictObject({ id, kind: v.literal('perch'), ...motion, perch: id, arrival: v.optional(positive, 0.6) }),
  v.strictObject({ id, kind: v.literal('rise'), ...motion, from: at, to: at, rate: positive, yawLead: angle }),
  v.strictObject({ id, kind: v.literal('lie'), ...motion, from: at, to: at, rate: positive, yawLead: angle }),
  v.strictObject({ id, kind: v.literal('ring-run'), ...motion, radius: positive, angle }),
  v.strictObject({ id, kind: v.literal('burrow'), field: id, rate: positive }),
  v.strictObject({ id, kind: v.literal('surface'), field: id, rate: positive }),
]);
/** Plain `actors/moves` section, bounded and uniquely named. */
export const ActorMovesSchema = v.pipe(v.unknown(), v.check(isJsonData, 'plain JSON move data'), v.array(ActorMoveSchema), v.maxLength(256),
  v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'unique move ids'));
export type ActorMove = v.InferOutput<typeof ActorMoveSchema>;
export type ActorMoves = v.InferOutput<typeof ActorMovesSchema>;
/** Admit a whole motion catalogue before starting or replacing a move. */
export function parseActorMoves(input: unknown): ActorMoves { return v.parse(ActorMovesSchema, input); }
/** Resolve move references against actual platform registries, never alias names. */
export function actorMoveRules(rows: readonly ActorMove[], refs: { spots: ReadonlySet<string>; strikes: ReadonlySet<string>; fields: ReadonlySet<string> }): string[] {
  const failures = new Set<string>();
  for (const row of rows) {
    if ((row.kind === 'takeoff' || row.kind === 'perch') && !refs.spots.has(row.perch)) failures.add('move perch resolves in world spots');
    if (row.kind === 'stalk' && row.ready.kind === 'range' && row.ready.strike !== undefined && !refs.strikes.has(row.ready.strike)) failures.add('move range resolves in actors/strikes');
    if (row.kind === 'dive' && row.strike !== undefined && !refs.strikes.has(row.strike)) failures.add('move strike resolves in actors/strikes');
    if ((row.kind === 'burrow' || row.kind === 'surface') && !refs.fields.has(row.field)) failures.add('move field resolves in declared actor fields');
  }
  return [...failures];
}
