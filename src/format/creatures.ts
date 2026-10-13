import * as v from 'valibot';
import { StalkerSchema, GuardianPatternsSchema, SkirmisherSchema, GuardianSchema, PerchHunterSchema, ScriptBrainSchema } from './brains';
import { GroupBrainSchema, groupBrainRules } from './groupBrains';
import { RamGrazerSchema, ChallengeGrazerSchema, GrazerSchema } from './grazers';
import { DiverSchema, OrbitDiverSchema, PatrolDiverSchema, BurstFlyerSchema } from './flyers';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const radius = v.pipe(finite, v.minValue(0), v.maxValue(500));
const speed = v.pipe(finite, v.minValue(0), v.maxValue(15));
const ticks = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(36000));
const coord = v.pipe(finite, v.minValue(-250), v.maxValue(250));
const brain = v.pipe(v.strictObject({ id, kind: v.literal('pursue'), awareRadius: radius, leashRadius: radius, speed, returnSpeed: speed, stopDistance: radius,
  turnRate: v.pipe(finite, v.minValue(0), v.maxValue(30)), thinkDivisor: v.pipe(ticks, v.check((n) => 60 % n === 0, 'brain divisor divides 60')), attackCooldownTicks: ticks, wanderRadius: radius, wanderEveryTicks: ticks }),
v.check((b) => b.stopDistance <= b.awareRadius && b.awareRadius <= b.leashRadius && b.wanderRadius <= b.leashRadius, 'ordered brain radii'));
/** One authored body's home; never inferred from a species or another actor. */
export const CreatureHomeSchema = v.strictObject({ x: coord, y: coord, z: coord, r: v.pipe(radius, v.minValue(Number.MIN_VALUE)) });
/** Bounded per-spawn home overriding a flyer's catalogue home or supplying its ram boundary. */
export type ShardCreatureHome = v.InferOutput<typeof CreatureHomeSchema>;
/** Explicit native body authority; decisions never infer flight, contact origin or an attack grant. */
export const CreatureBodyRecipeSchema = v.strictObject({
  kind: v.literal('animal'), motion: v.picklist(['ground', 'flight']),
  attack: v.picklist(['keeper', 'unlimited']), stunned: v.picklist(['none', 'look-hold']),
  contact: v.variant('kind', [
    v.strictObject({ kind: v.literal('environment'), halfArc: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI)) }),
    v.strictObject({ kind: v.literal('actor'), halfArc: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI)), move: v.pipe(v.string(), v.regex(/^[a-z][A-Za-z0-9._:-]*$/u), v.maxLength(128)) }),
  ]),
});
/** Serializable selection of the native motor and the exact existing creature-contact protocol. */
export type CreatureBodyRecipe = v.InferOutput<typeof CreatureBodyRecipeSchema>;
const phase = v.pipe(finite, v.minValue(-2 * Math.PI), v.maxValue(2 * Math.PI));
const spawn = v.strictObject({ phaseOffset: v.optional(phase), home: v.optional(CreatureHomeSchema), id, species: id, variant: id, brain: v.nullable(id), strike: v.nullable(id), seed: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffffffff)), scale: v.pipe(finite, v.minValue(0.1), v.maxValue(10)), at: v.tuple([coord, coord, coord]), yaw: finite });
/** Pure-data creature archetypes and stable spawn layouts, expanded before the local sim boots. */
export const CreaturesSchema = v.pipe(v.strictObject({ brains: v.pipe(v.array(v.variant('kind', [brain, SkirmisherSchema, GuardianSchema, PerchHunterSchema, ScriptBrainSchema, RamGrazerSchema, ChallengeGrazerSchema, OrbitDiverSchema, PatrolDiverSchema, BurstFlyerSchema, GrazerSchema, DiverSchema, GuardianPatternsSchema, StalkerSchema])), v.maxLength(64)), groups: v.optional(v.pipe(v.array(GroupBrainSchema), v.maxLength(64)), []), spawns: v.pipe(v.array(spawn), v.maxLength(10000)) }),
v.check((c) => creatureRules(c).length === 0, 'creature reference rules'));
/** Validated brain parameters and spawn layout, with no rig or runtime closure. */
export type ShardCreatures = v.InferOutput<typeof CreaturesSchema>;
/** Unique ids and brain references; species and strikes are resolved against the loader's declared catalogues. */
export function creatureRules(content: { brains: readonly { id: string; kind?: string; pattern?: string }[]; groups?: readonly { id: string; members: readonly string[] }[]; spawns: readonly { id: string; brain: string | null; home?: unknown; phaseOffset?: unknown }[] }): string[] {
  const errors: string[] = [], brains = new Set(content.brains.map((b) => b.id));
  if (brains.size !== content.brains.length) errors.push('unique brain ids');
  for (const group of content.groups ?? []) { if (brains.has(group.id)) errors.push('unique controller ids'); brains.add(group.id); }
  if (new Set(content.spawns.map((s) => s.id)).size !== content.spawns.length) errors.push('unique spawn ids');
  if (content.spawns.some((s) => s.brain !== null && !brains.has(s.brain))) errors.push('declared spawn brain');
  for (const body of content.spawns) {
    const policy = content.brains.find(row => row.id === body.brain);
    if (body.phaseOffset !== undefined && !(policy?.kind === 'challenge-grazer'
      || (policy?.kind === 'grazer' && policy.pattern === 'circle-challenge'))) errors.push('declared per-body circle phase policy');
    if (body.home === undefined) continue;
    if (policy === undefined || !(policy.kind === 'ram-grazer' || policy.kind === 'orbit-diver'
      || policy.kind === 'patrol-diver' || policy.kind === 'burst-flyer' || policy.kind === 'diver'
      || (policy.kind === 'grazer' && policy.pattern === 'wander-ram'))) errors.push('declared per-body home policy');
  }
  errors.push(...groupBrainRules(content.groups ?? [], content.spawns, content.brains.map((row) => row.id)));
  return errors;
}

const strikeFinite = v.pipe(v.number(), v.finite(), v.minValue(-10000000), v.maxValue(10000000));
const strikeNonnegative = v.pipe(strikeFinite, v.minValue(0));
const strikePositive = v.pipe(strikeNonnegative, v.check(n => n > 0, 'positive number'));
const strikeId = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const strikeAngle = v.pipe(strikeNonnegative, v.maxValue(Math.PI));
const strikeShape = v.variant('kind', [
  v.strictObject({ kind: v.literal('arc'), radius: strikeNonnegative, halfAngle: strikeAngle, yawOffset: v.exactOptional(strikeFinite) }),
  v.strictObject({ kind: v.literal('lane'), length: strikeNonnegative, width: strikePositive }),
  v.pipe(v.strictObject({ kind: v.literal('ring'), inner: strikeFinite, outer: strikeFinite }), v.check(r => r.inner <= r.outer, 'ordered ring')),
  v.strictObject({ kind: v.literal('wedge'), length: strikeNonnegative, halfAngle: strikeAngle }),
  v.strictObject({ kind: v.literal('point'), radius: strikeNonnegative, exclusive: v.exactOptional(v.boolean()) }),
  v.strictObject({ kind: v.literal('sphere'), radius: strikeNonnegative }),
]);
const strikeWeight = v.variant('kind', [
  v.strictObject({ kind: v.literal('constant'), value: strikeFinite }),
  v.strictObject({ kind: v.literal('horizontal-distance'), above: strikeNonnegative, far: strikeFinite, near: strikeFinite }),
]);
const strikeTag = v.custom<`${string}.${string}`>(value => typeof value === 'string' && value.length <= 128 && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.*-]+$/u.test(value));
/** Full native strike data, including its finite score program; no author callback is admitted. */
export const CreatureStrikeSchema = v.strictObject({
  id: strikeId, shape: strikeShape, windup: strikeNonnegative, active: strikeNonnegative, recover: strikeNonnegative, cooldown: strikeNonnegative,
  range: v.nullable(strikeNonnegative), damage: strikeNonnegative, tags: v.pipe(v.array(strikeTag), v.maxLength(32)), weight: strikeWeight,
  units: v.exactOptional(v.picklist(['world', 'actor'])), alternatives: v.exactOptional(v.pipe(v.array(strikeShape), v.maxLength(16))),
  motion: v.exactOptional(v.strictObject({ speed: v.exactOptional(strikeNonnegative), delay: v.exactOptional(strikeNonnegative),
    track: v.exactOptional(v.picklist(['none', 'lead', 'follow'])), overshoot: v.exactOptional(strikeFinite), skid: v.exactOptional(strikeNonnegative) })),
  eligibility: v.exactOptional(v.strictObject({ maxDy: v.exactOptional(strikeNonnegative), jumpDodges: v.exactOptional(v.boolean()) })),
});
