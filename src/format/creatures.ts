import * as v from 'valibot';
import { ReturnProgramSchema } from './namedJsonContracts';
import { NativeRidingSchema } from './nativeRiding';
import { isJsonData } from './json';
import { StalkerSchema, GuardianPatternsSchema, SkirmisherSchema, GuardianSchema, PerchHunterSchema, ScriptBrainSchema } from './brains';
import { GroupBrainSchema, groupBrainRules, GuardedHerdGuestSchema, GroupGuestBindingSchema } from './groupBrains';
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
export const CreatureHomeSchema: v.GenericSchema<ShardCreatureHomeInput, ShardCreatureHome> = v.strictObject({ x: coord, y: coord, z: coord, r: v.pipe(radius, v.minValue(Number.MIN_VALUE)) });
/** Bounded per-spawn home overriding a flyer's catalogue home or supplying its ram boundary. */

const memoryKey = v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/u),
  v.check(key => !['constructor', 'prototype', '__proto__'].includes(key), 'safe memory key'));
const memoryTest = v.picklist(['truthy', 'falsy']);
/** Ordered actor-memory contact gates; the owning body retains its attack phase and save fields. */
export const CreatureMemoryActionsSchema: v.GenericSchema<CreatureMemoryActionsRowsInput, CreatureMemoryActionsRows> = v.strictObject({ stateKey: memoryKey,
  states: v.pipe(v.array(memoryKey), v.minLength(1), v.maxLength(32)),
  actions: v.pipe(v.array(v.strictObject({ state: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(31)),
    phase: v.pipe(finite, v.minValue(0), v.maxValue(1)), strike: id,
    once: v.strictObject({ key: memoryKey, value: finite, test: v.picklist(['falsy', 'not-value']) }),
    when: v.exactOptional(v.strictObject({ key: memoryKey, test: memoryTest })),
    damage: v.exactOptional(v.literal('charge')),
    radiusScale: v.exactOptional(v.strictObject({ minimum: radius, factor: v.pipe(finite, v.minValue(0), v.maxValue(10)) })),
    sound: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))) })), v.maxLength(16)),
});
/** Immutable contact/action recipe, resolved against the admitted strike catalogue. */
type MemoryActions = v.InferOutput<typeof CreatureMemoryActionsSchema>;
export type CreatureMemoryActions = Omit<MemoryActions, 'states' | 'actions'> & {
  readonly states: readonly string[]; readonly actions: readonly MemoryActions['actions'][number][] };

/** Explicit native body authority; decisions never infer flight, contact origin or an attack grant. */
export const CreatureBodyRecipeSchema: v.GenericSchema<CreatureBodyRecipeRowsInput, CreatureBodyRecipeRows> = v.strictObject({
  actions: v.exactOptional(CreatureMemoryActionsSchema),
  /** Presentation depth on the same body: smoothstep from/to using normalized admitted actor memory. */
  offset: v.exactOptional(v.strictObject({ field: memoryKey, from: coord, to: coord })),
  kind: v.literal('animal'), motion: v.picklist(['ground', 'flight']),
  attack: v.picklist(['keeper', 'unlimited']), stunned: v.picklist(['none', 'look-hold']),
  contact: v.variant('kind', [
    v.strictObject({ kind: v.literal('environment'), halfArc: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI)) }),
    v.strictObject({ kind: v.literal('actor'), halfArc: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI)), move: v.pipe(v.string(), v.regex(/^[a-z][A-Za-z0-9._:-]*$/u), v.maxLength(128)) }),
  ]),
});
/** Serializable selection of the native motor and the exact existing creature-contact protocol. */
export type CreatureBodyRecipe = Omit<v.InferOutput<typeof CreatureBodyRecipeSchema>, 'actions'> & { readonly actions?: CreatureMemoryActions };
const phase = v.pipe(finite, v.minValue(-2 * Math.PI), v.maxValue(2 * Math.PI));
const spawn = v.strictObject({ phaseOffset: v.optional(phase), home: v.optional(CreatureHomeSchema), id, species: id, variant: id, brain: v.nullable(id), strike: v.nullable(id), seed: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffffffff)), scale: v.pipe(finite, v.minValue(0.1), v.maxValue(10)), at: v.tuple([coord, coord, coord]), yaw: finite });
/** Pure-data creature archetypes and stable spawn layouts, expanded before the local sim boots. */
export const CreaturesSchema: v.GenericSchema<ShardCreaturesInput, ShardCreatures> = v.pipe(v.strictObject({ brains: v.pipe(v.array(v.variant('kind', [brain, SkirmisherSchema, GuardianSchema, PerchHunterSchema, ScriptBrainSchema, RamGrazerSchema, ChallengeGrazerSchema, OrbitDiverSchema, PatrolDiverSchema, BurstFlyerSchema, GrazerSchema, DiverSchema, GuardianPatternsSchema, StalkerSchema])), v.maxLength(64)), groups: v.optional(v.pipe(v.array(GroupBrainSchema), v.maxLength(64)), []), spawns: v.pipe(v.array(spawn), v.maxLength(10000)) }),
v.check((c) => creatureRules(c).length === 0, 'creature reference rules'));
/** Validated brain parameters and spawn layout, with no rig or runtime closure. */

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
export const CreatureStrikeSchema: v.StrictObjectSchema<{ readonly id: v.GenericSchema<CreatureStrikeRowsInput['id'], CreatureStrikeRows['id']>; readonly shape: v.GenericSchema<CreatureStrikeRowsInput['shape'], CreatureStrikeRows['shape']>; readonly windup: v.GenericSchema<CreatureStrikeRowsInput['windup'], CreatureStrikeRows['windup']>; readonly active: v.GenericSchema<CreatureStrikeRowsInput['active'], CreatureStrikeRows['active']>; readonly recover: v.GenericSchema<CreatureStrikeRowsInput['recover'], CreatureStrikeRows['recover']>; readonly cooldown: v.GenericSchema<CreatureStrikeRowsInput['cooldown'], CreatureStrikeRows['cooldown']>; readonly range: v.GenericSchema<CreatureStrikeRowsInput['range'], CreatureStrikeRows['range']>; readonly damage: v.GenericSchema<CreatureStrikeRowsInput['damage'], CreatureStrikeRows['damage']>; readonly tags: v.SchemaWithPipe<readonly [v.ArraySchema<v.GenericSchema<CreatureStrikeRowsInput['tags'][number], CreatureStrikeRows['tags'][number]>, undefined>, v.MaxLengthAction<CreatureStrikeRows['tags'], 32, undefined>]>; readonly weight: v.GenericSchema<CreatureStrikeRowsInput['weight'], CreatureStrikeRows['weight']>; readonly units: v.ExactOptionalSchema<v.GenericSchema<Exclude<CreatureStrikeRowsInput['units'], undefined>, Exclude<CreatureStrikeRows['units'], undefined>>, undefined>; readonly alternatives: v.ExactOptionalSchema<v.GenericSchema<Exclude<CreatureStrikeRowsInput['alternatives'], undefined>, Exclude<CreatureStrikeRows['alternatives'], undefined>>, undefined>; readonly motion: v.ExactOptionalSchema<v.GenericSchema<Exclude<CreatureStrikeRowsInput['motion'], undefined>, Exclude<CreatureStrikeRows['motion'], undefined>>, undefined>; readonly eligibility: v.ExactOptionalSchema<v.GenericSchema<Exclude<CreatureStrikeRowsInput['eligibility'], undefined>, Exclude<CreatureStrikeRows['eligibility'], undefined>>, undefined>; }, undefined> = v.strictObject({
  id: strikeId, shape: strikeShape, windup: strikeNonnegative, active: strikeNonnegative, recover: strikeNonnegative, cooldown: strikeNonnegative,
  range: v.nullable(strikeNonnegative), damage: strikeNonnegative, tags: v.pipe(v.array(strikeTag), v.maxLength(32)), weight: strikeWeight,
  units: v.exactOptional(v.picklist(['world', 'actor'])), alternatives: v.exactOptional(v.pipe(v.array(strikeShape), v.maxLength(16))),
  motion: v.exactOptional(v.strictObject({ speed: v.exactOptional(strikeNonnegative), delay: v.exactOptional(strikeNonnegative),
    track: v.exactOptional(v.picklist(['none', 'lead', 'follow'])), overshoot: v.exactOptional(strikeFinite), skid: v.exactOptional(strikeNonnegative) })),
  eligibility: v.exactOptional(v.strictObject({ maxDy: v.exactOptional(strikeNonnegative), jumpDodges: v.exactOptional(v.boolean()) })),
});

/** Plain native strike catalogue; names are unique across the whole section. */
export const CreatureStrikesSchema: v.GenericSchema<CreatureStrikesInput, CreatureStrikes> = v.pipe(v.unknown(), v.check(isJsonData, 'plain JSON strike data'),
  v.array(CreatureStrikeSchema), v.maxLength(256),
  v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'unique strike ids'));
/** Admitted native strike rows, retaining world/actor units and motion laws. */

/** Read an entire actors/strikes section before resolving decision handles. */
export function readCreatureStrikes(input: unknown): CreatureStrikes { return v.parse(CreatureStrikesSchema, input); }

/** An admitted programme and finite group binding; no callback or second owner. */
const groupGuest=v.strictObject({program:ReturnProgramSchema,binding:GuardedHerdGuestSchema});

/** Ordered native group setup. A delay projection can consume its own declared
 * entropy between groups; adoption names a real actor outside the initial herd. */
export const NativeGroupRowsSchema: v.GenericSchema<NativeGroupRowsInput, NativeGroupRows> = v.strictObject({
  id, herds: id, tokens: id, bounds: v.tuple([coord, coord, coord, coord]), owned: v.pipe(v.array(id), v.maxLength(64)),
  contacts: v.strictObject({ pack: CreatureStrikeSchema, herd: CreatureStrikeSchema }),
  steps: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ kind: v.literal('group'), row: GroupBrainSchema, adopt: v.nullable(id), guest:v.exactOptional(groupGuest) }),
    v.strictObject({ kind: v.literal('delay'), program: ReturnProgramSchema, signal: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), channel: id }),
  ])), v.maxLength(17)),
});

/** Native population knockback tuning, shared by page and renderer-free bodies. */
const knockdownEntries={speed:v.pipe(finite,v.minValue(0)),min:v.pipe(finite,v.minValue(0)),max:v.pipe(finite,v.minValue(0)),seconds:v.pipe(finite,v.minValue(0))};
export const PopulationKnockdownSchema: v.GenericSchema<PopulationKnockdownRowsInput, PopulationKnockdownRows> = v.pipe(v.strictObject(knockdownEntries),v.check(row=>row.min<=row.max));
/** Native population notices and knockdown effects; no authored event handlers. */
export const PopulationEffectsSchema: v.GenericSchema<PopulationEffectsRowsInput, PopulationEffectsRows> = v.strictObject({
  notices:v.pipe(v.array(v.strictObject({signal:id,text:v.pipe(v.string(),v.minLength(1),v.maxLength(256)),every:v.pipe(finite,v.minValue(0))})),v.maxLength(32),v.check(rows=>new Set(rows.map(row=>row.signal)).size===rows.length)),
  knockdown:v.pipe(v.strictObject({...knockdownEntries,text:v.pipe(v.string(),v.minLength(1),v.maxLength(256)),every:v.pipe(finite,v.minValue(0))}),v.check(row=>row.min<=row.max)),
});
/** Client population groups use the same admitted brains and contact rows. */
export const PageGroupRowsSchema: v.GenericSchema<PageGroupRowsInput, PageGroupRows> = v.strictObject({
  pack: GroupBrainSchema,herd: GroupBrainSchema,contacts: v.strictObject({ pack: CreatureStrikeSchema,herd: CreatureStrikeSchema }),
  world: NativeRidingSchema.entries.world,wind: v.strictObject({ x: finite,z: finite,strength: finite }),
  prey: id,damage: ReturnProgramSchema,packGuest:v.exactOptional(v.strictObject({program:ReturnProgramSchema,binding:GroupGuestBindingSchema})),guest:v.exactOptional(groupGuest),effects:v.exactOptional(PopulationEffectsSchema),
});

/** Admitted creature data independent of validator implementation metadata. */
export type ShardCreatureHomeInput = ShardCreatureHome;
export interface ShardCreatureHome { x: number; y: number; z: number; r: number; }
export type CreatureMemoryActionsRowsInput = CreatureMemoryActionsRows;
export interface CreatureMemoryActionsRows { stateKey: string; states: (string)[]; actions: ({ state: number; phase: number; strike: string; once: { key: string; value: number; test: 'falsy' | 'not-value'; }; when?: { key: string; test: 'truthy' | 'falsy'; }; damage?: 'charge'; radiusScale?: { minimum: number; factor: number; }; sound?: string; })[]; }
export interface CreatureBodyRecipeRowsInput { actions?: CreatureMemoryActionsRowsInput; offset?: { field: string; from: number; to: number; }; kind: 'animal'; motion: 'ground' | 'flight'; attack: 'keeper' | 'unlimited'; stunned: 'none' | 'look-hold'; contact: ({ kind: 'environment'; halfArc: number; }) | ({ kind: 'actor'; halfArc: number; move: string; }); }
export interface CreatureBodyRecipeRows { actions?: CreatureMemoryActionsRows; offset?: { field: string; from: number; to: number; }; kind: 'animal'; motion: 'ground' | 'flight'; attack: 'keeper' | 'unlimited'; stunned: 'none' | 'look-hold'; contact: ({ kind: 'environment'; halfArc: number; }) | ({ kind: 'actor'; halfArc: number; move: string; }); }
// oxlint-disable-next-line typescript/consistent-type-definitions -- Valibot's readonly defaults need the alias's implicit dictionary compatibility.
export type ShardCreaturesInput = { brains: (({ id: string; kind: 'pursue'; awareRadius: number; leashRadius: number; speed: number; returnSpeed: number; stopDistance: number; turnRate: number; thinkDivisor: number; attackCooldownTicks: number; wanderRadius: number; wanderEveryTicks: number; }) | (v.InferInput<typeof SkirmisherSchema>) | (v.InferInput<typeof GuardianSchema>) | (v.InferInput<typeof PerchHunterSchema>) | (v.InferInput<typeof ScriptBrainSchema>) | (v.InferInput<typeof RamGrazerSchema>) | (v.InferInput<typeof ChallengeGrazerSchema>) | (v.InferInput<typeof OrbitDiverSchema>) | (v.InferInput<typeof PatrolDiverSchema>) | (v.InferInput<typeof BurstFlyerSchema>) | (v.InferInput<typeof GrazerSchema>) | (v.InferInput<typeof DiverSchema>) | (v.InferInput<typeof GuardianPatternsSchema>) | (v.InferInput<typeof StalkerSchema>))[]; groups?: (v.InferInput<typeof GroupBrainSchema>)[] | undefined; spawns: ({ phaseOffset?: number | undefined; home?: ShardCreatureHomeInput | undefined; id: string; species: string; variant: string; brain: (string) | null; strike: (string) | null; seed: number; scale: number; at: [number, number, number]; yaw: number; })[]; };
export interface ShardCreatures { brains: (({ id: string; kind: 'pursue'; awareRadius: number; leashRadius: number; speed: number; returnSpeed: number; stopDistance: number; turnRate: number; thinkDivisor: number; attackCooldownTicks: number; wanderRadius: number; wanderEveryTicks: number; }) | (v.InferOutput<typeof SkirmisherSchema>) | (v.InferOutput<typeof GuardianSchema>) | (v.InferOutput<typeof PerchHunterSchema>) | (v.InferOutput<typeof ScriptBrainSchema>) | (v.InferOutput<typeof RamGrazerSchema>) | (v.InferOutput<typeof ChallengeGrazerSchema>) | (v.InferOutput<typeof OrbitDiverSchema>) | (v.InferOutput<typeof PatrolDiverSchema>) | (v.InferOutput<typeof BurstFlyerSchema>) | (v.InferOutput<typeof GrazerSchema>) | (v.InferOutput<typeof DiverSchema>) | (v.InferOutput<typeof GuardianPatternsSchema>) | (v.InferOutput<typeof StalkerSchema>))[]; groups: (v.InferOutput<typeof GroupBrainSchema>)[]; spawns: ({ phaseOffset?: number | undefined; home?: ShardCreatureHome | undefined; id: string; species: string; variant: string; brain: (string) | null; strike: (string) | null; seed: number; scale: number; at: [number, number, number]; yaw: number; })[]; }
export type CreatureStrikeRowsInput = CreatureStrikeRows;
export interface CreatureStrikeRows { id: string; shape: ({ kind: 'arc'; radius: number; halfAngle: number; yawOffset?: number; }) | ({ kind: 'lane'; length: number; width: number; }) | ({ kind: 'ring'; inner: number; outer: number; }) | ({ kind: 'wedge'; length: number; halfAngle: number; }) | ({ kind: 'point'; radius: number; exclusive?: boolean; }) | ({ kind: 'sphere'; radius: number; }); windup: number; active: number; recover: number; cooldown: number; range: (number) | null; damage: number; tags: (`${string}.${string}`)[]; weight: ({ kind: 'constant'; value: number; }) | ({ kind: 'horizontal-distance'; above: number; far: number; near: number; }); units?: 'world' | 'actor'; alternatives?: (({ kind: 'arc'; radius: number; halfAngle: number; yawOffset?: number; }) | ({ kind: 'lane'; length: number; width: number; }) | ({ kind: 'ring'; inner: number; outer: number; }) | ({ kind: 'wedge'; length: number; halfAngle: number; }) | ({ kind: 'point'; radius: number; exclusive?: boolean; }) | ({ kind: 'sphere'; radius: number; }))[]; motion?: { speed?: number; delay?: number; track?: 'none' | 'lead' | 'follow'; overshoot?: number; skid?: number; }; eligibility?: { maxDy?: number; jumpDodges?: boolean; }; }
export type CreatureStrikesInput = unknown;
export type CreatureStrikes = (CreatureStrikeRows)[];
export interface NativeGroupRowsInput { id: string; herds: string; tokens: string; bounds: [number, number, number, number]; owned: (string)[]; contacts: { pack: CreatureStrikeRowsInput; herd: CreatureStrikeRowsInput; }; steps: (({ kind: 'group'; row: v.InferInput<typeof GroupBrainSchema>; adopt: (string) | null; guest?: { program: v.InferInput<typeof ReturnProgramSchema>; binding: v.InferInput<typeof GuardedHerdGuestSchema>; }; }) | ({ kind: 'delay'; program: v.InferInput<typeof ReturnProgramSchema>; signal: string; channel: string; }))[]; }
export interface NativeGroupRows { id: string; herds: string; tokens: string; bounds: [number, number, number, number]; owned: (string)[]; contacts: { pack: CreatureStrikeRows; herd: CreatureStrikeRows; }; steps: (({ kind: 'group'; row: v.InferOutput<typeof GroupBrainSchema>; adopt: (string) | null; guest?: { program: v.InferOutput<typeof ReturnProgramSchema>; binding: v.InferOutput<typeof GuardedHerdGuestSchema>; }; }) | ({ kind: 'delay'; program: v.InferOutput<typeof ReturnProgramSchema>; signal: string; channel: string; }))[]; }
export type PopulationKnockdownRowsInput = PopulationKnockdownRows;
export interface PopulationKnockdownRows { speed: number; min: number; max: number; seconds: number; }
export type PopulationEffectsRowsInput = PopulationEffectsRows;
export interface PopulationEffectsRows { notices: ({ signal: string; text: string; every: number; })[]; knockdown: { text: string; every: number; } & { speed: number; min: number; max: number; seconds: number; }; }
export interface PageGroupRowsInput { pack: v.InferInput<typeof GroupBrainSchema>; herd: v.InferInput<typeof GroupBrainSchema>; contacts: { pack: CreatureStrikeRowsInput; herd: CreatureStrikeRowsInput; }; world: v.InferInput<typeof NativeRidingSchema.entries.world>; wind: { x: number; z: number; strength: number; }; prey: string; damage: v.InferInput<typeof ReturnProgramSchema>; packGuest?: { program: v.InferInput<typeof ReturnProgramSchema>; binding: v.InferInput<typeof GroupGuestBindingSchema>; }; guest?: { program: v.InferInput<typeof ReturnProgramSchema>; binding: v.InferInput<typeof GuardedHerdGuestSchema>; }; effects?: PopulationEffectsRowsInput; }
export interface PageGroupRows { pack: v.InferOutput<typeof GroupBrainSchema>; herd: v.InferOutput<typeof GroupBrainSchema>; contacts: { pack: CreatureStrikeRows; herd: CreatureStrikeRows; }; world: v.InferOutput<typeof NativeRidingSchema.entries.world>; wind: { x: number; z: number; strength: number; }; prey: string; damage: v.InferOutput<typeof ReturnProgramSchema>; packGuest?: { program: v.InferOutput<typeof ReturnProgramSchema>; binding: v.InferOutput<typeof GroupGuestBindingSchema>; }; guest?: { program: v.InferOutput<typeof ReturnProgramSchema>; binding: v.InferOutput<typeof GuardedHerdGuestSchema>; }; effects?: PopulationEffectsRows; }
