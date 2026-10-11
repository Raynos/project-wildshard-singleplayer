import * as v from 'valibot';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const cue = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_.:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const radius = v.pipe(finite, v.minValue(0), v.maxValue(600));
const speed = v.pipe(finite, v.minValue(0), v.maxValue(15));
const duration = v.pipe(radius, v.minValue(Number.MIN_VALUE));
const coord = v.pipe(finite, v.minValue(-250), v.maxValue(250));
const hearing = v.tuple([radius, radius, radius, radius]);
const members = v.pipe(v.array(id), v.minLength(1), v.maxLength(128), v.check(rows => new Set(rows).size === rows.length, 'Unique ordered group members'));
const orderedHearing = (values: readonly number[]): boolean => values.every((value, i) => i === 0 || value >= (values[i - 1] ?? 0));

/** One circling pack controller and its ordered stable actor roster; setup and shared state belong to the group. */
export const PackGroupSchema = v.pipe(v.strictObject({
  id, kind: v.literal('pack'), thinkDivisor: v.literal(6), members, home: v.tuple([coord, coord]),
  trotSpeed: speed, runSpeed: speed, shadowMinRadius: radius, shadowMaxRadius: radius,
  ringMinRadius: radius, ringMaxRadius: radius, biteRadius: radius, sightRadius: radius,
  coneAngle: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI)), smellRadius: radius, hearing,
  telegraphSeconds: duration, dashSeconds: duration, breakoffSeconds: duration, attackSeconds: duration,
  leaderVariant: id, yipCue: cue, howlCue: cue, snarlCue: cue, biteCue: cue,
}), v.check(row => row.trotSpeed <= row.runSpeed && row.shadowMinRadius <= row.shadowMaxRadius
  && row.ringMinRadius <= row.ringMaxRadius && orderedHearing(row.hearing), 'Ordered pack tuning'));
/** One guarded-herd controller with an ordered roster; native riding/taming and contact recipes are injected. */
export const HerdGroupSchema = v.pipe(v.strictObject({
  id, kind: v.literal('herd'), thinkDivisor: v.literal(6), members,
  walkSpeed: speed, trotSpeed: speed, gallopSpeed: speed, chargeSpeed: speed,
  sightRadius: radius, grazingSightRadius: radius, coneAngle: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI)), hearing,
  alertThreshold: v.pipe(finite, v.minValue(Number.MIN_VALUE), v.maxValue(1)), flightMinDistance: radius, flightMaxDistance: radius,
  stallionVariant: id, foalPrefix: id, snortCue: cue, neighCue: cue, squealCue: cue,
}), v.check(row => row.walkSpeed <= row.trotSpeed && row.trotSpeed <= row.gallopSpeed
  && row.grazingSightRadius <= row.sightRadius && row.flightMinDistance <= row.flightMaxDistance
  && orderedHearing(row.hearing), 'Ordered herd tuning'));
/** Admitted circling-pack data and explicit roster, independent from native recipes. */
export type ShardPackGroup = v.InferOutput<typeof PackGroupSchema>;
/** Admitted guarded-herd data and explicit roster, independent from native recipes. */
export type ShardHerdGroup = v.InferOutput<typeof HerdGroupSchema>;
/** Group controller declaration; the full creature loader checks identity and controller conflicts. */
export const GroupBrainSchema = v.variant('kind', [PackGroupSchema, HerdGroupSchema]);
/** A pack or herd group controller; an actor may belong to exactly one controller. */
export type ShardGroupBrain = v.InferOutput<typeof GroupBrainSchema>;
/** Validate finite tuning, six-tick cadence and the complete ordered roster before touching an actor or RNG. */
export function parseGroupBrain(data: unknown): ShardGroupBrain { return v.parse(GroupBrainSchema, data); }
/** Controller references must match the exact ordered roster, with no overlap with individual or encounter controllers. */
export function groupBrainRules(groups: readonly { id: string; members: readonly string[] }[], spawns: readonly { id: string; brain: string | null }[],
  individualIds: readonly string[] = [], encounterIds: readonly string[] = []): string[] {
  const errors: string[] = [], ids = new Set(individualIds), claimed = new Set<string>(), spawnIds = new Set(spawns.map(row => row.id)), encounters = new Set(encounterIds);
  for (const group of groups) {
    if (ids.has(group.id)) errors.push('unique controller ids'); ids.add(group.id);
    if (group.members.some(member => claimed.has(member) || !spawnIds.has(member) || encounters.has(member))) errors.push('exclusive declared group members');
    for (const member of group.members) claimed.add(member);
    if (JSON.stringify(group.members) !== JSON.stringify(spawns.filter(row => row.brain === group.id).map(row => row.id))) errors.push('exact ordered group roster');
  }
  return errors;
}
