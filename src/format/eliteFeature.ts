import * as v from 'valibot';
import { isJsonData } from './json';
import { parseSpawnScript, type SpawnScriptRows } from './spawnScripts';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0));
const radius = v.pipe(nonnegative, v.maxValue(1000));
const text = v.pipe(v.string(), v.maxLength(4096));
const definition = v.strictObject({ id, name: text, epithet: text,
  lair: v.strictObject({ x: finite, z: finite, r: radius }),
  awareR: radius, engageR: radius, leashR: radius,
  rule: v.picklist(['always', 'dusk', 'night', 'storm']), respawnMin: nonnegative,
  once: v.exactOptional(v.boolean()), signature: text, phase2: text,
  drop: v.strictObject({ skin: v.nullable(id), skinName: text, weapon: id, blurb: text, trophyName: v.exactOptional(text) }),
});
/** Entered elite pickup and score presentation; rewards and bodies retain their callers. */
export const EliteEnteredPresentationSchema = v.record(id, v.strictObject({
  prompt: text, toast: text, hum: v.boolean(),
  sting: v.strictObject({ banner: v.pipe(finite, v.minValue(0), v.maxValue(1)), phase2: v.pipe(finite, v.minValue(0), v.maxValue(1)),
    kill: v.picklist(['pickup', 'death', 'chunk', 'dawn']) }),
}));
export type EliteEnteredPresentation = v.InferOutput<typeof EliteEnteredPresentationSchema>;
const observation = v.strictObject({ field: id, source: v.picklist([
  'engaged', 'leashing', 'phase2', 'clock', 'god', 'dusk', 'night',
]) });
export const EliteFeatureSchema = v.strictObject({
  step: id, version: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  bounds: v.tuple([finite, finite, finite, finite]),
  streams: v.strictObject({ spawn: id, fight: id, pickup: id }),
  ordinary: v.record(id, v.pipe(v.array(id), v.minLength(1), v.maxLength(64))),
  legacy: v.exactOptional(v.strictObject({ versions: v.array(v.pipe(v.number(), v.safeInteger(), v.minValue(1))), scripts: id, stun: id, upgrades: v.array(v.strictObject({ version: v.pipe(v.number(), v.integer()), bindInstalled: v.boolean(), clearStun: v.boolean(), remove: v.array(id), defaults: v.record(id, v.record(id, v.union([finite, v.boolean(), v.null()]))) })) })),
  view: v.exactOptional(v.strictObject({
    puffPool: v.strictObject({ capacity: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(16)), segments: v.tuple([v.pipe(v.number(), v.integer(), v.minValue(3), v.maxValue(64)), v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(64))]), order: finite }),
    tellColor: v.tuple([finite, finite, finite]), puffColor: v.tuple([finite, finite, finite]),
    cues: v.array(v.strictObject({ id, voice: v.exactOptional(id), trauma: v.exactOptional(v.pipe(finite, v.minValue(0), v.maxValue(1))), signature: v.exactOptional(v.boolean()),
      effect: v.exactOptional(v.variant('kind', [
        v.strictObject({ kind: v.literal('puff'), at: v.picklist(['body', 'head']), height: finite, speed: nonnegative,
          size: nonnegative, lifetime: nonnegative, opacity: v.pipe(finite, v.minValue(0), v.maxValue(1)) }),
        v.strictObject({ kind: v.literal('dirt'), height: finite, count: v.pipe(v.number(), v.safeInteger(), v.minValue(1), v.maxValue(256)) }),
      ])),
    })),
  })),
  fights: v.pipe(v.array(v.strictObject({
    def: definition, kind: id, variant: id, main: id, spawn: id, program: v.unknown(),
    observations: v.pipe(v.array(observation), v.maxLength(16)),
    forces: v.record(id, finite), defaultForce: finite,
    modes: v.pipe(v.array(id), v.minLength(1), v.maxLength(32)),
    mode: id,
    legacy: v.strictObject({
      fields: v.pipe(v.array(v.strictObject({ field: id, slot: id, kind: v.picklist(['number', 'boolean']),
        never: v.exactOptional(finite) })), v.maxLength(16)),
      rivals: v.pipe(v.array(v.strictObject({ slot: id, field: id, charge: id })), v.maxLength(4)),
      actorPrefix: id, phase: id, hidden: v.exactOptional(id), lanes: v.array(v.strictObject({ slot: id, strike: id })), rivalMode: finite,
    }),
  })), v.minLength(1), v.maxLength(8)),
});
type RawRows = v.InferOutput<typeof EliteFeatureSchema>;
/** Named encounter content and v1 actor programs. Every observation names a platform fact, never a shard hook. */
export type EliteFeatureRows = Omit<RawRows, 'fights'> & {
  fights: (Omit<RawRows['fights'][number], 'program'> & { program: SpawnScriptRows })[];
};
/** Admit identities, historical slot mappings and actor ownership before installing any encounter. */
export function parseEliteFeature(input: unknown): EliteFeatureRows {
  if (!isJsonData(input)) throw new Error('Elite feature must be plain JSON');
  const rows = v.parse(EliteFeatureSchema, input);
  if (rows.bounds[0] >= rows.bounds[1] || rows.bounds[2] >= rows.bounds[3]
    || new Set(rows.fights.map(row => row.def.id)).size !== rows.fights.length) throw new Error('Invalid elite feature bounds or identity');
  const fights = rows.fights.map(fight => {
    const program = parseSpawnScript(fight.program), recipe = program.spawns.find(row => row.id === fight.spawn);
    const site = program.sites.find(row => row.id === recipe?.site), species = program.species.find(row => row.id === recipe?.species);
    if (site?.slot !== fight.main || species?.kind !== fight.kind || species.variant !== fight.variant
      || new Set(fight.modes).size !== fight.modes.length) throw new Error('Invalid elite main identity');
    if (!program.slots.some(slot => slot.id === fight.main) || !program.spawns.some(spawn => spawn.id === fight.spawn)
      || !program.script.state.some(slot => slot.name === fight.mode)
      || fight.observations.some(row => !program.fields.some(field => field.id === row.field && field.source === 'observed'))
      || fight.legacy.fields.some(row => !program.script.state.some(slot => slot.name === row.slot))
      || fight.legacy.rivals.some(row => !program.slots.some(slot => slot.id === row.slot))) throw new Error('Missing elite program reference');
    return { ...fight, program };
  });
  return { ...rows, fights };
}

const externalCommon = { def: definition, tell: v.tuple([finite, finite, finite]), step: id, ready: text, damage: text, broken: text,
  cues: v.record(id, v.strictObject({ signature: v.exactOptional(v.boolean()), voice: v.exactOptional(id), feed: v.exactOptional(text) })),
  adopted: v.strictObject({ scale: v.pipe(finite, v.minValue(.01), v.maxValue(10)), kind: text, variant: text, feed: text }), states: v.record(id, finite) };
/** External body allocation and AS-projected encounter rows. All content is data;
 * native actor and herd adoption occurs through the existing owner. */
export const ExternalEliteSchema = v.variant('mode', [
  v.strictObject({ ...externalCommon, mode: v.literal('script'), spawn: v.strictObject({ source: v.literal('rider'), variant: v.picklist(['rider', 'captain']), yaw: finite }) }),
  v.strictObject({ ...externalCommon, mode: v.literal('herd'), spawn: v.strictObject({ source: v.literal('herd'), kind: id, variant: id, yaw: finite,
    offset: v.tuple([finite, finite]), mares: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(256)), foals: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(256)), stallion: v.boolean(), color: v.tuple([finite, finite, finite]) }) }),
]);
export type ExternalEliteData = v.InferOutput<typeof ExternalEliteSchema>;
export function parseExternalElite(input: unknown): ExternalEliteData { return v.parse(ExternalEliteSchema, input); }

const outputId = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(65535));
const outputSlot = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(63));
const outputOwner = { id: outputId, controller: outputSlot };
/** Finite native effects selected by the admitted elite guest. IDs and slots
 * label actions and original controller results, never reflected owner paths. */
export const EliteOutputActionsSchema = v.pipe(v.array(v.variant('kind', [
  v.strictObject({ ...outputOwner, kind: v.literal('contact'), amount: nonnegative }),
  v.strictObject({ ...outputOwner, kind: v.literal('knockdown'), duration: nonnegative }),
  v.strictObject({ ...outputOwner, kind: v.literal('feed'), text }),
  v.strictObject({ ...outputOwner, kind: v.literal('sound'), cue: id }),
  v.strictObject({ ...outputOwner, kind: v.literal('record'), actorKind: id, variant: id }),
  v.strictObject({ ...outputOwner, kind: v.literal('patrol-rider'), variant: v.picklist(['rider', 'captain']) }),
  v.strictObject({ ...outputOwner, kind: v.literal('patrol-line') }),
  v.strictObject({ ...outputOwner, kind: v.literal('patrol-dissolve') }),
  v.strictObject({ ...outputOwner, kind: v.literal('wildlife-pack'), variants: v.pipe(v.array(id), v.minLength(1), v.maxLength(64)) }),
  v.strictObject({ ...outputOwner, kind: v.literal('wildlife-herd'), actorKind: id, variant: id,
    offset: v.strictTuple([finite, finite]), mares: v.pipe(nonnegative, v.integer(), v.maxValue(256)),
    foals: v.pipe(nonnegative, v.integer(), v.maxValue(256)), stallion: v.boolean() }),
])), v.maxLength(128));
export type EliteOutputAction = v.InferOutput<typeof EliteOutputActionsSchema>[number];
/** Admission is separate from effect delivery, so an invalid suffix cannot
 * allocate bodies, draw randomness or publish a partial result. */
export function parseEliteOutputActions(input: unknown, controllers: number): readonly EliteOutputAction[] {
  if (!isJsonData(input)) throw new Error('Elite output actions require JSON data');
  const rows = v.parse(EliteOutputActionsSchema, input);
  if (!Number.isInteger(controllers) || controllers < 0 || controllers > 64
    || new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => row.controller >= controllers)) throw new Error('Invalid elite output identities');
  return rows;
}
const noOperands = v.strictTuple([]), actorOperand = v.strictTuple([v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(7))]);
const pointOperands = v.strictTuple([finite, finite, finite]);
const rawOutput = v.strictObject({ action: outputId, values: v.pipe(v.array(finite), v.maxLength(4)) });
const outputBank = v.pipe(v.array(rawOutput), v.maxLength(256));
/** Resolve exact operand widths while retaining f64 signs and operation order.
 * Actor indices address the transient ORIGINAL emitted actor bank; they never
 * re-read a controller's current actor after an earlier request adopts a body. */
interface OutputOperands {
  contact: readonly [number]; 'patrol-dissolve': readonly [number]; knockdown: readonly [number, number];
  sound: readonly [number, number, number]; 'patrol-rider': readonly [number, number, number]; 'wildlife-herd': readonly [number, number, number];
  'wildlife-pack': readonly [number, number, number, number]; 'patrol-line': readonly [number]; feed: readonly []; record: readonly [];
};
export type EliteOutput = { [K in EliteOutputAction['kind']]: Extract<EliteOutputAction, { kind: K }> & { readonly values: OutputOperands[K] } }[EliteOutputAction['kind']];
export function parseEliteOutputBank(actions: readonly EliteOutputAction[], input: unknown, actors: number): readonly EliteOutput[] {
  // Runtime banks may contain -0. Check descriptors before schema reads instead
  // of applying the canonical-JSON rule, which intentionally rejects that value.
  const data = (value: unknown, depth = 0): boolean => {
    if (depth > 3) return false;
    if (typeof value === 'number') return Number.isFinite(value);
    if (value === null || typeof value !== 'object' || Object.getOwnPropertySymbols(value).length > 0) return false;
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
    const keys = Object.getOwnPropertyNames(value);
    if (keys.length > 1025 || Array.isArray(value) && (value.length > 256 || keys.length !== value.length + 1)) return false;
    return keys.every(key => {
      const own = Object.getOwnPropertyDescriptor(value, key);
      return key === 'length' && Array.isArray(value) || own?.enumerable === true && own.get === undefined && own.set === undefined
        && (key === 'action' || Array.isArray(value) || key === 'values') && data(own.value, depth + 1);
    });
  };
  if (!Number.isInteger(actors) || actors < 0 || actors > 8 || !data(input)) throw new Error('Invalid elite output data');
  const bank = v.parse(outputBank, input), byId = new Map(parseEliteOutputActions(actions, 64).map(row => [row.id, row]));
  if (byId.size !== actions.length || actions.length > 128) throw new Error('Invalid elite output action bank');
  const decode = (output: v.InferOutput<typeof rawOutput>): EliteOutput => {
    const row = byId.get(output.action);
    if (row === undefined) throw new Error('Undeclared elite output');
    switch (row.kind) {
      case 'contact': case 'patrol-dissolve': {
        const values = v.parse(actorOperand, output.values);
        if (values[0] >= actors) throw new Error('Missing emitted elite actor');
        return { ...row, values };
      }
      case 'knockdown': return { ...row, values: v.parse(v.strictTuple([finite, finite]), output.values) };
      case 'sound': case 'patrol-rider': case 'wildlife-herd': return { ...row, values: v.parse(pointOperands, output.values) };
      case 'wildlife-pack': return { ...row, values: v.parse(v.strictTuple([finite, finite, finite, finite]), output.values) };
      case 'patrol-line': return { ...row, values: v.parse(v.strictTuple([v.pipe(nonnegative, v.integer(), v.maxValue(8))]), output.values) };
      case 'feed': case 'record': return { ...row, values: v.parse(noOperands, output.values) };
      default: throw new Error('Unknown elite output');
    }
  };
  return bank.map(decode);
}

/** Explicit elite service operation in the existing ABI-v2 64-byte command row.
 * The combined owner validates/prepares EVERY branch before committing any;
 * this decoder neither publishes an effect nor admits other command kinds. */
export const ELITE_OUTPUT_OPERATION = 25;
export function readEliteOutputV2(view: DataView, at: number, binding: number,
  actions: readonly EliteOutputAction[], actors: number): EliteOutput {
  if (!Number.isSafeInteger(at) || at < 0 || at % 8 !== 0 || at > view.byteLength - 64
    || !Number.isInteger(binding) || binding < 1 || binding > 0x7fffffff
    || view.getUint32(at, true) !== binding || view.getUint32(at + 4, true) !== ELITE_OUTPUT_OPERATION
    || view.getUint32(at + 12, true) !== 0) throw new Error('Invalid elite output command');
  const actionId = view.getUint32(at + 8, true), row = actions.find(action => action.id === actionId);
  if (row === undefined) throw new Error('Undeclared elite output action');
  const widths = { contact: 1, knockdown: 2, feed: 0, sound: 3, record: 0,
    'patrol-rider': 3, 'patrol-line': 1, 'patrol-dissolve': 1, 'wildlife-pack': 4, 'wildlife-herd': 3 };
  const width = widths[row.kind], values = Array.from({ length: 6 }, (_, index) => view.getFloat64(at + 16 + index * 8, true));
  if (values.slice(width).some(value => !Object.is(value, 0))) throw new Error('Invalid elite output reserved operands');
  const output = parseEliteOutputBank(actions, [{ action: actionId, values: values.slice(0, width) }], actors)[0];
  if (output === undefined) throw new Error('Missing elite output');
  return output;
}
