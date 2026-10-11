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
const spawn = v.strictObject({ home: v.optional(CreatureHomeSchema), id, species: id, variant: id, brain: v.nullable(id), strike: v.nullable(id), seed: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffffffff)), scale: v.pipe(finite, v.minValue(0.1), v.maxValue(10)), at: v.tuple([coord, coord, coord]), yaw: finite });
/** Pure-data creature archetypes and stable spawn layouts, expanded before the local sim boots. */
export const CreaturesSchema = v.pipe(v.strictObject({ brains: v.pipe(v.array(v.variant('kind', [brain, SkirmisherSchema, GuardianSchema, PerchHunterSchema, ScriptBrainSchema, RamGrazerSchema, ChallengeGrazerSchema, OrbitDiverSchema, PatrolDiverSchema, BurstFlyerSchema, GrazerSchema, DiverSchema, GuardianPatternsSchema, StalkerSchema])), v.maxLength(64)), groups: v.optional(v.pipe(v.array(GroupBrainSchema), v.maxLength(64)), []), spawns: v.pipe(v.array(spawn), v.maxLength(10000)) }),
v.check((c) => creatureRules(c).length === 0, 'creature reference rules'));
/** Validated brain parameters and spawn layout, with no rig or runtime closure. */
export type ShardCreatures = v.InferOutput<typeof CreaturesSchema>;
/** Unique ids and brain references; species and strikes are resolved against the loader's declared catalogues. */
export function creatureRules(content: { brains: readonly { id: string; kind?: string; pattern?: string }[]; groups?: readonly { id: string; members: readonly string[] }[]; spawns: readonly { id: string; brain: string | null; home?: unknown }[] }): string[] {
  const errors: string[] = [], brains = new Set(content.brains.map((b) => b.id));
  if (brains.size !== content.brains.length) errors.push('unique brain ids');
  for (const group of content.groups ?? []) { if (brains.has(group.id)) errors.push('unique controller ids'); brains.add(group.id); }
  if (new Set(content.spawns.map((s) => s.id)).size !== content.spawns.length) errors.push('unique spawn ids');
  if (content.spawns.some((s) => s.brain !== null && !brains.has(s.brain))) errors.push('declared spawn brain');
  for (const body of content.spawns) {
    if (body.home === undefined) continue;
    const policy = content.brains.find(row => row.id === body.brain);
    if (policy === undefined || !(policy.kind === 'ram-grazer' || policy.kind === 'orbit-diver'
      || policy.kind === 'patrol-diver' || policy.kind === 'burst-flyer' || policy.kind === 'diver'
      || (policy.kind === 'grazer' && policy.pattern === 'wander-ram'))) errors.push('declared per-body home policy');
  }
  errors.push(...groupBrainRules(content.groups ?? [], content.spawns, content.brains.map((row) => row.id)));
  return errors;
}
