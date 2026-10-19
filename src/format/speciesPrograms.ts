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
export const SpeciesSchema = v.strictObject({
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
export type SpeciesData = v.InferOutput<typeof SpeciesSchema>;
export function readSpecies(input: unknown): SpeciesData { return v.parse(SpeciesSchema, input); }
/** One existing SpeciesBrains owner receives these admitted policy/body rows and strike definitions. */
export const SpeciesProgramSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Species program must be plain JSON'), v.strictObject({
  species: v.pipe(v.array(v.strictObject({ ...SpeciesSchema.entries, brain: v.exactOptional(SpeciesBrainSchema),
    body: v.exactOptional(CreatureBodyRecipeSchema) })), v.maxLength(256)),
  strikes: v.pipe(v.array(CreatureStrikeSchema), v.maxLength(256)),
  modules: v.exactOptional(v.record(v.pipe(v.string(), v.minLength(1), v.maxLength(128)), v.pipe(v.string(), v.maxLength(400000)))),
}), v.check(value => new Set(value.species.map(row => row.kind)).size === value.species.length
  && new Set(value.strikes.map(row => row.id)).size === value.strikes.length, 'Unique program kinds and strikes'));
export type SpeciesProgramData = v.InferOutput<typeof SpeciesProgramSchema>;
export function readSpeciesProgram(input: unknown): SpeciesProgramData { return v.parse(SpeciesProgramSchema, input); }

const names = v.pipe(v.array(id), v.maxLength(64));
const tag = v.custom<`${string}.${string}`>(value => typeof value === 'string' && value.length <= 128 && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/u.test(value));
/** Settings for the existing native hunt and continuation owners; no callbacks or replacement clock. */
export const NativeHuntSchema = v.strictObject({
  limit: v.pipe(positive, v.integer(), v.maxValue(1024)), player: v.picklist(['host', 'origin']),
  fight: v.strictObject({ telegraphed: v.exactOptional(v.boolean()), attackers: v.exactOptional(v.pipe(positive, v.integer(), v.maxValue(1024))),
    maxHitDamage: v.exactOptional(nonnegative), capExempt: v.exactOptional(names),
    input: v.exactOptional(v.strictObject({ bufferMs: nonnegative, coyoteMs: nonnegative })) }),
  tuning: v.exactOptional(v.record(id, optionalTuning)),
  bands: v.strictObject({ states: names, scripted: v.exactOptional(v.boolean()), legacyKinds: names }),
  hit: v.strictObject({ namespace: id, tags: v.pipe(v.array(tag), v.maxLength(32)) }), memoryFields: v.exactOptional(names),
});

/** Page and native registration order is authored explicitly; empty sides install no rows. */
export const SpeciesProgramsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Species programs must be plain JSON'),
  v.strictObject({ page: v.pipe(v.array(SpeciesSchema), v.maxLength(256)), native: v.pipe(v.array(SpeciesSchema), v.maxLength(256)), program: v.exactOptional(SpeciesProgramSchema),
    spawns: v.exactOptional(SpawnTablesSchema), hunt: v.exactOptional(NativeHuntSchema) }),
  v.check(value => [value.page, value.native].every(rows => new Set(rows.map(row => row.kind)).size === rows.length), 'Unique species kinds per owner'));
export type SpeciesPrograms = v.InferOutput<typeof SpeciesProgramsSchema>;
export function readSpeciesPrograms(input: unknown): SpeciesPrograms { return v.parse(SpeciesProgramsSchema, input); }
