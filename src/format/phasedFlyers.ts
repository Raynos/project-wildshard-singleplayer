import * as v from 'valibot';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const field = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9._:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const radius = v.pipe(finite, v.minValue(0), v.maxValue(600));
const positive = v.pipe(radius, v.minValue(Number.MIN_VALUE));
const speed = v.pipe(radius, v.maxValue(30));
const turn = v.pipe(finite, v.minValue(0), v.maxValue(20));
const coordinate = v.pipe(finite, v.minValue(-10000), v.maxValue(10000));
const strikes = v.pipe(v.array(key), v.minLength(1), v.maxLength(8));
const perPhase = v.pipe(v.array(radius), v.minLength(1), v.maxLength(8));

/**
 * A phased boss flyer's declaration (SHARD-PLATFORM SF27, `archetype: 'phased-flyer'`): it circles `center`, dives on
 * the player's chest with its `dive` strikes and climbs away, resting `restSeconds[phase]` between dives, and from
 * `groundedPhase` lies on the ground, crawls to `standOff` and strikes with its `grounded` strikes. Its encounter writes
 * the `fields` it reads (`fight`, `rise`, `phase`); before the fight it drifts and rises `dormant.from` → `dormant.to`.
 */
export const PhasedFlyerSchema = v.pipe(v.strictObject({
  id: key, kind: v.literal('phased-flyer'), dive: strikes, grounded: strikes,
  center: v.strictObject({ x: coordinate, z: coordinate }), circleRadius: positive, orbitLead: v.pipe(finite, v.minValue(-Math.PI), v.maxValue(Math.PI)),
  altitudes: perPhase, restSeconds: perPhase, initialRestSeconds: radius,
  speed, diveSpeed: speed, climbSpeedBonus: speed, climbSeconds: positive, diveMaxSeconds: positive,
  skim: radius, diveSlope: radius, targetHeight: radius,
  groundedPhase: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(8)), crawlSpeed: speed, lieAltitude: radius, standOff: radius,
  dormant: v.strictObject({ from: radius, to: radius, speed, yawLead: v.pipe(finite, v.minValue(-Math.PI), v.maxValue(Math.PI)), turn }),
  turns: v.strictObject({ circle: turn, dive: turn, climb: turn, grounded: turn }),
  fields: v.strictObject({ fight: field, phase: field, rise: field }),
}), v.check(row => row.speed + row.climbSpeedBonus <= 30, 'Bounded climb speed'));
/** An admitted phased flyer declaration. */
export type ShardPhasedFlyer = v.InferOutput<typeof PhasedFlyerSchema>;
/** Refuse an invalid phased flyer before any policy or callback exists. */
export function parsePhasedFlyer(data: unknown): ShardPhasedFlyer { return v.parse(PhasedFlyerSchema, data); }

/** Encounter-driven diver profile; its field names, phase arrays and bounds are the historical flyer's. */
export const PhasedDiverSchema = v.pipe(v.strictObject({ ...PhasedFlyerSchema.pipe[0].entries,
  kind: v.literal('diver'), pattern: v.literal('phased') }),
  v.check(row => PhasedFlyerSchema.pipe[1].requirement({ ...row, kind: 'phased-flyer' }), 'Bounded climb speed'));
/** Canonical encounter-driven flight declaration; the encounter keeps phase and body ownership. */
export type ShardPhasedDiver = v.InferOutput<typeof PhasedDiverSchema>;
/** Admit the authored profile and resolve the exact old preset before native construction or contact allocation. */
export function phasedDiverPreset(input: unknown): ShardPhasedFlyer {
  const { pattern: _pattern, ...row } = v.parse(PhasedDiverSchema, input);
  return parsePhasedFlyer({ ...row, kind: 'phased-flyer' });
}
