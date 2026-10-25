import * as v from 'valibot';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const field = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const radius = v.pipe(finite, v.minValue(0), v.maxValue(600));
const positive = v.pipe(radius, v.minValue(Number.MIN_VALUE));
const speed = v.pipe(radius, v.maxValue(30));
const coordinate = v.pipe(finite, v.minValue(-10000), v.maxValue(10000));
const home = v.strictObject({ x: coordinate, z: coordinate, r: positive, y: coordinate });
const cadence = v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(60), v.check(n => 60 % n === 0, 'Brain divisor divides 60')), 6);

function orderedOrbit(row: { noticeRadius: number; giveUpRadius: number }): boolean { return row.noticeRadius <= row.giveUpRadius; }
function boundedPatrol(row: { diveFrom: number; noticeRadius: number; glideSpeed: number; climbSpeedBonus: number }): boolean {
  return row.diveFrom <= row.noticeRadius && row.glideSpeed + row.climbSpeedBonus <= 30;
}

/** Circle, overhead stalk and chest dive declarations with a stable authored orbit and named sphere strike. */
export const OrbitDiverSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<OrbitDiverRowsInput['id'], OrbitDiverRows['id']>; readonly kind: v.GenericSchema<OrbitDiverRowsInput['kind'], OrbitDiverRows['kind']>; readonly thinkDivisor: v.OptionalSchema<v.GenericSchema<Exclude<OrbitDiverRowsInput['thinkDivisor'], undefined>, Exclude<OrbitDiverRows['thinkDivisor'], undefined>>, 6>; readonly strike: v.GenericSchema<OrbitDiverRowsInput['strike'], OrbitDiverRows['strike']>; readonly home: v.GenericSchema<OrbitDiverRowsInput['home'], OrbitDiverRows['home']>; readonly circleSpeed: v.GenericSchema<OrbitDiverRowsInput['circleSpeed'], OrbitDiverRows['circleSpeed']>; readonly hangAltitude: v.GenericSchema<OrbitDiverRowsInput['hangAltitude'], OrbitDiverRows['hangAltitude']>; readonly stalkSpeed: v.GenericSchema<OrbitDiverRowsInput['stalkSpeed'], OrbitDiverRows['stalkSpeed']>; readonly diveSpeed: v.GenericSchema<OrbitDiverRowsInput['diveSpeed'], OrbitDiverRows['diveSpeed']>; readonly restSeconds: v.GenericSchema<OrbitDiverRowsInput['restSeconds'], OrbitDiverRows['restSeconds']>; readonly noticeRadius: v.GenericSchema<OrbitDiverRowsInput['noticeRadius'], OrbitDiverRows['noticeRadius']>; readonly giveUpRadius: v.GenericSchema<OrbitDiverRowsInput['giveUpRadius'], OrbitDiverRows['giveUpRadius']>; readonly initialRestSeconds: v.GenericSchema<OrbitDiverRowsInput['initialRestSeconds'], OrbitDiverRows['initialRestSeconds']>; readonly stalkMaxSeconds: v.GenericSchema<OrbitDiverRowsInput['stalkMaxSeconds'], OrbitDiverRows['stalkMaxSeconds']>; readonly riseMargin: v.GenericSchema<OrbitDiverRowsInput['riseMargin'], OrbitDiverRows['riseMargin']>; readonly targetHeight: v.GenericSchema<OrbitDiverRowsInput['targetHeight'], OrbitDiverRows['targetHeight']>; readonly alignRadius: v.GenericSchema<OrbitDiverRowsInput['alignRadius'], OrbitDiverRows['alignRadius']>; readonly alignTolerance: v.GenericSchema<OrbitDiverRowsInput['alignTolerance'], OrbitDiverRows['alignTolerance']>; }, undefined>, v.CheckAction<{ [K in keyof OrbitDiverRows]: OrbitDiverRows[K] }, 'Ordered orbit perception'>]> = v.pipe(v.strictObject({
  id: key, kind: v.literal('orbit-diver'), thinkDivisor: cadence, strike: key, home,
  circleSpeed: speed, hangAltitude: radius, stalkSpeed: speed, diveSpeed: speed, restSeconds: radius,
  noticeRadius: radius, giveUpRadius: radius, initialRestSeconds: radius, stalkMaxSeconds: positive,
  riseMargin: radius, targetHeight: radius, alignRadius: positive, alignTolerance: positive,
}), v.check(row => orderedOrbit(row), 'Ordered orbit perception'));
/** Admitted orbit/dive policy; native flight, token and contact execution remain trusted host ports. */
export type ShardOrbitDiver = v.InferOutput<typeof OrbitDiverSchema>;
/** Validate overhead dive data without instantiating a creature or executing its native flight recipe. */
export function parseOrbitDiver(data: unknown): ShardOrbitDiver { return v.parse(OrbitDiverSchema, data); }

/** Near-player circling, distant home patrol, low swoop and timed climb with a declared held-memory field. */
export const PatrolDiverSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<PatrolDiverRowsInput['id'], PatrolDiverRows['id']>; readonly kind: v.GenericSchema<PatrolDiverRowsInput['kind'], PatrolDiverRows['kind']>; readonly thinkDivisor: v.OptionalSchema<v.GenericSchema<Exclude<PatrolDiverRowsInput['thinkDivisor'], undefined>, Exclude<PatrolDiverRows['thinkDivisor'], undefined>>, 6>; readonly strike: v.GenericSchema<PatrolDiverRowsInput['strike'], PatrolDiverRows['strike']>; readonly home: v.GenericSchema<PatrolDiverRowsInput['home'], PatrolDiverRows['home']>; readonly glideAltitude: v.GenericSchema<PatrolDiverRowsInput['glideAltitude'], PatrolDiverRows['glideAltitude']>; readonly glideSpeed: v.GenericSchema<PatrolDiverRowsInput['glideSpeed'], PatrolDiverRows['glideSpeed']>; readonly circleRadius: v.GenericSchema<PatrolDiverRowsInput['circleRadius'], PatrolDiverRows['circleRadius']>; readonly patrolRadius: v.GenericSchema<PatrolDiverRowsInput['patrolRadius'], PatrolDiverRows['patrolRadius']>; readonly patrolAltitude: v.GenericSchema<PatrolDiverRowsInput['patrolAltitude'], PatrolDiverRows['patrolAltitude']>; readonly noticeRadius: v.GenericSchema<PatrolDiverRowsInput['noticeRadius'], PatrolDiverRows['noticeRadius']>; readonly diveFrom: v.GenericSchema<PatrolDiverRowsInput['diveFrom'], PatrolDiverRows['diveFrom']>; readonly diveSpeed: v.GenericSchema<PatrolDiverRowsInput['diveSpeed'], PatrolDiverRows['diveSpeed']>; readonly climbAltitude: v.GenericSchema<PatrolDiverRowsInput['climbAltitude'], PatrolDiverRows['climbAltitude']>; readonly climbSeconds: v.GenericSchema<PatrolDiverRowsInput['climbSeconds'], PatrolDiverRows['climbSeconds']>; readonly diveMaxSeconds: v.GenericSchema<PatrolDiverRowsInput['diveMaxSeconds'], PatrolDiverRows['diveMaxSeconds']>; readonly restSeconds: v.GenericSchema<PatrolDiverRowsInput['restSeconds'], PatrolDiverRows['restSeconds']>; readonly targetHeight: v.GenericSchema<PatrolDiverRowsInput['targetHeight'], PatrolDiverRows['targetHeight']>; readonly diveSlope: v.GenericSchema<PatrolDiverRowsInput['diveSlope'], PatrolDiverRows['diveSlope']>; readonly climbSpeedBonus: v.GenericSchema<PatrolDiverRowsInput['climbSpeedBonus'], PatrolDiverRows['climbSpeedBonus']>; readonly orbitLead: v.GenericSchema<PatrolDiverRowsInput['orbitLead'], PatrolDiverRows['orbitLead']>; readonly heldField: v.GenericSchema<PatrolDiverRowsInput['heldField'], PatrolDiverRows['heldField']>; }, undefined>, v.CheckAction<{ [K in keyof PatrolDiverRows]: PatrolDiverRows[K] }, 'Ordered patrol perception and bounded climb speed'>]> = v.pipe(v.strictObject({
  id: key, kind: v.literal('patrol-diver'), thinkDivisor: cadence, strike: key,
  home: v.strictObject({ x: coordinate, z: coordinate }),
  glideAltitude: radius, glideSpeed: speed, circleRadius: positive, patrolRadius: positive, patrolAltitude: radius,
  noticeRadius: radius, diveFrom: radius, diveSpeed: speed, climbAltitude: radius, climbSeconds: positive,
  diveMaxSeconds: positive, restSeconds: radius, targetHeight: radius, diveSlope: radius,
  climbSpeedBonus: speed, orbitLead: radius, heldField: field,
}), v.check(row => boundedPatrol(row), 'Ordered patrol perception and bounded climb speed'));
/** Admitted patrol/swoop policy with stable home, strike and held-field bindings. */
export type ShardPatrolDiver = v.InferOutput<typeof PatrolDiverSchema>;
/** Refuse invalid patrol timing, memory fields and speed before any callbacks register. */
export function parsePatrolDiver(data: unknown): ShardPatrolDiver { return v.parse(PatrolDiverSchema, data); }

/** Small-circle drift and telegraphed chest dart; contact shove is declared data and applied only by a trusted port. */
export const BurstFlyerSchema: v.StrictObjectSchema<{ readonly id: v.GenericSchema<BurstFlyerRowsInput['id'], BurstFlyerRows['id']>; readonly kind: v.GenericSchema<BurstFlyerRowsInput['kind'], BurstFlyerRows['kind']>; readonly thinkDivisor: v.OptionalSchema<v.GenericSchema<Exclude<BurstFlyerRowsInput['thinkDivisor'], undefined>, Exclude<BurstFlyerRows['thinkDivisor'], undefined>>, 6>; readonly strike: v.GenericSchema<BurstFlyerRowsInput['strike'], BurstFlyerRows['strike']>; readonly home: v.GenericSchema<BurstFlyerRowsInput['home'], BurstFlyerRows['home']>; readonly circleSpeed: v.GenericSchema<BurstFlyerRowsInput['circleSpeed'], BurstFlyerRows['circleSpeed']>; readonly dartSpeed: v.GenericSchema<BurstFlyerRowsInput['dartSpeed'], BurstFlyerRows['dartSpeed']>; readonly noticeRadius: v.GenericSchema<BurstFlyerRowsInput['noticeRadius'], BurstFlyerRows['noticeRadius']>; readonly shoveSpeed: v.GenericSchema<BurstFlyerRowsInput['shoveSpeed'], BurstFlyerRows['shoveSpeed']>; readonly liftSpeed: v.GenericSchema<BurstFlyerRowsInput['liftSpeed'], BurstFlyerRows['liftSpeed']>; readonly targetHeight: v.GenericSchema<BurstFlyerRowsInput['targetHeight'], BurstFlyerRows['targetHeight']>; }, undefined> = v.strictObject({
  id: key, kind: v.literal('burst-flyer'), thinkDivisor: cadence, strike: key, home,
  circleSpeed: speed, dartSpeed: speed, noticeRadius: radius, shoveSpeed: speed, liftSpeed: speed, targetHeight: radius,
});
/** Admitted drift/dart policy whose authorized contact impulse remains native to the player host. */
export type ShardBurstFlyer = v.InferOutput<typeof BurstFlyerSchema>;
/** Validate burst-flight tuning and its stable orbit without publishing contacts or impulses. */
export function parseBurstFlyer(data: unknown): ShardBurstFlyer { return v.parse(BurstFlyerSchema, data); }

/** One diver archetype; each flight pattern retains the existing bounds, home and named sphere strike. */
export const DiverSchema: v.VariantSchema<'pattern', readonly [v.StrictObjectSchema<Omit<(typeof OrbitDiverSchema)['pipe'][0]['entries'], 'kind' | 'pattern'> & { readonly kind: v.LiteralSchema<'diver', undefined>; readonly pattern: v.LiteralSchema<'orbit', undefined> }, undefined>, v.StrictObjectSchema<Omit<(typeof PatrolDiverSchema)['pipe'][0]['entries'], 'kind' | 'pattern'> & { readonly kind: v.LiteralSchema<'diver', undefined>; readonly pattern: v.LiteralSchema<'patrol', undefined> }, undefined>, v.StrictObjectSchema<Omit<(typeof BurstFlyerSchema)['entries'], 'kind' | 'pattern'> & { readonly kind: v.LiteralSchema<'diver', undefined>; readonly pattern: v.LiteralSchema<'burst', undefined> }, undefined>], undefined> = v.variant('pattern', [
  v.pipe(v.strictObject({ ...OrbitDiverSchema.pipe[0].entries, kind: v.literal('diver'), pattern: v.literal('orbit') }),
    v.check(row => orderedOrbit(row), 'Ordered orbit perception')),
  v.pipe(v.strictObject({ ...PatrolDiverSchema.pipe[0].entries, kind: v.literal('diver'), pattern: v.literal('patrol') }),
    v.check(row => boundedPatrol(row), 'Ordered patrol perception and bounded climb speed')),
  v.strictObject({ ...BurstFlyerSchema.entries, kind: v.literal('diver'), pattern: v.literal('burst') }),
]);
/** Admitted diver row; native flight and contact authority remain loader-owned. */
export type ShardDiver = v.InferOutput<typeof DiverSchema>;
/** Validate a flight pattern without constructing a body, strike runner or callback. */
export function parseDiver(data: unknown): ShardDiver { return v.parse(DiverSchema, data); }
/** Exact historical preset spelling for body ports and serialized contracts; no tuning or cadence changes. */
export function diverPreset(data: ShardDiver): ShardOrbitDiver | ShardPatrolDiver | ShardBurstFlyer {
  if (data.pattern === 'orbit') {
    const { pattern: _pattern, ...row } = data;
    return { ...row, kind: 'orbit-diver' };
  }
  if (data.pattern === 'patrol') {
    const { pattern: _pattern, ...row } = data;
    return { ...row, kind: 'patrol-diver' };
  }
  const { pattern: _pattern, ...row } = data;
  return { ...row, kind: 'burst-flyer' };
}

/** Admitted data contracts, independent of validator implementation metadata. */
interface OrbitDiverRowsInputFields {
    id: string;
    kind: 'orbit-diver';
    thinkDivisor?: number | undefined;
    strike: string;
    home: {
        x: number;
        z: number;
        r: number;
        y: number;
    };
    circleSpeed: number;
    hangAltitude: number;
    stalkSpeed: number;
    diveSpeed: number;
    restSeconds: number;
    noticeRadius: number;
    giveUpRadius: number;
    initialRestSeconds: number;
    stalkMaxSeconds: number;
    riseMargin: number;
    targetHeight: number;
    alignRadius: number;
    alignTolerance: number;
}
export type OrbitDiverRowsInput = { [Key in keyof OrbitDiverRowsInputFields]: OrbitDiverRowsInputFields[Key] };
interface OrbitDiverRowsFields {
    id: string;
    kind: 'orbit-diver';
    thinkDivisor: number;
    strike: string;
    home: {
        x: number;
        z: number;
        r: number;
        y: number;
    };
    circleSpeed: number;
    hangAltitude: number;
    stalkSpeed: number;
    diveSpeed: number;
    restSeconds: number;
    noticeRadius: number;
    giveUpRadius: number;
    initialRestSeconds: number;
    stalkMaxSeconds: number;
    riseMargin: number;
    targetHeight: number;
    alignRadius: number;
    alignTolerance: number;
}
export type OrbitDiverRows = { [Key in keyof OrbitDiverRowsFields]: OrbitDiverRowsFields[Key] };
interface PatrolDiverRowsInputFields {
    id: string;
    kind: 'patrol-diver';
    thinkDivisor?: number | undefined;
    strike: string;
    home: {
        x: number;
        z: number;
    };
    glideAltitude: number;
    glideSpeed: number;
    circleRadius: number;
    patrolRadius: number;
    patrolAltitude: number;
    noticeRadius: number;
    diveFrom: number;
    diveSpeed: number;
    climbAltitude: number;
    climbSeconds: number;
    diveMaxSeconds: number;
    restSeconds: number;
    targetHeight: number;
    diveSlope: number;
    climbSpeedBonus: number;
    orbitLead: number;
    heldField: string;
}
export type PatrolDiverRowsInput = { [Key in keyof PatrolDiverRowsInputFields]: PatrolDiverRowsInputFields[Key] };
interface PatrolDiverRowsFields {
    id: string;
    kind: 'patrol-diver';
    thinkDivisor: number;
    strike: string;
    home: {
        x: number;
        z: number;
    };
    glideAltitude: number;
    glideSpeed: number;
    circleRadius: number;
    patrolRadius: number;
    patrolAltitude: number;
    noticeRadius: number;
    diveFrom: number;
    diveSpeed: number;
    climbAltitude: number;
    climbSeconds: number;
    diveMaxSeconds: number;
    restSeconds: number;
    targetHeight: number;
    diveSlope: number;
    climbSpeedBonus: number;
    orbitLead: number;
    heldField: string;
}
export type PatrolDiverRows = { [Key in keyof PatrolDiverRowsFields]: PatrolDiverRowsFields[Key] };
interface BurstFlyerRowsInputFields {
    id: string;
    kind: 'burst-flyer';
    thinkDivisor?: number | undefined;
    strike: string;
    home: {
        x: number;
        z: number;
        r: number;
        y: number;
    };
    circleSpeed: number;
    dartSpeed: number;
    noticeRadius: number;
    shoveSpeed: number;
    liftSpeed: number;
    targetHeight: number;
}
export type BurstFlyerRowsInput = { [Key in keyof BurstFlyerRowsInputFields]: BurstFlyerRowsInputFields[Key] };
interface BurstFlyerRowsFields {
    id: string;
    kind: 'burst-flyer';
    thinkDivisor: number;
    strike: string;
    home: {
        x: number;
        z: number;
        r: number;
        y: number;
    };
    circleSpeed: number;
    dartSpeed: number;
    noticeRadius: number;
    shoveSpeed: number;
    liftSpeed: number;
    targetHeight: number;
}
export type BurstFlyerRows = { [Key in keyof BurstFlyerRowsFields]: BurstFlyerRowsFields[Key] };
export type DiverRowsInput = (Omit<v.InferInput<(typeof OrbitDiverSchema)['pipe'][0]>, keyof ({
    kind: 'diver';
    pattern: 'orbit';
})> & {
    kind: 'diver';
    pattern: 'orbit';
}) | (Omit<v.InferInput<(typeof PatrolDiverSchema)['pipe'][0]>, keyof ({
    kind: 'diver';
    pattern: 'patrol';
})> & {
    kind: 'diver';
    pattern: 'patrol';
}) | (Omit<BurstFlyerRowsInput, keyof ({
    kind: 'diver';
    pattern: 'burst';
})> & {
    kind: 'diver';
    pattern: 'burst';
});
export type DiverRows = (Omit<v.InferOutput<(typeof OrbitDiverSchema)['pipe'][0]>, keyof ({
    kind: 'diver';
    pattern: 'orbit';
})> & {
    kind: 'diver';
    pattern: 'orbit';
}) | (Omit<v.InferOutput<(typeof PatrolDiverSchema)['pipe'][0]>, keyof ({
    kind: 'diver';
    pattern: 'patrol';
})> & {
    kind: 'diver';
    pattern: 'patrol';
}) | (Omit<BurstFlyerRows, keyof ({
    kind: 'diver';
    pattern: 'burst';
})> & {
    kind: 'diver';
    pattern: 'burst';
});
