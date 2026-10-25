import * as v from 'valibot';

/** Built-in guarded group states shared by its wire rows and native owner. */
export const GUARDED_STALLION_STATES: readonly ['watch', 'warn', 'display', 'charge', 'wheel', 'lead', 'beaten', 'ridden'] = ['watch', 'warn', 'display', 'charge', 'wheel', 'lead', 'beaten', 'ridden'] as const;

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
const packEntries = {
  id, kind: v.literal('pack'), thinkDivisor: v.literal(6), members, home: v.tuple([coord, coord]),
  trotSpeed: speed, runSpeed: speed, shadowMinRadius: radius, shadowMaxRadius: radius,
  ringMinRadius: radius, ringMaxRadius: radius, biteRadius: radius, sightRadius: radius,
  coneAngle: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI)), smellRadius: radius, hearing,
  telegraphSeconds: duration, dashSeconds: duration, breakoffSeconds: duration, attackSeconds: duration,
  leaderVariant: id, yipCue: cue, howlCue: cue, snarlCue: cue, biteCue: cue,
};
const packRules = (row: { trotSpeed: number; runSpeed: number; shadowMinRadius: number; shadowMaxRadius: number; ringMinRadius: number; ringMaxRadius: number; hearing: readonly number[] }): boolean => row.trotSpeed <= row.runSpeed && row.shadowMinRadius <= row.shadowMaxRadius
  && row.ringMinRadius <= row.ringMaxRadius && orderedHearing(row.hearing);
/** Historical circling-pack declaration, preserving parsed field order and continuation contracts. */
export const PackGroupSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<ShardPackGroupInput['id'], ShardPackGroup['id']>; readonly kind: v.GenericSchema<ShardPackGroupInput['kind'], ShardPackGroup['kind']>; readonly thinkDivisor: v.GenericSchema<ShardPackGroupInput['thinkDivisor'], ShardPackGroup['thinkDivisor']>; readonly members: v.GenericSchema<ShardPackGroupInput['members'], ShardPackGroup['members']>; readonly home: v.GenericSchema<ShardPackGroupInput['home'], ShardPackGroup['home']>; readonly trotSpeed: v.GenericSchema<ShardPackGroupInput['trotSpeed'], ShardPackGroup['trotSpeed']>; readonly runSpeed: v.GenericSchema<ShardPackGroupInput['runSpeed'], ShardPackGroup['runSpeed']>; readonly shadowMinRadius: v.GenericSchema<ShardPackGroupInput['shadowMinRadius'], ShardPackGroup['shadowMinRadius']>; readonly shadowMaxRadius: v.GenericSchema<ShardPackGroupInput['shadowMaxRadius'], ShardPackGroup['shadowMaxRadius']>; readonly ringMinRadius: v.GenericSchema<ShardPackGroupInput['ringMinRadius'], ShardPackGroup['ringMinRadius']>; readonly ringMaxRadius: v.GenericSchema<ShardPackGroupInput['ringMaxRadius'], ShardPackGroup['ringMaxRadius']>; readonly biteRadius: v.GenericSchema<ShardPackGroupInput['biteRadius'], ShardPackGroup['biteRadius']>; readonly sightRadius: v.GenericSchema<ShardPackGroupInput['sightRadius'], ShardPackGroup['sightRadius']>; readonly coneAngle: v.GenericSchema<ShardPackGroupInput['coneAngle'], ShardPackGroup['coneAngle']>; readonly smellRadius: v.GenericSchema<ShardPackGroupInput['smellRadius'], ShardPackGroup['smellRadius']>; readonly hearing: v.GenericSchema<ShardPackGroupInput['hearing'], ShardPackGroup['hearing']>; readonly telegraphSeconds: v.GenericSchema<ShardPackGroupInput['telegraphSeconds'], ShardPackGroup['telegraphSeconds']>; readonly dashSeconds: v.GenericSchema<ShardPackGroupInput['dashSeconds'], ShardPackGroup['dashSeconds']>; readonly breakoffSeconds: v.GenericSchema<ShardPackGroupInput['breakoffSeconds'], ShardPackGroup['breakoffSeconds']>; readonly attackSeconds: v.GenericSchema<ShardPackGroupInput['attackSeconds'], ShardPackGroup['attackSeconds']>; readonly leaderVariant: v.GenericSchema<ShardPackGroupInput['leaderVariant'], ShardPackGroup['leaderVariant']>; readonly yipCue: v.GenericSchema<ShardPackGroupInput['yipCue'], ShardPackGroup['yipCue']>; readonly howlCue: v.GenericSchema<ShardPackGroupInput['howlCue'], ShardPackGroup['howlCue']>; readonly snarlCue: v.GenericSchema<ShardPackGroupInput['snarlCue'], ShardPackGroup['snarlCue']>; readonly biteCue: v.GenericSchema<ShardPackGroupInput['biteCue'], ShardPackGroup['biteCue']>; }, undefined>, v.CheckAction<{ [K in keyof ShardPackGroup]: ShardPackGroup[K] }, 'Ordered pack tuning'>]> = v.pipe(v.strictObject(packEntries), v.check(row => packRules(row), 'Ordered pack tuning'));
/** Parametric stalker pack with exactly the same real roster, native recipes and finite tuning. */
export const StalkerGroupSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<StalkerGroupRowsInput['id'], StalkerGroupRows['id']>; readonly kind: v.GenericSchema<StalkerGroupRowsInput['kind'], StalkerGroupRows['kind']>; readonly thinkDivisor: v.GenericSchema<StalkerGroupRowsInput['thinkDivisor'], StalkerGroupRows['thinkDivisor']>; readonly members: v.GenericSchema<StalkerGroupRowsInput['members'], StalkerGroupRows['members']>; readonly home: v.GenericSchema<StalkerGroupRowsInput['home'], StalkerGroupRows['home']>; readonly trotSpeed: v.GenericSchema<StalkerGroupRowsInput['trotSpeed'], StalkerGroupRows['trotSpeed']>; readonly runSpeed: v.GenericSchema<StalkerGroupRowsInput['runSpeed'], StalkerGroupRows['runSpeed']>; readonly shadowMinRadius: v.GenericSchema<StalkerGroupRowsInput['shadowMinRadius'], StalkerGroupRows['shadowMinRadius']>; readonly shadowMaxRadius: v.GenericSchema<StalkerGroupRowsInput['shadowMaxRadius'], StalkerGroupRows['shadowMaxRadius']>; readonly ringMinRadius: v.GenericSchema<StalkerGroupRowsInput['ringMinRadius'], StalkerGroupRows['ringMinRadius']>; readonly ringMaxRadius: v.GenericSchema<StalkerGroupRowsInput['ringMaxRadius'], StalkerGroupRows['ringMaxRadius']>; readonly biteRadius: v.GenericSchema<StalkerGroupRowsInput['biteRadius'], StalkerGroupRows['biteRadius']>; readonly sightRadius: v.GenericSchema<StalkerGroupRowsInput['sightRadius'], StalkerGroupRows['sightRadius']>; readonly coneAngle: v.GenericSchema<StalkerGroupRowsInput['coneAngle'], StalkerGroupRows['coneAngle']>; readonly smellRadius: v.GenericSchema<StalkerGroupRowsInput['smellRadius'], StalkerGroupRows['smellRadius']>; readonly hearing: v.GenericSchema<StalkerGroupRowsInput['hearing'], StalkerGroupRows['hearing']>; readonly telegraphSeconds: v.GenericSchema<StalkerGroupRowsInput['telegraphSeconds'], StalkerGroupRows['telegraphSeconds']>; readonly dashSeconds: v.GenericSchema<StalkerGroupRowsInput['dashSeconds'], StalkerGroupRows['dashSeconds']>; readonly breakoffSeconds: v.GenericSchema<StalkerGroupRowsInput['breakoffSeconds'], StalkerGroupRows['breakoffSeconds']>; readonly attackSeconds: v.GenericSchema<StalkerGroupRowsInput['attackSeconds'], StalkerGroupRows['attackSeconds']>; readonly leaderVariant: v.GenericSchema<StalkerGroupRowsInput['leaderVariant'], StalkerGroupRows['leaderVariant']>; readonly yipCue: v.GenericSchema<StalkerGroupRowsInput['yipCue'], StalkerGroupRows['yipCue']>; readonly howlCue: v.GenericSchema<StalkerGroupRowsInput['howlCue'], StalkerGroupRows['howlCue']>; readonly snarlCue: v.GenericSchema<StalkerGroupRowsInput['snarlCue'], StalkerGroupRows['snarlCue']>; readonly biteCue: v.GenericSchema<StalkerGroupRowsInput['biteCue'], StalkerGroupRows['biteCue']>; readonly pattern: v.GenericSchema<StalkerGroupRowsInput['pattern'], StalkerGroupRows['pattern']>; }, undefined>, v.CheckAction<{ [K in keyof StalkerGroupRows]: StalkerGroupRows[K] }, 'Ordered pack tuning'>]> = v.pipe(v.strictObject({ ...packEntries, kind: v.literal('stalker'), pattern: v.literal('pack') }), v.check(row => packRules(row), 'Ordered pack tuning'));
/** One guarded-herd controller with an ordered roster; native riding/taming and contact recipes are injected. */
const herdEntries = {
  id, kind: v.literal('herd'), thinkDivisor: v.literal(6), members,
  walkSpeed: speed, trotSpeed: speed, gallopSpeed: speed, chargeSpeed: speed,
  sightRadius: radius, grazingSightRadius: radius, coneAngle: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI)), hearing,
  alertThreshold: v.pipe(finite, v.minValue(Number.MIN_VALUE), v.maxValue(1)), flightMinDistance: radius, flightMaxDistance: radius,
  stallionVariant: id, foalPrefix: id, snortCue: cue, neighCue: cue, squealCue: cue,
};
const herdRules = (row: { walkSpeed: number; trotSpeed: number; gallopSpeed: number; grazingSightRadius: number; sightRadius: number; flightMinDistance: number; flightMaxDistance: number; hearing: readonly number[] }): boolean => row.walkSpeed <= row.trotSpeed && row.trotSpeed <= row.gallopSpeed
  && row.grazingSightRadius <= row.sightRadius && row.flightMinDistance <= row.flightMaxDistance
  && orderedHearing(row.hearing);
/** Historical guarded-herd declaration, preserving parsed field order and continuation contracts. */
export const HerdGroupSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<ShardHerdGroupInput['id'], ShardHerdGroup['id']>; readonly kind: v.GenericSchema<ShardHerdGroupInput['kind'], ShardHerdGroup['kind']>; readonly thinkDivisor: v.GenericSchema<ShardHerdGroupInput['thinkDivisor'], ShardHerdGroup['thinkDivisor']>; readonly members: v.GenericSchema<ShardHerdGroupInput['members'], ShardHerdGroup['members']>; readonly walkSpeed: v.GenericSchema<ShardHerdGroupInput['walkSpeed'], ShardHerdGroup['walkSpeed']>; readonly trotSpeed: v.GenericSchema<ShardHerdGroupInput['trotSpeed'], ShardHerdGroup['trotSpeed']>; readonly gallopSpeed: v.GenericSchema<ShardHerdGroupInput['gallopSpeed'], ShardHerdGroup['gallopSpeed']>; readonly chargeSpeed: v.GenericSchema<ShardHerdGroupInput['chargeSpeed'], ShardHerdGroup['chargeSpeed']>; readonly sightRadius: v.GenericSchema<ShardHerdGroupInput['sightRadius'], ShardHerdGroup['sightRadius']>; readonly grazingSightRadius: v.GenericSchema<ShardHerdGroupInput['grazingSightRadius'], ShardHerdGroup['grazingSightRadius']>; readonly coneAngle: v.GenericSchema<ShardHerdGroupInput['coneAngle'], ShardHerdGroup['coneAngle']>; readonly hearing: v.GenericSchema<ShardHerdGroupInput['hearing'], ShardHerdGroup['hearing']>; readonly alertThreshold: v.GenericSchema<ShardHerdGroupInput['alertThreshold'], ShardHerdGroup['alertThreshold']>; readonly flightMinDistance: v.GenericSchema<ShardHerdGroupInput['flightMinDistance'], ShardHerdGroup['flightMinDistance']>; readonly flightMaxDistance: v.GenericSchema<ShardHerdGroupInput['flightMaxDistance'], ShardHerdGroup['flightMaxDistance']>; readonly stallionVariant: v.GenericSchema<ShardHerdGroupInput['stallionVariant'], ShardHerdGroup['stallionVariant']>; readonly foalPrefix: v.GenericSchema<ShardHerdGroupInput['foalPrefix'], ShardHerdGroup['foalPrefix']>; readonly snortCue: v.GenericSchema<ShardHerdGroupInput['snortCue'], ShardHerdGroup['snortCue']>; readonly neighCue: v.GenericSchema<ShardHerdGroupInput['neighCue'], ShardHerdGroup['neighCue']>; readonly squealCue: v.GenericSchema<ShardHerdGroupInput['squealCue'], ShardHerdGroup['squealCue']>; }, undefined>, v.CheckAction<{ [K in keyof ShardHerdGroup]: ShardHerdGroup[K] }, 'Ordered herd tuning'>]> = v.pipe(v.strictObject(herdEntries), v.check(row => herdRules(row), 'Ordered herd tuning'));
/** Parametric grazer herd with exactly the same real roster, native recipes and finite tuning. */
export const GrazerGroupSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly id: v.GenericSchema<GrazerGroupRowsInput['id'], GrazerGroupRows['id']>; readonly kind: v.GenericSchema<GrazerGroupRowsInput['kind'], GrazerGroupRows['kind']>; readonly thinkDivisor: v.GenericSchema<GrazerGroupRowsInput['thinkDivisor'], GrazerGroupRows['thinkDivisor']>; readonly members: v.GenericSchema<GrazerGroupRowsInput['members'], GrazerGroupRows['members']>; readonly walkSpeed: v.GenericSchema<GrazerGroupRowsInput['walkSpeed'], GrazerGroupRows['walkSpeed']>; readonly trotSpeed: v.GenericSchema<GrazerGroupRowsInput['trotSpeed'], GrazerGroupRows['trotSpeed']>; readonly gallopSpeed: v.GenericSchema<GrazerGroupRowsInput['gallopSpeed'], GrazerGroupRows['gallopSpeed']>; readonly chargeSpeed: v.GenericSchema<GrazerGroupRowsInput['chargeSpeed'], GrazerGroupRows['chargeSpeed']>; readonly sightRadius: v.GenericSchema<GrazerGroupRowsInput['sightRadius'], GrazerGroupRows['sightRadius']>; readonly grazingSightRadius: v.GenericSchema<GrazerGroupRowsInput['grazingSightRadius'], GrazerGroupRows['grazingSightRadius']>; readonly coneAngle: v.GenericSchema<GrazerGroupRowsInput['coneAngle'], GrazerGroupRows['coneAngle']>; readonly hearing: v.GenericSchema<GrazerGroupRowsInput['hearing'], GrazerGroupRows['hearing']>; readonly alertThreshold: v.GenericSchema<GrazerGroupRowsInput['alertThreshold'], GrazerGroupRows['alertThreshold']>; readonly flightMinDistance: v.GenericSchema<GrazerGroupRowsInput['flightMinDistance'], GrazerGroupRows['flightMinDistance']>; readonly flightMaxDistance: v.GenericSchema<GrazerGroupRowsInput['flightMaxDistance'], GrazerGroupRows['flightMaxDistance']>; readonly stallionVariant: v.GenericSchema<GrazerGroupRowsInput['stallionVariant'], GrazerGroupRows['stallionVariant']>; readonly foalPrefix: v.GenericSchema<GrazerGroupRowsInput['foalPrefix'], GrazerGroupRows['foalPrefix']>; readonly snortCue: v.GenericSchema<GrazerGroupRowsInput['snortCue'], GrazerGroupRows['snortCue']>; readonly neighCue: v.GenericSchema<GrazerGroupRowsInput['neighCue'], GrazerGroupRows['neighCue']>; readonly squealCue: v.GenericSchema<GrazerGroupRowsInput['squealCue'], GrazerGroupRows['squealCue']>; readonly pattern: v.GenericSchema<GrazerGroupRowsInput['pattern'], GrazerGroupRows['pattern']>; }, undefined>, v.CheckAction<{ [K in keyof GrazerGroupRows]: GrazerGroupRows[K] }, 'Ordered herd tuning'>]> = v.pipe(v.strictObject({ ...herdEntries, kind: v.literal('grazer'), pattern: v.literal('herd') }), v.check(row => herdRules(row), 'Ordered herd tuning'));
/** Admitted circling-pack data and explicit roster, independent from native recipes. */

/** Admitted guarded-herd data and explicit roster, independent from native recipes. */

/** Group controller declaration; the full creature loader checks identity and controller conflicts. */
export const GroupBrainSchema: v.GenericSchema<ShardGroupBrainInput, ShardGroupBrain> = v.variant('kind', [PackGroupSchema, HerdGroupSchema, StalkerGroupSchema, GrazerGroupSchema]);
/** A pack or herd group controller; an actor may belong to exactly one controller. */

/** Validate finite tuning, six-tick cadence and the complete ordered roster before touching an actor or RNG. */
export function parseGroupBrain(data: unknown): ShardGroupBrain { return v.parse(GroupBrainSchema, data); }
/** Canonical native preset row: author tags never alter parsed tuning order or existing saved contracts. */
export function nativeGroupBrain(data: unknown): ShardPackGroup | ShardHerdGroup {
  const row = parseGroupBrain(data);
  if (row.kind === 'stalker') { const { pattern, ...native } = row; void pattern; return v.parse(PackGroupSchema, { ...native, kind: 'pack' }); }
  if (row.kind === 'grazer') { const { pattern, ...native } = row; void pattern; return v.parse(HerdGroupSchema, { ...native, kind: 'herd' }); }
  return row;
}
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

const guestName = v.pipe(v.string(),v.minLength(1),v.maxLength(128));
export const GroupGuestBindingSchema: v.StrictObjectSchema<{ readonly profile: v.GenericSchema<GroupGuestBindingRowsInput['profile'], GroupGuestBindingRows['profile']>; readonly capture: v.ExactOptionalSchema<v.GenericSchema<Exclude<GroupGuestBindingRowsInput['capture'], undefined>, Exclude<GroupGuestBindingRows['capture'], undefined>>, undefined>; readonly parameters: v.GenericSchema<GroupGuestBindingRowsInput['parameters'], GroupGuestBindingRows['parameters']>; readonly resume: v.GenericSchema<GroupGuestBindingRowsInput['resume'], GroupGuestBindingRows['resume']>; }, undefined> = v.strictObject({profile:guestName,capture:v.exactOptional(v.strictObject({common:v.pipe(v.array(guestName),v.maxLength(128)),slots:v.pipe(v.array(guestName),v.maxLength(16)),references:v.pipe(v.array(guestName),v.maxLength(16))})),parameters:v.record(guestName,v.pipe(v.number(),v.finite())),
  resume:v.strictObject({field:guestName,values:v.pipe(v.array(v.pipe(v.number(),v.integer(),v.minValue(0))),v.minLength(1),v.maxLength(512),
    v.check(values=>values.includes(0)&&new Set(values).size===values.length)),segments:v.pipe(v.number(),v.integer(),v.minValue(1),v.maxValue(512))})});
/** Shared finite binding into an already-selected group profile. */

/** Finite per-member locomotion outputs; contacts keep their native slot. */
export const HERD_DRIVE_PLAN_FIELDS: readonly ['kind', 'state', 'yaw', 'speed', 'turn', 'targetX', 'targetZ', 'pathEvery', 'blendX', 'blendZ', 'headUp', 'lookKind', 'lookX', 'lookZ', 'lookWeight', 'flags', 'memoryMask', 'gt', 'gyaw', 'gs', 'snT', 'pin', 'rear', 'sound'] = ['kind','state','yaw','speed','turn','targetX','targetZ','pathEvery','blendX','blendZ','headUp','lookKind','lookX','lookZ','lookWeight','flags','memoryMask','gt','gyaw','gs','snT','pin','rear','sound'] as const;
export const GuardedHerdGuestSchema: v.GenericSchema<GuardedHerdGuestRowsInput, GuardedHerdGuestRows> = v.strictObject({...GroupGuestBindingSchema.entries,references:v.exactOptional(v.record(guestName,guestName)),plans:v.exactOptional(v.literal(true))});
/** Finite binding into an already-admitted group profile; no owner or callback is authored. */


/** Admitted data contracts, independent of validator implementation metadata. */
export type ShardPackGroupInput = ShardPackGroup;
interface ShardPackGroupFields {
    id: string;
    kind: 'pack';
    thinkDivisor: 6;
    members: (string)[];
    home: [
        number,
        number
    ];
    trotSpeed: number;
    runSpeed: number;
    shadowMinRadius: number;
    shadowMaxRadius: number;
    ringMinRadius: number;
    ringMaxRadius: number;
    biteRadius: number;
    sightRadius: number;
    coneAngle: number;
    smellRadius: number;
    hearing: [
        number,
        number,
        number,
        number
    ];
    telegraphSeconds: number;
    dashSeconds: number;
    breakoffSeconds: number;
    attackSeconds: number;
    leaderVariant: string;
    yipCue: string;
    howlCue: string;
    snarlCue: string;
    biteCue: string;
}
export type ShardPackGroup = { [Key in keyof ShardPackGroupFields]: ShardPackGroupFields[Key] };
export type StalkerGroupRowsInput = StalkerGroupRows;
interface StalkerGroupRowsFields {
    id: string;
    kind: 'stalker';
    thinkDivisor: 6;
    members: (string)[];
    home: [
        number,
        number
    ];
    trotSpeed: number;
    runSpeed: number;
    shadowMinRadius: number;
    shadowMaxRadius: number;
    ringMinRadius: number;
    ringMaxRadius: number;
    biteRadius: number;
    sightRadius: number;
    coneAngle: number;
    smellRadius: number;
    hearing: [
        number,
        number,
        number,
        number
    ];
    telegraphSeconds: number;
    dashSeconds: number;
    breakoffSeconds: number;
    attackSeconds: number;
    leaderVariant: string;
    yipCue: string;
    howlCue: string;
    snarlCue: string;
    biteCue: string;
    pattern: 'pack';
}
export type StalkerGroupRows = { [Key in keyof StalkerGroupRowsFields]: StalkerGroupRowsFields[Key] };
export type ShardHerdGroupInput = ShardHerdGroup;
interface ShardHerdGroupFields {
    id: string;
    kind: 'herd';
    thinkDivisor: 6;
    members: (string)[];
    walkSpeed: number;
    trotSpeed: number;
    gallopSpeed: number;
    chargeSpeed: number;
    sightRadius: number;
    grazingSightRadius: number;
    coneAngle: number;
    hearing: [
        number,
        number,
        number,
        number
    ];
    alertThreshold: number;
    flightMinDistance: number;
    flightMaxDistance: number;
    stallionVariant: string;
    foalPrefix: string;
    snortCue: string;
    neighCue: string;
    squealCue: string;
}
export type ShardHerdGroup = { [Key in keyof ShardHerdGroupFields]: ShardHerdGroupFields[Key] };
export type GrazerGroupRowsInput = GrazerGroupRows;
interface GrazerGroupRowsFields {
    id: string;
    kind: 'grazer';
    thinkDivisor: 6;
    members: (string)[];
    walkSpeed: number;
    trotSpeed: number;
    gallopSpeed: number;
    chargeSpeed: number;
    sightRadius: number;
    grazingSightRadius: number;
    coneAngle: number;
    hearing: [
        number,
        number,
        number,
        number
    ];
    alertThreshold: number;
    flightMinDistance: number;
    flightMaxDistance: number;
    stallionVariant: string;
    foalPrefix: string;
    snortCue: string;
    neighCue: string;
    squealCue: string;
    pattern: 'herd';
}
export type GrazerGroupRows = { [Key in keyof GrazerGroupRowsFields]: GrazerGroupRowsFields[Key] };
export type ShardGroupBrainInput = (ShardPackGroupInput) | (ShardHerdGroupInput) | (StalkerGroupRowsInput) | (GrazerGroupRowsInput);
export type ShardGroupBrain = (ShardPackGroup) | (ShardHerdGroup) | (StalkerGroupRows) | (GrazerGroupRows);
export type GroupGuestBindingRowsInput = GroupGuestBindingRows;
interface GroupGuestBindingRowsFields {
    profile: string;
    capture?: {
        common: (string)[];
        slots: (string)[];
        references: (string)[];
    };
    parameters: Record<string, number>;
    resume: {
        field: string;
        values: (number)[];
        segments: number;
    };
}
export type GroupGuestBindingRows = { [Key in keyof GroupGuestBindingRowsFields]: GroupGuestBindingRowsFields[Key] };
export type GuardedHerdGuestRowsInput = {
    references?: Record<string, string>;
    plans?: true;
} & GroupGuestBindingRowsInput;
export type GuardedHerdGuestRows = {
    references?: Record<string, string>;
    plans?: true;
} & GroupGuestBindingRows;
