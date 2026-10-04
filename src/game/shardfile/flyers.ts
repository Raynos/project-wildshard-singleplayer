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

/** Circle, overhead stalk and chest dive declarations with a stable authored orbit and named sphere strike. */
export const OrbitDiverSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('orbit-diver'), thinkDivisor: cadence, strike: key, home,
  circleSpeed: speed, hangAltitude: radius, stalkSpeed: speed, diveSpeed: speed, restSeconds: radius,
  noticeRadius: radius, giveUpRadius: radius, initialRestSeconds: radius, stalkMaxSeconds: positive,
  riseMargin: radius, targetHeight: radius, alignRadius: positive, alignTolerance: positive,
}), v.check(row => row.noticeRadius <= row.giveUpRadius, 'Ordered orbit perception'));
/** Admitted orbit/dive policy; native flight, token and contact execution remain trusted host ports. */
export type ShardOrbitDiver = v.InferOutput<typeof OrbitDiverSchema>;
/** Validate overhead dive data without instantiating a creature or executing its native flight recipe. */
export function parseOrbitDiver(data: unknown): ShardOrbitDiver { return v.parse(OrbitDiverSchema, data); }

/** Near-player circling, distant home patrol, low swoop and timed climb with a declared held-memory field. */
export const PatrolDiverSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('patrol-diver'), thinkDivisor: cadence, strike: key,
  home: v.strictObject({ x: coordinate, z: coordinate }),
  glideAltitude: radius, glideSpeed: speed, circleRadius: positive, patrolRadius: positive, patrolAltitude: radius,
  noticeRadius: radius, diveFrom: radius, diveSpeed: speed, climbAltitude: radius, climbSeconds: positive,
  diveMaxSeconds: positive, restSeconds: radius, targetHeight: radius, diveSlope: radius,
  climbSpeedBonus: speed, orbitLead: radius, heldField: field,
}), v.check(row => row.diveFrom <= row.noticeRadius && row.glideSpeed + row.climbSpeedBonus <= 30, 'Ordered patrol perception and bounded climb speed'));
/** Admitted patrol/swoop policy with stable home, strike and held-field bindings. */
export type ShardPatrolDiver = v.InferOutput<typeof PatrolDiverSchema>;
/** Refuse invalid patrol timing, memory fields and speed before any callbacks register. */
export function parsePatrolDiver(data: unknown): ShardPatrolDiver { return v.parse(PatrolDiverSchema, data); }

/** Small-circle drift and telegraphed chest dart; contact shove is declared data and applied only by a trusted port. */
export const BurstFlyerSchema = v.strictObject({
  id: key, kind: v.literal('burst-flyer'), thinkDivisor: cadence, strike: key, home,
  circleSpeed: speed, dartSpeed: speed, noticeRadius: radius, shoveSpeed: speed, liftSpeed: speed, targetHeight: radius,
});
/** Admitted drift/dart policy whose authorized contact impulse remains native to the player host. */
export type ShardBurstFlyer = v.InferOutput<typeof BurstFlyerSchema>;
/** Validate burst-flight tuning and its stable orbit without publishing contacts or impulses. */
export function parseBurstFlyer(data: unknown): ShardBurstFlyer { return v.parse(BurstFlyerSchema, data); }
