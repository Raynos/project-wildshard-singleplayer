import * as v from 'valibot';
import { HandleIdSchema } from './sceneRefs';
import { isJsonData } from './json';
import { EliteEnteredPresentationSchema, EliteOutputActionsSchema, ExternalEliteSchema, parseEliteOutputActions } from './eliteFeature';
import { CreatureStrikeSchema } from './creatures';
import { ObservationColumnsV2Schema, parseObservationColumnsV2, type ObservationColumnV2 } from './scriptObservationColumnsV2';

/** Fixed numeric inputs of the existing native kernels, explicitly declared
 * on the same H4 owner. These are selectors, never climate values or defaults. */
export const ELITE_BODY_COLUMNS = [
  { name: 'playerCrouched', id: 1, source: { kind: 'player', field: 'crouched' } },
  { name: 'playerFwdX', id: 2, source: { kind: 'player', field: 'forwardX' } },
  { name: 'playerFwdZ', id: 3, source: { kind: 'player', field: 'forwardZ' } },
  { name: 'grassHeight', id: 4, source: { kind: 'grass', at: 'self' } },
  { name: 'windX', id: 5, source: { kind: 'wind', field: 'x' } },
  { name: 'windZ', id: 6, source: { kind: 'wind', field: 'z' } },
] as const satisfies readonly ObservationColumnV2[];
export const ELITE_CONDITION_COLUMNS = [
  { name: 'phase', id: 1, source: { kind: 'clock', field: 'dayPhase' } },
  { name: 'storm', id: 2, source: { kind: 'weather', field: 'stormActive' } },
] as const satisfies readonly ObservationColumnV2[];

const handle = HandleIdSchema;
const finite = v.pipe(v.number(), v.finite());
const action = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(65535));
const contacts = v.pipe(v.array(v.strictObject({ amount: v.pipe(finite, v.minValue(0)), action })), v.maxLength(8));
const native = {
  profile: handle, body: handle, model: handle, observations: handle,
  spawn: v.strictObject({ kind: handle, variant: handle, yaw: finite,
    offset: v.strictTuple([finite, finite]),
    memory: v.record(handle, finite) }),
};
const controller = v.variant('kind', [
  v.strictObject({ kind: v.literal('pouncer'), ...native,
    contacts, knock: action, opened: action, growl: action }),
  v.strictObject({ kind: v.literal('howler'), ...native,
    contacts, regrouped: action, interrupted: action, closed: action, howl: action }),
  v.strictObject({ kind: v.literal('wind'), ...native,
    contacts, knock: action, grounded: action, cry: action }),
  // A compiled resolver lends the SAME admitted authority. Engine code never
  // imports, constructs or copies a game script/projection owner.
  v.strictObject({ kind: v.literal('borrowed'), controller: handle }),
]);

/** Source rows name fixed owners, never object paths, factories or callbacks.
 * Profile/definition data and concrete loans are admitted by the compiled
 * resolver, then cardinality/identity checked in engine before construction. */
export const EliteEntryRowsSchema = v.strictObject({
  version: v.literal(1),
  id: handle,
  ui: handle,
  conditionObservations: handle,
  conditions: v.pipe(v.array(v.strictObject({
    id: handle, program: handle, signal: handle,
    observations: v.pipe(v.array(v.strictObject({ field: handle, value: finite })), v.maxLength(16)),
  })), v.maxLength(64)),
  entries: v.pipe(v.array(v.strictObject({
    id: handle, condition: handle, controller,
  })), v.minLength(1), v.maxLength(64)),
});
export type EliteEntryRows = v.InferOutput<typeof EliteEntryRowsSchema>;

export function parseEliteEntryRows(input: unknown): EliteEntryRows {
  if (!isJsonData(input)) throw new Error('Elite entry rows require plain JSON');
  const rows = v.parse(EliteEntryRowsSchema, input);
  if (new Set(rows.entries.map(row => row.id)).size !== rows.entries.length
    || new Set(rows.conditions.map(row => row.id)).size !== rows.conditions.length
    || rows.conditions.some(row => new Set(row.observations.map(field => field.field)).size !== row.observations.length)
    || rows.entries.some(row => !rows.conditions.some(condition => condition.id === row.condition))
    || rows.entries.some(row => row.controller.kind !== 'borrowed' && (new Set(row.controller.contacts.map(hit => hit.amount)).size !== row.controller.contacts.length
      || Object.keys(row.controller.spawn.memory).length > 16))) {
    throw new Error('Invalid elite entry row identities');
  }
  return rows;
}


/** The existing page owner resolves these immutable selections into concrete
 * loans. Native profile admission remains in the engine kernel boundary. */
export const EliteEntryPageRowsSchema = v.strictObject({
  entry: EliteEntryRowsSchema,
  actions: EliteOutputActionsSchema,
  profiles: v.pipe(v.array(v.strictObject({ id: handle, value: v.unknown() })), v.maxLength(64)),
  borrowed: v.pipe(v.array(ExternalEliteSchema), v.maxLength(64)),
  observations: v.pipe(v.array(v.strictObject({ id: handle, rows: ObservationColumnsV2Schema })), v.maxLength(65)),
  presentation: EliteEnteredPresentationSchema,
  strikes: v.pipe(v.array(v.strictObject({ amount: v.pipe(finite, v.minValue(0)), strike: CreatureStrikeSchema })), v.maxLength(64)),
  fallbackStrike: CreatureStrikeSchema,
  debug: v.exactOptional(handle),
  prewarm: v.pipe(v.array(v.strictObject({ kind: handle, variant: handle })), v.maxLength(64)),
  /** each entry's drop model: the world's fixed draw it shows in one painterly material (`rim`); absent, no drop models */
  drop: v.exactOptional(v.strictObject({ rim: v.pipe(finite, v.minValue(0), v.maxValue(1)),
    draws: v.pipe(v.array(v.strictObject({ id: handle, draw: v.pipe(v.string(), v.minLength(1), v.maxLength(256)) })), v.maxLength(64)) })),
});
export type EliteEntryPageRows = v.InferOutput<typeof EliteEntryPageRowsSchema>;
export function parseEliteEntryPageRows(input: unknown): EliteEntryPageRows {
  if (!isJsonData(input)) throw new Error('Elite page rows require plain JSON');
  const rows = v.parse(EliteEntryPageRowsSchema, input);
  parseEliteEntryRows(rows.entry); parseEliteOutputActions(rows.actions, rows.entry.entries.length);
  for (const row of rows.observations) parseObservationColumnsV2(row.rows);
  const borrowed = rows.entry.entries.flatMap(row => row.controller.kind === 'borrowed' ? [row.controller.controller] : []);
  if (new Set(rows.borrowed.map(row => row.def.id)).size !== rows.borrowed.length || borrowed.length !== rows.borrowed.length
    || borrowed.some((id, index) => rows.borrowed[index]?.def.id !== id)
    || new Set(rows.profiles.map(row => row.id)).size !== rows.profiles.length
    || new Set(rows.observations.map(row => row.id)).size !== rows.observations.length
    || new Set(rows.strikes.map(row => row.amount)).size !== rows.strikes.length) throw new Error('Duplicate elite page selection');
  const drops = rows.drop?.draws;
  if (drops !== undefined && (drops.length !== rows.entry.entries.length || drops.some((row, index) => rows.entry.entries[index]?.id !== row.id))) {
    throw new Error('Elite drop rows must name every entry once, in entry order');
  }
  return rows;
}
