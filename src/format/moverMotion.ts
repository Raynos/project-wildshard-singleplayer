import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const bounded = (low: number, high: number) => v.pipe(finite, v.minValue(low), v.maxValue(high));
const time = bounded(0, 3600);
const point = v.tuple([bounded(-250, 250), bounded(-250, 250), bounded(-250, 250)]);
const rotation = v.pipe(v.tuple([finite, finite, finite, finite]), v.check(q => Math.abs(Math.hypot(...q) - 1) < 1e-5));
/** Fixed driver identities preserve their guest ABI and continuation across row migrations. */
export const MOVER_DRIVER_MODULES = Object.freeze({
  ride: 'f8f90ba2e03401910448a2af1e8b02420bc7b2e1003076bc6241d9cb0c688a22',
  hinge: '1371d8959aebb567404fc8db59592b0d63f7afeb7060f0b74ea4f12389e6bafd',
  waves: '9a5171bc3dd84488aae9de29ebd07fdb12dfbd2500c45cf91cf37e5bbbc712f0',
});
/** Actual AnimationClip stop keys for the fixed winch policy. */
export const MoverTrackSchema = v.strictObject({
  clip: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  duration: bounded(0.005, 3600), loop: v.literal('once'), speed: bounded(0.005, 100),
  times: v.tuple([time, time]),
  position: v.exactOptional(v.tuple([point, point])),
  quaternion: v.exactOptional(v.tuple([rotation, rotation])),
});
/** Continuous or explicit interaction activation; unsupported trigger authorities are refused. */
export const MoverTriggerSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('always') }),
  v.strictObject({ kind: v.literal('interact'), permission: v.picklist([0, 3]) }),
]);
const wave = v.tuple([bounded(-1, 1), bounded(-1, 1), bounded(0, 10), bounded(0.005, 1000), bounded(-100, 100), bounded(0, 10)]);
/** Numeric fixed policies compiled to the session's existing fenced guest driver. */
export const MoverDriverSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('waves'), damping: bounded(0, 1), waves: v.tuple([wave, wave, wave, wave]) }),
  v.strictObject({ kind: v.literal('winch'), mode: v.literal('ride'), dwell: bounded(0.005, 3600), gate: v.boolean() }),
  v.strictObject({ kind: v.literal('winch'), mode: v.literal('hinge'), speed: bounded(0.005, 100) }),
  v.strictObject({ kind: v.literal('static') }),
]);
/** Stop track, activation and fixed driver before ABI lowering. */
export const MoverMotionSchema = v.strictObject({
  track: v.exactOptional(MoverTrackSchema), trigger: MoverTriggerSchema, driver: MoverDriverSchema,
});
/** Validated authored motion; no function or scene object crosses admission. */
export type MoverMotion = v.InferOutput<typeof MoverMotionSchema>;
/** Validated stop keys from an ordinary three.js AnimationClip. */
export type MoverTrack = v.InferOutput<typeof MoverTrackSchema>;
/** Derive the executable guest and parameters; unsupported clip/driver/trigger combinations fail closed. */
export function lowerMoverMotion(input: unknown, rest: { at: { x: number; y: number; z: number }; euler: { x: number; y: number; z: number } }): { module: string; input: number[] } {
  const motion = v.parse(MoverMotionSchema, input), { driver, trigger, track } = motion;
  if (driver.kind === 'waves') {
    if (trigger.kind !== 'always' || track !== undefined) throw new Error('Waves require an always trigger without a clip');
    return { module: MOVER_DRIVER_MODULES.waves, input: [rest.at.x, rest.at.y, rest.at.z, rest.euler.y, driver.damping, ...driver.waves.flat()] };
  }
  if (driver.kind === 'static') {
    if (trigger.kind !== 'always' || track !== undefined) throw new Error('Static mover cannot consume a clip or interaction');
    return { module: MOVER_DRIVER_MODULES.hinge, input: [0] };
  }
  if (trigger.kind !== 'interact' || track?.times[0] !== 0 || track.times[1] !== track.duration) throw new Error('Winch requires a complete two-stop interaction clip');
  if (driver.mode === 'hinge') {
    if (trigger.permission !== 3 || track.position !== undefined || track.quaternion === undefined || track.speed !== 1) throw new Error('Hinge winch requires the permission-gated rotation clip');
    const [from, to] = track.quaternion, half = rest.euler.x / 2;
    if (rest.euler.z !== 0 || Math.abs(from[0] - Math.sin(half)) > 1e-10 || Math.abs(from[1]) > 1e-10 || Math.abs(from[2]) > 1e-10 || Math.abs(from[3] - Math.cos(half)) > 1e-10 || to.some((value, i) => value !== (i === 3 ? 1 : 0)) || track.duration !== -rest.euler.x / driver.speed) throw new Error('Hinge clip must lift the rest pitch to level at the declared speed');
    return { module: MOVER_DRIVER_MODULES.hinge, input: [1, driver.speed] };
  }
  if (trigger.permission !== 0 || track.position === undefined || track.quaternion !== undefined) throw new Error('Ride winch requires an ungated position clip');
  const [from, to] = track.position;
  if (!driver.gate && (from[0] !== rest.at.x || from[1] !== rest.at.y || from[2] !== rest.at.z)) throw new Error('Ride clip must begin at the declared stop');
  if (driver.gate && from.some((value, i) => value !== to[i])) throw new Error('A road gate must stay stationary');
  return { module: MOVER_DRIVER_MODULES.ride, input: [...from, ...to, track.duration / track.speed, Number(driver.gate), driver.dwell] };
}
