/** Build-only admission for existing encounter rows; play imports types only. */
import * as v from 'valibot';
import { ReturnProgramSchema } from './namedJsonContracts';
import { CreatureStrikeSchema } from './creatures';

const finite=v.pipe(v.number(),v.finite()),numbers=v.record(v.string(),finite);
const count=v.pipe(finite,v.integer(),v.minValue(1),v.maxValue(64));
const offset=v.pipe(finite,v.integer(),v.minValue(-1),v.maxValue(1)),numeric=numbers;
const pair=v.tuple([finite,finite]);
export const EncounterPatrolSchema = v.strictObject({
  parameters: numbers, member: numbers, group: numbers,
  actors: v.optional(v.strictObject({ kind: v.string(), variant: v.string(), leader: v.string(), count: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(8)),
    herd: finite, player: v.strictObject({ x: v.string(), z: v.string() }),
    target: v.strictObject({ x: v.string(), z: v.string() }), steering: v.record(v.string(), v.string()) })),
  signals: v.strictObject({ cycle: v.string(), empty: v.string(), dissolve: v.string(),
    member: v.string(), fire: v.string(), retry: v.string(), start: v.string(), slot: v.string(), group: v.string(), target: v.string() }),
});
export const EncounterSlotsSchema = v.strictObject({
  actors: v.optional(v.strictObject({ kind: v.string(), variant: v.string(), variants: v.record(v.string(), v.string()), herd: finite, yaw: finite, sink: finite,
    memory: numbers, home: v.strictObject({ x: v.string(), z: v.string(), yaw: v.string() }), dawn: v.string(), gone: v.string() })),
  release: v.string(),
  cycle: v.strictObject({ signal: v.string(), initial: numbers }),
  member: v.strictObject({ signal: v.string(), initial: numbers }),
  select: v.strictObject({ signal: v.string(), count: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(8)) }),
});
export const CoupledEncounterRowsSchema = v.strictObject({ initial: numbers, member: numbers, commit: numbers, parameters: numbers,
  actors: v.optional(v.strictObject({ hp: v.pipe(finite, v.minValue(1)), memory: v.record(v.string(), v.string()) })),
  signals: v.strictObject({ couple: v.string(), member: v.string(), damage: v.string() }) });
export const EncounterScheduleSchema = v.strictObject({ signal: v.string(), initial: numbers, parameters: numbers, retain: v.record(v.string(), v.string()) });
export const ArenaFieldSchema = v.strictObject({
  x: finite, z: finite, width: count, depth: count,
  cell: v.pipe(finite, v.minValue(.01)),
  observations: v.record(v.string(), finite),
  neighbours: v.pipe(v.array(v.tuple([offset, offset])), v.maxLength(8)),
  signals: v.strictObject({ ignite: v.string(), step: v.string(), clock: v.string() }),
  contact: v.optional(v.strictObject({ law: EncounterScheduleSchema,
    samples: v.pipe(v.array(v.strictObject({ x: finite, z: finite })), v.maxLength(8)) })),
});
const schedule = v.strictObject({ id: v.string(), law: EncounterScheduleSchema });
/** A bounded set of authored clocks. The AS gate chooses which clocks advance;
 * projections observe shared health/phase inputs and publish one-shot effects.
 * Landing slots borrow a position history; no view or shard callback is stored. */
export const ArenaEncounterSchema = v.strictObject({
  gate: v.strictObject({ signal: v.string(), parameters: numeric }),
  schedules: v.pipe(v.array(schedule), v.maxLength(16)),
  shared: v.record(v.string(), v.strictObject({ clock: v.string(), slot: v.string() })),
  volley: v.strictObject({ launcher: v.string(), capacity: v.pipe(count, v.maxValue(8)),
    landing: EncounterScheduleSchema, trail: v.strictObject({ initial:numbers,parameters:numbers,retain:v.record(v.string(),v.string()),signals:v.strictObject({step:v.string(),pick:v.string()}) }) }),
});
export const ArenaWhirlsSchema = v.strictObject({
 laws: v.pipe(v.array(EncounterScheduleSchema), v.minLength(1), v.maxLength(8)), ease: finite, spin: finite, sink: finite, breathe: pair,
 debris: v.strictObject({ count: v.pipe(count, v.maxValue(64)), climb: finite, turn: finite, step: finite, radius: pair, height: finite,
  axis: v.tuple([finite, finite, finite]), roll: finite, scale: v.tuple([finite, finite, v.pipe(count, v.maxValue(16))]) }),
});

const cue=v.pipe(v.string(),v.regex(/^cue\.[a-zA-Z0-9.-]+$/u)),name=v.pipe(v.string(),v.regex(/^[a-zA-Z][a-zA-Z0-9]*$/u));
const shader=v.pipe(v.string(),v.maxLength(4096)),vector=v.tuple([finite,finite,finite]);
const look=v.strictObject({key:v.pipe(v.string(),v.maxLength(64)),common:shader,fragment:shader});
const poolCount=v.pipe(finite,v.integer(),v.minValue(1),v.maxValue(65536));

export const SlotViewSchema = v.strictObject({
  cycle: v.strictObject({ wake: name, dawn: name }), states: v.strictObject({ broken: name, retire: name, home: name }),
  cues: v.strictObject({ wake: cue, hit: cue, weak: cue, hard: v.strictObject({ cue, drop: finite }), broken: cue, strike: cue }),
  lift: v.strictObject({ wake: finite, hit: finite, broken: finite, strike: finite }), strike: v.strictObject({ field: name, ahead: finite }),
  every: v.pipe(finite, v.minValue(0.01)),
  trails: v.pipe(v.array(v.strictObject({ cue, field: name, min: finite, max: finite, chance: v.pipe(finite, v.minValue(0), v.maxValue(1)),
    at: v.picklist(['ground', 'body']), lift: finite })), v.maxLength(8)),
  tell: v.strictObject({ pool: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)), cone: finite, reach: finite, wind: finite, strike: finite, hold: finite,
    alpha: v.tuple([finite, finite, finite]), colour: v.tuple([finite, finite, finite]), vertexShader: shader, fragmentShader: shader }),
});
export const PatrolViewSchema = v.strictObject({
  looks: v.record(name, look), quietLook: name, quietScale: v.pipe(finite, v.minValue(0.1)), figure: v.strictObject({ bone: name }), seat: vector,
  states: v.strictObject({ fade: name, dying: name, dead: name }),
  cues: v.strictObject({ form: cue, tear: cue, loose: cue, hurt: cue, impact: cue }), lift: v.strictObject({ form: finite, loose: finite }),
  trail: v.strictObject({ cue, rate: v.pipe(finite, v.minValue(0)), back: finite }), aim: name, damage: v.pipe(finite, v.minValue(0)),
  targets: v.pipe(v.array(v.strictObject({ at: vector, radius: v.pipe(finite, v.minValue(0)), head: v.boolean() })), v.maxLength(4)),
  arrow: v.strictObject({ geometry: v.unknown(), colour: vector, renderOrder: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(64)),
    length: finite, gravity: finite, drag: finite, windCoupling: finite, bury: finite, recover: finite,
    maxFlying: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(64)), maxStuck: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(64)),
    stick: v.boolean(), hitsAnimals: v.boolean(), puffs: v.boolean(), hurtsPlayer: v.strictObject({ radius: finite, height: finite }) }),
});
export const ArenaFireSchema = v.strictObject({
 flameLook: v.string(), smokeLook: v.string(), flameCount: poolCount,
 smokeCount: v.tuple([poolCount,poolCount]), smokeDetail: v.tuple([v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(3)),v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(3))]),
 front: pair, heat: pair, flameWidth: finite, life: pair, rise: pair, radius: pair, expansion: pair,
 /** a burning field's cells: `burn` s alight, flames `scatter` m off the centre, `sink` m into the ground, `size` tall,
  *  smoke puffs a second per cell [phone, desktop]; a burnt-out cell's scorch decal `jitter` m off, `lift` m up, `scale` ± */
 cells: v.exactOptional(v.strictObject({ burn: v.pipe(finite,v.minValue(.01)), scatter: finite, sink: finite, size: finite, smoke: pair,
   scorch: v.strictObject({ jitter: finite, lift: finite, scale: pair }) })),
});
/** Existing timed named file; unrelated source binding fields remain intact. */
export const TimedEncountersSchema = v.looseObject({ presentation: v.string(), program: ReturnProgramSchema, slots: EncounterSlotsSchema, view: SlotViewSchema,
  patrol: EncounterPatrolSchema, motion: EncounterScheduleSchema, ride: PatrolViewSchema, phases: v.strictObject({ slots: v.array(v.string()), patrol: v.array(v.string()) }),
  lightFloor: v.pipe(v.number(), v.finite(), v.minValue(0)),
  contact: v.strictObject({ strike: CreatureStrikeSchema, tags: v.array(CreatureStrikeSchema.entries.tags.pipe[0].item), origin: v.picklist(['actor', 'player']) }),
});

export type EncounterPatrolRows=v.InferOutput<typeof EncounterPatrolSchema>;
export type EncounterSlotsRows=v.InferOutput<typeof EncounterSlotsSchema>;
export type CoupledEncounterRows=v.InferOutput<typeof CoupledEncounterRowsSchema>;
export type ArenaFieldRows=v.InferOutput<typeof ArenaFieldSchema>;
export type ArenaEncounterRows=v.InferOutput<typeof ArenaEncounterSchema>;
export type ArenaWhirlsRows=v.InferOutput<typeof ArenaWhirlsSchema>;
export type TimedEncountersRows=v.InferOutput<typeof TimedEncountersSchema>;
export type EncounterScheduleRows=v.InferOutput<typeof EncounterScheduleSchema>;

export type SlotViewRows=v.InferOutput<typeof SlotViewSchema>;
export type PatrolViewRows=v.InferOutput<typeof PatrolViewSchema>;
export type ArenaFireRows=v.InferOutput<typeof ArenaFireSchema>;


const id=v.pipe(v.string(),v.minLength(1),v.maxLength(64)),triple=vector;
const hex=v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(0xffffff)),unit=v.pipe(finite,v.minValue(0),v.maxValue(1));
const puffRow=v.strictObject({bone:id,p:triple,r:finite,ph:finite,colour:triple});

export const EncounterMaterialSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('basic'), colour: triple, additive: v.boolean(), opacity: v.exactOptional(unit) }),
  v.strictObject({ kind: v.literal('fx'), mode: v.picklist(['shaft','flame','ring','stream','dome','beam','decal','curtain','streak']), colour: triple, alpha: finite, additive: v.exactOptional(v.boolean()) }),
  v.strictObject({ kind: v.literal('lambert'), colour: hex }),
  v.strictObject({ kind: v.literal('decal'), colour: hex, size: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256)), alpha: v.pipe(v.array(v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(255))), v.maxLength(65536)),
    opacity: unit, offset: finite }),
]);
export const CloudBodySchema = v.strictObject({
  scene: v.unknown(), geometry: v.record(id, v.unknown()), materials: v.record(id, EncounterMaterialSchema),
  poses: v.unknown(), group: id, root: id, scale: finite, shown: v.pipe(v.array(id), v.maxLength(16)),
  puffs: v.strictObject({ rows: v.pipe(v.array(puffRow), v.maxLength(4096)), bones: v.pipe(v.array(id), v.maxLength(32)), detail: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(4)),
    name: id, look: id, swell: pair, drift: triple, spin: finite, squash: finite }),
  params: v.strictObject({ time: id, focus: id, glow: id, flash: id, alpha: id, fogColour: id, fog: id }),
  focus: v.strictObject({ part: id, open: id, colour: v.tuple([triple, triple]), glow: id, glowAlpha: pair, lookGlow: pair, ring: id, spin: finite, pulse: triple, dome: id }),
  /** a lightning strip in `from`'s hand (`segments`, `colour`), re-jagged every `every` s: held `reach` m out along `back` → `from`
   *  ([jag, width] `held`) or struck to a point ([jag, width] `struck`) */
  strip: v.exactOptional(v.strictObject({ from: id, back: id, reach: finite, colour: triple, segments: v.pipe(finite, v.integer(), v.minValue(2), v.maxValue(64)),
    every: v.pipe(finite, v.minValue(0.01)), held: pair, struck: pair })),
});
export const ArenaSceneSchema = v.strictObject({
  scene: v.unknown(), geometry: v.record(id, v.unknown()), materials: v.record(id, EncounterMaterialSchema),
  wall: v.strictObject({ parts: v.pipe(v.array(id), v.maxLength(8)), spin: v.pipe(v.array(finite), v.maxLength(8)), at: pair, sink: finite, ease: finite }),
  /** ground tells by id: `count` rings or lanes in a self-lit `colour` */
  tells: v.record(id, v.strictObject({ kind: v.picklist(['ring', 'lane']), colour: triple, count: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(16)) })),
});
const cloudHeight=v.strictObject({heightAt:pair});
export const CloudSpecimenSchema=v.strictObject({name:id,phone:CloudBodySchema,desktop:CloudBodySchema,
 pose:v.record(id,finite),ports:v.record(id,v.record(id,v.union([finite,cloudHeight])))});
export type CloudBodyRows=v.InferOutput<typeof CloudBodySchema>;
export type ArenaSceneRows=v.InferOutput<typeof ArenaSceneSchema>;
export type EncounterMaterialRows=v.InferOutput<typeof EncounterMaterialSchema>;
export type CloudSpecimenRows=v.InferOutput<typeof CloudSpecimenSchema>;
