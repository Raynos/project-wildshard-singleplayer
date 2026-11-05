import * as v from 'valibot';
import { isJsonData } from './json.ts';

/** The plan's logical name: a server-class file (J91), so it never reaches a client. */
export const NATIVE_ASSEMBLY_FILE = 'server/native-assembly.json';
/** The plan's defining schema, as `platformFileFamilies` and `serverBlob` name it. */
export const NATIVE_ASSEMBLY_SCHEMA = '@wildshard/format/nativeAssembly#NativeAssemblySchema';
/** The defining schema of a server JSON file a plan reads: rows the owning host admits. */
export const NATIVE_ASSEMBLY_DATA_SCHEMA = '@wildshard/format/nativeAssembly#NativeAssemblyDataSchema';

/** Where a plan input lives: a named product file (server class or not), a platform section, or inline. `path` walks into it. */
export type NativeAssemblyRead = { file: string; path?: string[] } | { section: string; path?: string[] } | { value: unknown };
/** One host's rows: what it reads and its data-only settings, in the install order the plan lists. */
export type NativeAssemblyFeature =
  | { host: 'decisions' | 'commands' | 'loadout' | 'quest.body-scripts' | 'population.elites-ready' | 'population.reactions' | 'population.settle' | 'riding.elites-ready' | 'water.field' }
  | { host: 'collision'; skipOnRestore?: boolean }
  | { host: 'day.keyed-sky' } | { host: 'day.toon'; start: number; cycle: number; phases: Record<string, string> } | { host: 'day.declared'; clock: NativeAssemblyRead }
  | { host: 'water.sea'; id: string } | { host: 'combat.motion'; speed: number }
  | { host: 'item.ranged'; kind: 'bolt' | 'cycle' | 'bow'; weapon: string } | { host: 'item.swept'; policy: NativeAssemblyRead }
  | { host: 'ammunition'; step: string; refill: string } | { host: 'boss.ground'; encounter: NativeAssemblyRead; binding: unknown }
  | { host: 'quest.composition'; rows: NativeAssemblyRead; spots: NativeAssemblyRead; counters: NativeAssemblyRead; document?: NativeAssemblyRead; table?: NativeAssemblyRead;
    contracts?: NativeAssemblyRead; props?: NativeAssemblyRead; readSpots?: boolean; nativeFeats?: boolean; barter?: boolean; director?: boolean; restoring?: boolean }
  | { host: 'quest.chapter'; id: string; rows: NativeAssemblyRead; wake: NativeAssemblyRead; reward: unknown; population: string }
  | { host: 'quest.kill-steps'; rows: NativeAssemblyRead; counters: NativeAssemblyRead }
  | { host: 'weather.program'; program: NativeAssemblyRead } | { host: 'weather.native'; program: NativeAssemblyRead; shelters: NativeAssemblyRead; rows: NativeAssemblyRead }
  | { host: 'population.environment' | 'population.shelter' | 'population.roster' | 'riding.groups'; rows: NativeAssemblyRead }
  | { host: 'population.elites'; file: string }
  | { host: 'population.spawn-script'; id: string } | { host: 'population.poses'; step: string }
  | { host: 'population.mixed'; rows: NativeAssemblyRead; perch: NativeAssemblyRead; keeper: NativeAssemblyRead; placement: NativeAssemblyRead; launch: string; sea: string }
  | { host: 'riding.roster' } | { host: 'riding.trample'; id: string; radius: number; strength: number; speedLimit: number }
  | { host: 'riding.environment'; wind: { x: number; z: number; strength: number }; flatten: number }
  | { host: 'riding.elites'; rows: NativeAssemblyRead; strikes: NativeAssemblyRead; conditions: NativeEliteConditions; projected: number }
  | { host: 'riding.hunt'; config: NativeAssemblyRead } | { host: 'riding.mounted'; profile: NativeAssemblyRead }
  | { host: 'riding.taming'; rows: NativeAssemblyRead; poses: NativeAssemblyRead; pose: NativeAssemblyRead };
/** How an elite row's condition word maps to its programme's inputs. */
export interface NativeEliteConditions { rules: Record<string, { rule: number; phase: boolean; storm: boolean }>; phases: Record<string, number>; storm: { calm: number; storm: number } }
/** The native bake: its rows, reader settings and binary blocks, and what joins the read. */
export interface NativeAssemblyBake {
  rows: NativeAssemblyRead; reader: { label: string; resolution: number; size: number } & Record<string, unknown>; ground: string; colliders: string[];
  /** `bake`: the reader's own bake. `solids`: its ground and solids, with `keep` carried over from the rows. */
  read: 'bake' | 'solids'; keep?: string[];
  /** Fields joined to the bake, all of them or only `pick`. */
  owners?: NativeAssemblyRead; pick?: string[];
  /** The arena room whose seal starts with its retained activity. */
  seal?: NativeAssemblyRead;
}
/**
 * `kind: 'native-assembly'`, the general native runtime plan (P1-E3.1b, J90), beside `sim/runtime-plan`'s `held-melee`.
 * A server loads the shardfile unchanged (G453): a shard with a native world lists its platform hosts here as data, in
 * install order, and each host reads its rows from the product. It holds no module URL, callback or shard branch.
 * It ships as the server-class file `NATIVE_ASSEMBLY_FILE`, not a section, because a client reads every section.
 */
export interface NativeAssemblyPlan {
  kind: 'native-assembly';
  level: { speed: number; authorCap?: boolean; ground: { size: number; height: number } };
  terrain: { kind: 'baked'; file: string; rows: unknown } | { kind: 'shard-tile'; resolution: number; size: number } | { kind: 'bake-ground' };
  /** `shard`: the shard's declared navigation asset; otherwise the named file. */
  navigation: 'shard' | { file: string };
  bake: NativeAssemblyBake;
  collision: { resolution: number; provenance?: unknown };
  entries: { walk: unknown; fresh?: { omit: string[] } };
  /** A native riding world's admitted boot rows. */
  boot?: NativeAssemblyRead;
  /** A native riding world's field and its named masks. */
  field?: { rows: NativeAssemblyRead; pond: string };
  features: NativeAssemblyFeature[];
}

const number = v.pipe(v.number(), v.finite());
const key = v.pipe(v.string(), v.minLength(1), v.maxLength(240));
const path = v.pipe(v.array(key), v.maxLength(16));
const read: v.GenericSchema<unknown, NativeAssemblyRead> = v.union([v.strictObject({ file: key, path: v.exactOptional(path) }), v.strictObject({ section: key, path: v.exactOptional(path) }), v.strictObject({ value: v.unknown() })]);
const flag = v.exactOptional(v.boolean());
const conditions = v.strictObject({ rules: v.record(key, v.strictObject({ rule: number, phase: v.boolean(), storm: v.boolean() })), phases: v.record(key, number), storm: v.strictObject({ calm: number, storm: number }) });
const feature = v.variant('host', [
  v.strictObject({ host: v.picklist(['decisions', 'commands', 'loadout', 'quest.body-scripts', 'population.elites-ready', 'population.reactions', 'population.settle', 'riding.elites-ready', 'water.field']) }),
  v.strictObject({ host: v.literal('collision'), skipOnRestore: flag }),
  v.strictObject({ host: v.literal('day.keyed-sky') }), v.strictObject({ host: v.literal('day.toon'), start: number, cycle: number, phases: v.record(key, key) }), v.strictObject({ host: v.literal('day.declared'), clock: read }),
  v.strictObject({ host: v.literal('water.sea'), id: key }), v.strictObject({ host: v.literal('combat.motion'), speed: number }),
  v.strictObject({ host: v.literal('item.ranged'), kind: v.picklist(['bolt', 'cycle', 'bow']), weapon: key }), v.strictObject({ host: v.literal('item.swept'), policy: read }),
  v.strictObject({ host: v.literal('ammunition'), step: key, refill: key }), v.strictObject({ host: v.literal('boss.ground'), encounter: read, binding: v.unknown() }),
  v.strictObject({ host: v.literal('quest.composition'), rows: read, spots: read, counters: read, document: v.exactOptional(read), table: v.exactOptional(read), contracts: v.exactOptional(read), props: v.exactOptional(read),
    readSpots: flag, nativeFeats: flag, barter: flag, director: flag, restoring: flag }),
  v.strictObject({ host: v.literal('quest.chapter'), id: key, rows: read, wake: read, reward: v.unknown(), population: key }),
  v.strictObject({ host: v.literal('quest.kill-steps'), rows: read, counters: read }),
  v.strictObject({ host: v.literal('weather.program'), program: read }), v.strictObject({ host: v.literal('weather.native'), program: read, shelters: read, rows: read }),
  v.strictObject({ host: v.picklist(['population.environment', 'population.shelter', 'population.roster', 'riding.groups']), rows: read }),
  v.strictObject({ host: v.literal('population.elites'), file: key }),
  v.strictObject({ host: v.literal('population.spawn-script'), id: key }), v.strictObject({ host: v.literal('population.poses'), step: key }),
  v.strictObject({ host: v.literal('population.mixed'), rows: read, perch: read, keeper: read, placement: read, launch: key, sea: key }),
  v.strictObject({ host: v.literal('riding.roster') }), v.strictObject({ host: v.literal('riding.trample'), id: key, radius: number, strength: number, speedLimit: number }),
  v.strictObject({ host: v.literal('riding.environment'), wind: v.strictObject({ x: number, z: number, strength: number }), flatten: number }),
  v.strictObject({ host: v.literal('riding.elites'), rows: read, strikes: read, conditions, projected: number }),
  v.strictObject({ host: v.literal('riding.hunt'), config: read }), v.strictObject({ host: v.literal('riding.mounted'), profile: read }),
  v.strictObject({ host: v.literal('riding.taming'), rows: read, poses: read, pose: read }),
]);
/** Admit the plan as plain bounded JSON. Each host still admits its own rows when it installs them. */
export const NativeAssemblySchema: v.GenericSchema<unknown, NativeAssemblyPlan> = v.pipe(v.unknown(), v.check(isJsonData, 'Native assembly must be plain bounded JSON'), v.strictObject({
  kind: v.literal('native-assembly'),
  level: v.strictObject({ speed: number, authorCap: flag, ground: v.strictObject({ size: number, height: number }) }),
  terrain: v.variant('kind', [v.strictObject({ kind: v.literal('baked'), file: key, rows: v.unknown() }), v.strictObject({ kind: v.literal('shard-tile'), resolution: number, size: number }), v.strictObject({ kind: v.literal('bake-ground') })]),
  navigation: v.union([v.literal('shard'), v.strictObject({ file: key })]),
  bake: v.strictObject({ rows: read, reader: v.looseObject({ label: key, resolution: number, size: number }), ground: key, colliders: v.pipe(v.array(key), v.maxLength(16)), read: v.picklist(['bake', 'solids']),
    keep: v.exactOptional(v.pipe(v.array(key), v.maxLength(16))), owners: v.exactOptional(read), pick: v.exactOptional(v.pipe(v.array(key), v.maxLength(16))), seal: v.exactOptional(read) }),
  collision: v.strictObject({ resolution: number, provenance: v.exactOptional(v.unknown()) }),
  entries: v.strictObject({ walk: v.unknown(), fresh: v.exactOptional(v.strictObject({ omit: v.pipe(v.array(key), v.maxLength(16)) })) }),
  boot: v.exactOptional(read), field: v.exactOptional(v.strictObject({ rows: read, pond: key })),
  features: v.pipe(v.array(feature), v.minLength(1), v.maxLength(64)),
}));
/** A server JSON file's rows: plain bounded data, admitted by the host that reads them. */
export const NativeAssemblyDataSchema: v.GenericSchema<unknown, unknown> = v.pipe(v.unknown(), v.check(isJsonData, 'Native assembly data must be plain bounded JSON'));
/** No module URL, callback, fallback or independent simulation owner is admitted. */
export function parseNativeAssembly(input: unknown): NativeAssemblyPlan { return v.parse(NativeAssemblySchema, input); }
