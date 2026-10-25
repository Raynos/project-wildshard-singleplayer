import * as v from 'valibot';
import { SpawnTablesSchema } from './spawnTables';
import { isJsonData } from './json';
import { SpeciesBrainSchema } from './speciesBrain';
import { CreatureBodyRecipeSchema, CreatureStrikeSchema } from './creatures';

const finite = v.pipe(v.number(), v.finite(), v.minValue(-10000000), v.maxValue(10000000));
const nonnegative = v.pipe(finite, v.minValue(0));
const positive = v.pipe(nonnegative, v.check(n => n > 0, 'positive number'));
const text = v.pipe(v.string(), v.maxLength(4096));
const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const ordered = v.pipe(v.tuple([positive, positive]), v.check(([a, b]) => a <= b, 'ordered range'));
const mods = v.strictObject({ speed: v.exactOptional(nonnegative), chargeDist: v.exactOptional(nonnegative),
  damageTaken: v.exactOptional(nonnegative), chargeDamage: v.exactOptional(nonnegative), relentless: v.exactOptional(v.boolean()) });
const variant = v.strictObject({ id, label: text, weight: nonnegative, rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  scale: ordered, hp: v.exactOptional(positive), mods: v.exactOptional(mods) });
const stalk = v.strictObject({ detect: nonnegative, speed: nonnegative, giveUp: nonnegative, rechargeCd: nonnegative,
  huffMin: nonnegative, huffMax: nonnegative, roar: text, fleeBelowHp: nonnegative, fleeChance: nonnegative });
const tuning = v.strictObject({
  hp: nonnegative, sightRange: nonnegative, sightRangeGraze: nonnegative, sightCone: nonnegative, hearStill: nonnegative,
  hearCrouch: nonnegative, hearWalk: nonnegative, hearSprint: nonnegative, noticeRate: nonnegative, forgetRate: nonnegative,
  alertAt: nonnegative, boltAt: nonnegative, freezeMin: nonnegative, freezeMax: nonnegative, relaxAfter: nonnegative,
  panicDist: nonnegative, runSpeed: nonnegative, trotSpeed: nonnegative, fleeMinTime: nonnegative, fleeUntil: nonnegative,
  fleeUntilMax: nonnegative, fleeMaxTime: nonnegative, lookBack: nonnegative, waryTime: nonnegative, waryBoost: nonnegative,
  herdAlertRadius: nonnegative, herdBoltDelayMin: nonnegative, herdBoltDelayMax: nonnegative, impactSpook: nonnegative, impactAlert: nonnegative,
  stalk: v.exactOptional(stalk),
});
const optionalTuning = v.strictObject({
  hp: v.exactOptional(nonnegative), sightRange: v.exactOptional(nonnegative), sightRangeGraze: v.exactOptional(nonnegative), sightCone: v.exactOptional(nonnegative), hearStill: v.exactOptional(nonnegative),
  hearCrouch: v.exactOptional(nonnegative), hearWalk: v.exactOptional(nonnegative), hearSprint: v.exactOptional(nonnegative), noticeRate: v.exactOptional(nonnegative), forgetRate: v.exactOptional(nonnegative),
  alertAt: v.exactOptional(nonnegative), boltAt: v.exactOptional(nonnegative), freezeMin: v.exactOptional(nonnegative), freezeMax: v.exactOptional(nonnegative), relaxAfter: v.exactOptional(nonnegative),
  panicDist: v.exactOptional(nonnegative), runSpeed: v.exactOptional(nonnegative), trotSpeed: v.exactOptional(nonnegative), fleeMinTime: v.exactOptional(nonnegative), fleeUntil: v.exactOptional(nonnegative),
  fleeUntilMax: v.exactOptional(nonnegative), fleeMaxTime: v.exactOptional(nonnegative), lookBack: v.exactOptional(nonnegative), waryTime: v.exactOptional(nonnegative), waryBoost: v.exactOptional(nonnegative),
  herdAlertRadius: v.exactOptional(nonnegative), herdBoltDelayMin: v.exactOptional(nonnegative), herdBoltDelayMax: v.exactOptional(nonnegative), impactSpook: v.exactOptional(nonnegative), impactAlert: v.exactOptional(nonnegative),
  stalk: v.exactOptional(stalk),
});
const flight = v.strictObject({ altitude: finite, above: v.exactOptional(v.picklist(['ground', 'world'])),
  climbRate: positive, diveRate: positive, lockRange: v.exactOptional(positive),
  bank: v.exactOptional(v.pipe(positive, v.check(n => n < Math.PI / 2, 'bank below pi/2'))) });
/** Strict species data, with bounded ordered variants and no native callback fields. */
export const SpeciesSchema: v.StrictObjectSchema<{ readonly id: v.GenericSchema<SpeciesDataInput['id'], SpeciesData['id']>; readonly kind: v.GenericSchema<SpeciesDataInput['kind'], SpeciesData['kind']>; readonly label: v.GenericSchema<SpeciesDataInput['label'], SpeciesData['label']>; readonly variants: v.ArraySchema<v.StrictObjectSchema<{ readonly id: v.GenericSchema<SpeciesVariantDataInput['id'], SpeciesVariantData['id']>; readonly label: v.GenericSchema<SpeciesVariantDataInput['label'], SpeciesVariantData['label']>; readonly weight: v.GenericSchema<SpeciesVariantDataInput['weight'], SpeciesVariantData['weight']>; readonly rarity: v.GenericSchema<SpeciesVariantDataInput['rarity'], SpeciesVariantData['rarity']>; readonly scale: v.GenericSchema<SpeciesVariantDataInput['scale'], SpeciesVariantData['scale']>; readonly hp: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesVariantDataInput['hp'], undefined>, Exclude<SpeciesVariantData['hp'], undefined>>, undefined>; readonly mods: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesVariantDataInput['mods'], undefined>, Exclude<SpeciesVariantData['mods'], undefined>>, undefined>; }, undefined>, undefined>; readonly spawnOnly: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['spawnOnly'], undefined>, Exclude<SpeciesData['spawnOnly'], undefined>>, undefined>; readonly aggressive: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['aggressive'], undefined>, Exclude<SpeciesData['aggressive'], undefined>>, undefined>; readonly walkSpeed: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['walkSpeed'], undefined>, Exclude<SpeciesData['walkSpeed'], undefined>>, undefined>; readonly chargeSpeed: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['chargeSpeed'], undefined>, Exclude<SpeciesData['chargeSpeed'], undefined>>, undefined>; readonly chargeDamage: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['chargeDamage'], undefined>, Exclude<SpeciesData['chargeDamage'], undefined>>, undefined>; readonly chargeWindup: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['chargeWindup'], undefined>, Exclude<SpeciesData['chargeWindup'], undefined>>, undefined>; readonly ringRadius: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['ringRadius'], undefined>, Exclude<SpeciesData['ringRadius'], undefined>>, undefined>; readonly trampleRadius: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['trampleRadius'], undefined>, Exclude<SpeciesData['trampleRadius'], undefined>>, undefined>; readonly tuning: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['tuning'], undefined>, Exclude<SpeciesData['tuning'], undefined>>, undefined>; readonly sounds: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['sounds'], undefined>, Exclude<SpeciesData['sounds'], undefined>>, undefined>; readonly tick: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['tick'], undefined>, Exclude<SpeciesData['tick'], undefined>>, undefined>; readonly corpseFade: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['corpseFade'], undefined>, Exclude<SpeciesData['corpseFade'], undefined>>, undefined>; readonly blood: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['blood'], undefined>, Exclude<SpeciesData['blood'], undefined>>, undefined>; readonly flight: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['flight'], undefined>, Exclude<SpeciesData['flight'], undefined>>, undefined>; readonly lockable: v.ExactOptionalSchema<v.GenericSchema<Exclude<SpeciesDataInput['lockable'], undefined>, Exclude<SpeciesData['lockable'], undefined>>, undefined>; }, undefined> = v.strictObject({
  id, kind: id, label: text, variants: v.pipe(v.array(variant), v.minLength(1), v.maxLength(64)),
  spawnOnly: v.exactOptional(v.pipe(v.array(variant), v.maxLength(64))), aggressive: v.exactOptional(v.boolean()),
  walkSpeed: v.exactOptional(nonnegative), chargeSpeed: v.exactOptional(nonnegative), chargeDamage: v.exactOptional(nonnegative),
  chargeWindup: v.exactOptional(nonnegative), ringRadius: v.exactOptional(nonnegative), trampleRadius: v.exactOptional(nonnegative),
  tuning: v.exactOptional(tuning), sounds: v.exactOptional(v.strictObject({ call: text, hurt: text,
    callVariants: v.exactOptional(v.pipe(v.array(text), v.maxLength(64))), callEvery: v.exactOptional(ordered) })),
  tick: v.exactOptional(v.picklist(['ai', 'always'])), corpseFade: v.exactOptional(nonnegative), blood: v.exactOptional(v.boolean()),
  flight: v.exactOptional(flight), lockable: v.exactOptional(v.boolean()),
});

/** Callback-free gameplay metadata; rendering and policy ownership are admitted separately. */

export function readSpecies(input: unknown): SpeciesData { return v.parse(SpeciesSchema, input); }
/** One existing SpeciesBrains owner receives these admitted policy/body rows and strike definitions. */
export const SpeciesProgramSchema: v.GenericSchema<SpeciesProgramDataInput, SpeciesProgramData> = v.pipe(v.unknown(), v.check(isJsonData, 'Species program must be plain JSON'), v.strictObject({
  species: v.pipe(v.array(v.strictObject({ ...SpeciesSchema.entries, brain: v.exactOptional(SpeciesBrainSchema),
    body: v.exactOptional(CreatureBodyRecipeSchema) })), v.maxLength(256)),
  strikes: v.pipe(v.array(CreatureStrikeSchema), v.maxLength(256)),
  modules: v.exactOptional(v.record(v.pipe(v.string(), v.minLength(1), v.maxLength(128)), v.pipe(v.string(), v.maxLength(400000)))),
}), v.check(value => new Set(value.species.map(row => row.kind)).size === value.species.length
  && new Set(value.strikes.map(row => row.id)).size === value.strikes.length, 'Unique program kinds and strikes'));

export function readSpeciesProgram(input: unknown): SpeciesProgramData { return v.parse(SpeciesProgramSchema, input); }

const names = v.pipe(v.array(id), v.maxLength(64));
const tag = v.custom<`${string}.${string}`>(value => typeof value === 'string' && value.length <= 128 && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value));
/** Settings for the existing native hunt and continuation owners; no callbacks or replacement clock. */
export const NativeHuntSchema: v.GenericSchema<NativeHuntRowsInput, NativeHuntRows> = v.strictObject({
  limit: v.pipe(positive, v.integer(), v.maxValue(1024)), player: v.picklist(['host', 'origin']),
  fight: v.strictObject({ telegraphed: v.exactOptional(v.boolean()), attackers: v.exactOptional(v.pipe(positive, v.integer(), v.maxValue(1024))),
    maxHitDamage: v.exactOptional(nonnegative), capExempt: v.exactOptional(names),
    input: v.exactOptional(v.strictObject({ bufferMs: nonnegative, coyoteMs: nonnegative })) }),
  tuning: v.exactOptional(v.record(id, optionalTuning)),
  bands: v.strictObject({ states: names, scripted: v.exactOptional(v.boolean()), legacyKinds: names }),
  hit: v.strictObject({ namespace: id, tags: v.pipe(v.array(tag), v.maxLength(32)) }), memoryFields: v.exactOptional(names),
});

/** Page and native registration order is authored explicitly; empty sides install no rows. */
export const SpeciesProgramsSchema: v.GenericSchema<SpeciesProgramsInput, SpeciesPrograms> = v.pipe(v.unknown(), v.check(isJsonData, 'Species programs must be plain JSON'),
  v.strictObject({ page: v.pipe(v.array(SpeciesSchema), v.maxLength(256)), native: v.pipe(v.array(SpeciesSchema), v.maxLength(256)), program: v.exactOptional(SpeciesProgramSchema),
    spawns: v.exactOptional(SpawnTablesSchema), hunt: v.exactOptional(NativeHuntSchema) }),
  v.check(value => [value.page, value.native].every(rows => new Set(rows.map(row => row.kind)).size === rows.length), 'Unique species kinds per owner'));

export function readSpeciesPrograms(input: unknown): SpeciesPrograms { return v.parse(SpeciesProgramsSchema, input); }

/** Validated species metadata independent of validator implementation types. */
export type SpeciesVariantDataInput = SpeciesVariantData;
export interface SpeciesVariantData { id: string; label: string; weight: number; rarity: 'common' | 'uncommon' | 'rare' | 'legendary'; scale: [number, number]; hp?: number; mods?: { speed?: number; chargeDist?: number; damageTaken?: number; chargeDamage?: number; relentless?: boolean; }; }
export interface SpeciesDataInput { id: string; kind: string; label: string; variants: (SpeciesVariantDataInput)[]; spawnOnly?: (SpeciesVariantDataInput)[]; aggressive?: boolean; walkSpeed?: number; chargeSpeed?: number; chargeDamage?: number; chargeWindup?: number; ringRadius?: number; trampleRadius?: number; tuning?: { hp: number; sightRange: number; sightRangeGraze: number; sightCone: number; hearStill: number; hearCrouch: number; hearWalk: number; hearSprint: number; noticeRate: number; forgetRate: number; alertAt: number; boltAt: number; freezeMin: number; freezeMax: number; relaxAfter: number; panicDist: number; runSpeed: number; trotSpeed: number; fleeMinTime: number; fleeUntil: number; fleeUntilMax: number; fleeMaxTime: number; lookBack: number; waryTime: number; waryBoost: number; herdAlertRadius: number; herdBoltDelayMin: number; herdBoltDelayMax: number; impactSpook: number; impactAlert: number; stalk?: { detect: number; speed: number; giveUp: number; rechargeCd: number; huffMin: number; huffMax: number; roar: string; fleeBelowHp: number; fleeChance: number; }; }; sounds?: { call: string; hurt: string; callVariants?: (string)[]; callEvery?: [number, number]; }; tick?: 'ai' | 'always'; corpseFade?: number; blood?: boolean; flight?: { altitude: number; above?: 'ground' | 'world'; climbRate: number; diveRate: number; lockRange?: number; bank?: number; }; lockable?: boolean; }
export interface SpeciesData { id: string; kind: string; label: string; variants: (SpeciesVariantData)[]; spawnOnly?: (SpeciesVariantData)[]; aggressive?: boolean; walkSpeed?: number; chargeSpeed?: number; chargeDamage?: number; chargeWindup?: number; ringRadius?: number; trampleRadius?: number; tuning?: { hp: number; sightRange: number; sightRangeGraze: number; sightCone: number; hearStill: number; hearCrouch: number; hearWalk: number; hearSprint: number; noticeRate: number; forgetRate: number; alertAt: number; boltAt: number; freezeMin: number; freezeMax: number; relaxAfter: number; panicDist: number; runSpeed: number; trotSpeed: number; fleeMinTime: number; fleeUntil: number; fleeUntilMax: number; fleeMaxTime: number; lookBack: number; waryTime: number; waryBoost: number; herdAlertRadius: number; herdBoltDelayMin: number; herdBoltDelayMax: number; impactSpook: number; impactAlert: number; stalk?: { detect: number; speed: number; giveUp: number; rechargeCd: number; huffMin: number; huffMax: number; roar: string; fleeBelowHp: number; fleeChance: number; }; }; sounds?: { call: string; hurt: string; callVariants?: (string)[]; callEvery?: [number, number]; }; tick?: 'ai' | 'always'; corpseFade?: number; blood?: boolean; flight?: { altitude: number; above?: 'ground' | 'world'; climbRate: number; diveRate: number; lockRange?: number; bank?: number; }; lockable?: boolean; }
export type SpeciesProgramDataInput = unknown;
export interface SpeciesProgramData { species: ({ brain?: v.InferOutput<typeof SpeciesBrainSchema>; body?: v.InferOutput<typeof CreatureBodyRecipeSchema>; } & SpeciesData)[]; strikes: (v.InferOutput<typeof CreatureStrikeSchema>)[]; modules?: Record<string, string>; }
export type NativeHuntRowsInput = NativeHuntRows;
export interface NativeHuntRows { limit: number; player: 'host' | 'origin'; fight: { telegraphed?: boolean; attackers?: number; maxHitDamage?: number; capExempt?: (string)[]; input?: { bufferMs: number; coyoteMs: number; }; }; tuning?: Record<string, { hp?: number; sightRange?: number; sightRangeGraze?: number; sightCone?: number; hearStill?: number; hearCrouch?: number; hearWalk?: number; hearSprint?: number; noticeRate?: number; forgetRate?: number; alertAt?: number; boltAt?: number; freezeMin?: number; freezeMax?: number; relaxAfter?: number; panicDist?: number; runSpeed?: number; trotSpeed?: number; fleeMinTime?: number; fleeUntil?: number; fleeUntilMax?: number; fleeMaxTime?: number; lookBack?: number; waryTime?: number; waryBoost?: number; herdAlertRadius?: number; herdBoltDelayMin?: number; herdBoltDelayMax?: number; impactSpook?: number; impactAlert?: number; stalk?: { detect: number; speed: number; giveUp: number; rechargeCd: number; huffMin: number; huffMax: number; roar: string; fleeBelowHp: number; fleeChance: number; }; }>; bands: { states: (string)[]; scripted?: boolean; legacyKinds: (string)[]; }; hit: { namespace: string; tags: (`${string}.${string}`)[]; }; memoryFields?: (string)[]; }
export type SpeciesProgramsInput = unknown;
export interface SpeciesPrograms { page: (SpeciesData)[]; native: (SpeciesData)[]; program?: SpeciesProgramData; spawns?: v.InferOutput<typeof SpawnTablesSchema>; hunt?: NativeHuntRows; }
