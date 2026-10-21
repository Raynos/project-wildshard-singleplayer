import * as v from 'valibot';
import { BossEncounterDefinitionSchema,BossEncounterPresentationSchema } from './bossEncounter';
import { ReturnProgramSchema } from './namedJsonContracts';
import { CreatureStrikeSchema } from './creatures';
import { ArenaEncounterSchema,ArenaFieldSchema,CoupledEncounterRowsSchema,ArenaWhirlsSchema,ArenaFireSchema,CloudBodySchema,ArenaSceneSchema } from './encounterRows';

/** Build-only validation; runtime readers import the inferred types only. */
const arenaNumber=v.pipe(v.number(),v.finite(),v.minValue(-1e6),v.maxValue(1e6));
const arenaKey=v.pipe(v.string(),v.minLength(1),v.maxLength(512));
/** The boss host owns retained values and cadence; an admitted AS module owns
 * lifecycle, phase, damage and boundary policy. No authored ports are lent. */
export const ArenaScriptBossProfileSchema = v.strictObject({
  kind: v.literal('boss'), pattern: v.literal('arena-script'), fight: v.strictObject({
    initial: v.pipe(v.record(arenaKey, arenaNumber), v.maxEntries(32)),
    parameters: v.pipe(v.record(arenaKey, arenaNumber), v.maxEntries(32)),
    signals: v.pipe(v.record(arenaKey, arenaKey), v.maxEntries(16)),
    retain: v.pipe(v.record(arenaKey, arenaKey), v.maxEntries(32)),
  }),
});

const finite = v.pipe(v.number(),v.finite()), label = v.pipe(v.string(),v.minLength(1));
const point = v.strictObject({ x: finite,z: finite });
const pose = v.strictObject({ rise: finite,bend: finite,kneel: finite,raise: finite,castL: finite,stride: finite,heartOpen: finite });
const tuning = v.strictObject({ spearDamage: finite,spearRadius: finite,spearAim: finite,spearLock: finite,spearStuck: finite,
  whirlDamage: finite,whirlRadius: finite,riderHp: finite,riderChip: finite,chargeDamage: finite,laneSeconds: finite,flankSeconds: finite,stunSeconds: finite,
  cell: finite,burnSeconds: finite,fireDps: finite,maxFlames: finite,chainDamage: finite,chainRadius: finite,chainLand: finite,fullDraw: finite,fullDrawMul: finite });
const lines = v.strictObject({ kneels: label,grassFire: label,immuneDome: label,immuneSpear: label,spearStuck: label,riderBreaks: label,lastRider: label,
  burning: label,chain: label,wall: label,tie: label,tieOnFoot: label,tieQuiet: label,wantsRider: label,quiet: label,wakes: label,spear: label,charge: label,whirl: label });
/** Declared resources and effect bindings for an AS arena script. Named-file
 * admission checks bounded field, support and clock rows before allocation. */
export const ArenaScriptRowsSchema = v.strictObject({
  script: ArenaScriptBossProfileSchema,clocks: ArenaEncounterSchema,field: ArenaFieldSchema,support: CoupledEncounterRowsSchema,whirls: ArenaWhirlsSchema,arenaFire: ArenaFireSchema,
  programs: v.strictObject({ attack: ReturnProgramSchema,fire: ReturnProgramSchema,wind: ReturnProgramSchema,rules: ReturnProgramSchema }),
  supportSites: v.pipe(v.array(v.strictObject({ x: finite,z: finite,theta: finite })),v.maxLength(8)),
  arena: v.strictObject({ center: point,body: point,anchor: point,ground: point }),place: v.strictObject({ arenaRadius: finite,heartHp: finite }),
  phases: v.pipe(v.array(v.strictObject({ at: finite,caption: v.string(),name: label })),v.maxLength(16)),
  definition: BossEncounterDefinitionSchema,reward: BossEncounterPresentationSchema.entries.reward,
  skin: v.strictObject({ id: label,toast: label }),lines,tuning,boundary: v.strictObject({ x: finite,z: finite,radius: finite }),
  phaseLines: v.array(v.string()),tieLines: v.array(v.string()),immuneLines: v.array(v.string()),seeds: v.pipe(v.array(point),v.maxLength(16)),
  pose,contacts: v.record(label,CreatureStrikeSchema),whole: v.pipe(v.array(label),v.maxLength(8)),
  view: v.strictObject({ group: label,dome: label,bodyRoot: label,quietVariant: label,remaining: label,debug: label,
    notice: finite,promptLift: finite,wallDamage: finite,target: v.strictObject({ damage: finite,open: finite,closed: finite,range: finite }),
    light: v.strictObject({ colour: finite,y: finite }),
    reward: v.strictObject({ distance: finite,lift: finite }),respawn: v.strictObject({ distance: finite,yaw: finite,steed: finite }),
    introBolt: point }),
  weather: v.strictObject({ strike: label,clearing: label,storm: label }),record: v.strictObject({ kind: label,variant: label }),
});
export type ArenaScriptRows = v.InferOutput<typeof ArenaScriptRowsSchema>;
const tier = v.strictObject({ flames: v.unknown(),puffs: CloudBodySchema.entries.puffs.entries.rows });
export const ArenaScriptGeometrySchema = v.object({ body: v.looseObject({ ...v.omit(CloudBodySchema,['poses','puffs']).entries,puffs: v.omit(CloudBodySchema.entries.puffs,['rows']) }),
  eyes: v.unknown(),poses: v.unknown(),phone: tier,desktop: tier,arena: ArenaSceneSchema });
export type ArenaScriptData = ArenaScriptRows & { geometry: v.InferOutput<typeof ArenaScriptGeometrySchema> };
/** The original named fight file retains its other encounter rows. */
export const ArenaScriptFightFileSchema=v.looseObject({
  arenaScript:v.omit(ArenaScriptRowsSchema,['programs','arenaFire']),
  programs:ArenaScriptRowsSchema.entries.programs,arenaFire:ArenaFireSchema,
});
export type ArenaScriptFightFile=v.InferOutput<typeof ArenaScriptFightFileSchema>;
/** Build and focused scenario readers use the same defining schemas. */
export function parseArenaScriptData(input:unknown,geometry:unknown):ArenaScriptData {
  const root=v.parse(ArenaScriptFightFileSchema,input);
  return {...root.arenaScript,programs:root.programs,arenaFire:root.arenaFire,geometry:v.parse(ArenaScriptGeometrySchema,geometry)};
}
