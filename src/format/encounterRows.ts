/** Build-only admission for existing encounter rows; play imports their types and the encounter sites' schema. */
import * as v from 'valibot';
import { ReturnProgramSchema } from './namedJsonContracts';
import { CreatureStrikeSchema } from './creatures';
import { SpecimenAssetSchema } from './specimenCatalogue';

const finite=v.pipe(v.number(),v.finite()),numbers=v.record(v.string(),finite);
const count=v.pipe(finite,v.integer(),v.minValue(1),v.maxValue(64));
const pair=v.tuple([finite,finite]);
/**
 * The sites a slot encounter wakes from (`name`'s statues): one instanced copy of the model's `variants[k]` at each
 * site (k: `variantCycle[i mod its length]`; `sink` × scale into the ground, leaning `tilt`), all wearing the `generated`
 * asset once it loads, and each its
 * own `collider` box piece (half width, half depth, top and bottom × scale; `label`, `surface`, from `file`) that stops
 * colliding while the site is awake.
 */
export const EncounterSitesSchema: v.GenericSchema<EncounterSitesRowsInput, EncounterSitesRows> = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)), label: v.string(), file: v.string(), surface: v.picklist(['stone', 'wood', 'metal', 'earth', 'ground']),
  variants: v.pipe(v.array(v.string()), v.minLength(1), v.maxLength(8)), variantCycle: v.pipe(v.array(v.pipe(finite, v.integer(), v.minValue(0))), v.minLength(1), v.maxLength(16)),
  sink: finite, generated: SpecimenAssetSchema,
  collider: v.strictObject({ hw: finite, hd: finite, top: finite, bottom: finite }),
  sites: v.pipe(v.array(v.strictObject({ x: finite, z: finite, yaw: finite, scale: finite, tilt: v.optional(finite, 0) })), v.maxLength(256)),
});
export const EncounterPatrolSchema: v.GenericSchema<EncounterPatrolRowsInput, EncounterPatrolRows> = v.strictObject({
  parameters: numbers, member: numbers, group: numbers,
  actors: v.optional(v.strictObject({ kind: v.string(), variant: v.string(), leader: v.string(), count: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(8)),
    herd: finite, player: v.strictObject({ x: v.string(), z: v.string() }),
    target: v.strictObject({ x: v.string(), z: v.string() }), steering: v.record(v.string(), v.string()) })),
  signals: v.strictObject({ cycle: v.string(), empty: v.string(), dissolve: v.string(),
    member: v.string(), fire: v.string(), retry: v.string(), start: v.string(), slot: v.string(), group: v.string(), target: v.string() }),
});
export const EncounterSlotsSchema: v.GenericSchema<EncounterSlotsRowsInput, EncounterSlotsRows> = v.strictObject({
  actors: v.optional(v.strictObject({ kind: v.string(), variant: v.string(), variants: v.record(v.string(), v.string()), herd: finite, yaw: finite, sink: finite,
    memory: numbers, home: v.strictObject({ x: v.string(), z: v.string(), yaw: v.string() }), dawn: v.string(), gone: v.string() })),
  release: v.string(),
  cycle: v.strictObject({ signal: v.string(), initial: numbers }),
  member: v.strictObject({ signal: v.string(), initial: numbers }),
  select: v.strictObject({ signal: v.string(), count: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(8)) }),
});
export const CoupledEncounterRowsSchema: v.GenericSchema<CoupledEncounterRowsInput, CoupledEncounterRows> = v.strictObject({ initial: numbers, member: numbers, commit: numbers, parameters: numbers,
  actors: v.optional(v.strictObject({ hp: v.pipe(finite, v.minValue(1)), memory: v.record(v.string(), v.string()) })),
  signals: v.strictObject({ couple: v.string(), member: v.string(), damage: v.string() }) });
export const EncounterScheduleSchema: v.StrictObjectSchema<{ readonly signal: v.GenericSchema<EncounterScheduleRowsInput['signal'], EncounterScheduleRows['signal']>; readonly initial: v.GenericSchema<EncounterScheduleRowsInput['initial'], EncounterScheduleRows['initial']>; readonly parameters: v.GenericSchema<EncounterScheduleRowsInput['parameters'], EncounterScheduleRows['parameters']>; readonly retain: v.GenericSchema<EncounterScheduleRowsInput['retain'], EncounterScheduleRows['retain']>; readonly outputs: v.ExactOptionalSchema<v.GenericSchema<Exclude<EncounterScheduleRowsInput['outputs'], undefined>, Exclude<EncounterScheduleRows['outputs'], undefined>>, undefined>; }, undefined> = v.strictObject({ signal: v.string(), initial: numbers, parameters: numbers, retain: v.record(v.string(), v.string()),
  outputs: v.exactOptional(v.pipe(v.array(v.pipe(v.string(),v.minLength(1),v.maxLength(512))),v.maxLength(128))) });
/** One admitted schedule owns attack selection and ordered numeric transitions;
 * projections observe shared health/phase inputs and publish one-shot effects.
 * Landing slots borrow a position history; no view or shard callback is stored. */
export const ArenaEncounterSchema: v.GenericSchema<ArenaEncounterRowsInput, ArenaEncounterRows> = v.strictObject({
  frame:v.strictObject({...v.omit(EncounterScheduleSchema,['signal']).entries,signals:v.strictObject({step:v.string()})}),
  count:v.string(),left:v.string(),spear:v.string(),clear:numbers,
  landings:v.pipe(v.array(v.strictObject({on:v.string(),t:v.string(),x:v.string(),z:v.string(),strike:v.string(),hurt:v.string()})),v.minLength(1),v.maxLength(8)),
});
const gateKey=v.pipe(v.string(),v.minLength(1),v.maxLength(512));
export const ArenaWhirlsSchema: v.GenericSchema<ArenaWhirlsRowsInput, ArenaWhirlsRows> = v.strictObject({
 view:v.strictObject({source:gateKey,slot:gateKey,draw:gateKey,
  slots:v.pipe(v.array(v.strictObject({object:gateKey,fields:v.strictObject({k:gateKey,shown:gateKey,x:gateKey,y:gateKey,z:gateKey})})),v.minLength(1),v.maxLength(8))}),
 gate:v.strictObject({law:EncounterScheduleSchema,arm:gateKey,
  slots:v.pipe(v.array(v.strictObject({weight:gateKey,armed:gateKey,shown:gateKey})),v.minLength(1),v.maxLength(8)),
  inputs:v.strictObject({delta:gateKey,live:gateKey,ease:gateKey,mask:gateKey,index:gateKey,count:gateKey})}),
 laws: v.pipe(v.array(EncounterScheduleSchema), v.minLength(1), v.maxLength(8)), ease: finite, spin: finite, sink: finite, breathe: pair,
 debris: v.strictObject({ count: v.pipe(count, v.maxValue(64)), climb: finite, turn: finite, step: finite, radius: pair, height: finite,
  axis: v.tuple([finite, finite, finite]), roll: finite, scale: v.tuple([finite, finite, v.pipe(count, v.maxValue(16))]) }),
});

const cue=v.pipe(v.string(),v.regex(/^cue\.[a-zA-Z0-9.-]+$/u)),name=v.pipe(v.string(),v.regex(/^[a-zA-Z][a-zA-Z0-9]*$/u));
const vector=v.tuple([finite,finite,finite]);
// a lent graph look's catalogue id (format/materialGraph's id pattern)
const lookId=v.pipe(v.string(),v.regex(/^[a-z][a-z0-9.-]{0,127}$/u));
const poolCount=v.pipe(finite,v.integer(),v.minValue(1),v.maxValue(65536));

export const SlotViewSchema: v.GenericSchema<SlotViewRowsInput, SlotViewRows> = v.strictObject({
  cycle: v.strictObject({ wake: name, dawn: name }), states: v.strictObject({ broken: name, retire: name, home: name }),
  cues: v.strictObject({ wake: cue, hit: cue, weak: cue, hard: v.strictObject({ cue, drop: finite }), broken: cue, strike: cue }),
  lift: v.strictObject({ wake: finite, hit: finite, broken: finite, strike: finite }), strike: v.strictObject({ field: name, ahead: finite }),
  every: v.pipe(finite, v.minValue(0.01)),
  trails: v.pipe(v.array(v.strictObject({ cue, field: name, min: finite, max: finite, chance: v.pipe(finite, v.minValue(0), v.maxValue(1)),
    at: v.picklist(['ground', 'body']), lift: finite })), v.maxLength(8)),
  tell: v.strictObject({ pool: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(8)), cone: finite, reach: finite, wind: finite, strike: finite, hold: finite,
    alpha: v.tuple([finite, finite, finite]),
    // the wedge's look: a lent graph look (float params `fill` and `alpha`), one copy per pooled wedge
    look: lookId }),
});
export const PatrolViewSchema: v.GenericSchema<PatrolViewRowsInput, PatrolViewRows> = v.strictObject({
  // each variant's look: a lent graph look (float param `fade`), one copy per rider material
  looks: v.record(name, lookId), quietLook: name, quietScale: v.pipe(finite, v.minValue(0.1)), figure: v.strictObject({ bone: name }), seat: vector,
  states: v.strictObject({ fade: name, dying: name, dead: name }),
  cues: v.strictObject({ form: cue, tear: cue, loose: cue, hurt: cue, impact: cue }), lift: v.strictObject({ form: finite, loose: finite }),
  trail: v.strictObject({ cue, rate: v.pipe(finite, v.minValue(0)), back: finite }), aim: name, damage: v.pipe(finite, v.minValue(0)),
  targets: v.pipe(v.array(v.strictObject({ at: vector, radius: v.pipe(finite, v.minValue(0)), head: v.boolean() })), v.maxLength(4)),
  arrow: v.strictObject({ geometry: v.unknown(), colour: vector, renderOrder: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(64)),
    length: finite, gravity: finite, drag: finite, windCoupling: finite, bury: finite, recover: finite,
    maxFlying: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(64)), maxStuck: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(64)),
    stick: v.boolean(), hitsAnimals: v.boolean(), puffs: v.boolean(), hurtsPlayer: v.strictObject({ radius: finite, height: finite }) }),
});
export const ArenaFireSchema: v.GenericSchema<ArenaFireRowsInput, ArenaFireRows> = v.strictObject({
 flameLook: v.string(), smokeLook: v.string(), flameCount: poolCount,
 smokeCount: v.tuple([poolCount,poolCount]), smokeDetail: v.tuple([v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(3)),v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(3))]),
 front: pair, heat: pair, flameWidth: finite, life: pair, rise: pair, radius: pair, expansion: pair,
 /** a burning field's cells: `burn` s alight, flames `scatter` m off the centre, `sink` m into the ground, `size` tall,
  *  smoke puffs a second per cell [phone, desktop]; a burnt-out cell's scorch decal `jitter` m off, `lift` m up, `scale` ± */
 cells: v.exactOptional(v.strictObject({ burn: v.pipe(finite,v.minValue(.01)), scatter: finite, sink: finite, size: finite, smoke: pair,
   scorch: v.strictObject({ jitter: finite, lift: finite, scale: pair }) })),
});
/** Existing timed named file; unrelated source binding fields remain intact. */
export const TimedEncountersSchema: v.GenericSchema<TimedEncountersRowsInput, TimedEncountersRows> = v.looseObject({ presentation: v.string(), program: ReturnProgramSchema, slots: EncounterSlotsSchema, view: SlotViewSchema,
  patrol: EncounterPatrolSchema, motion: EncounterScheduleSchema, ride: PatrolViewSchema, phases: v.strictObject({ slots: v.array(v.string()), patrol: v.array(v.string()) }),
  lightFloor: v.pipe(v.number(), v.finite(), v.minValue(0)),
  contact: v.strictObject({ strike: CreatureStrikeSchema, tags: v.array(CreatureStrikeSchema.entries.tags.pipe[0].item), origin: v.picklist(['actor', 'player']) }),
});














const id=v.pipe(v.string(),v.minLength(1),v.maxLength(64)),triple=vector;
const hex=v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(0xffffff)),unit=v.pipe(finite,v.minValue(0),v.maxValue(1));
const puffRow=v.strictObject({bone:id,p:triple,r:finite,ph:finite,colour:triple});

export const EncounterMaterialSchema: v.GenericSchema<EncounterMaterialRowsInput, EncounterMaterialRows> = v.variant('kind', [
  v.strictObject({ kind: v.literal('basic'), colour: triple, additive: v.boolean(), opacity: v.exactOptional(unit) }),
  v.strictObject({ kind: v.literal('fx'), mode: v.picklist(['shaft','flame','ring','stream','dome','beam','decal','curtain','streak']), colour: triple, alpha: finite, additive: v.exactOptional(v.boolean()) }),
  v.strictObject({ kind: v.literal('lambert'), colour: hex }),
  v.strictObject({ kind: v.literal('decal'), colour: hex, size: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256)), alpha: v.pipe(v.array(v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(255))), v.maxLength(65536)),
    opacity: unit, offset: finite }),
]);
export const CloudBodySchema: v.StrictObjectSchema<{ readonly scene: v.GenericSchema<CloudBodyRowsInput['scene'], CloudBodyRows['scene']>; readonly geometry: v.GenericSchema<CloudBodyRowsInput['geometry'], CloudBodyRows['geometry']>; readonly materials: v.GenericSchema<CloudBodyRowsInput['materials'], CloudBodyRows['materials']>; readonly poses: v.GenericSchema<CloudBodyRowsInput['poses'], CloudBodyRows['poses']>; readonly group: v.GenericSchema<CloudBodyRowsInput['group'], CloudBodyRows['group']>; readonly root: v.GenericSchema<CloudBodyRowsInput['root'], CloudBodyRows['root']>; readonly scale: v.GenericSchema<CloudBodyRowsInput['scale'], CloudBodyRows['scale']>; readonly shown: v.GenericSchema<CloudBodyRowsInput['shown'], CloudBodyRows['shown']>; readonly puffs: v.StrictObjectSchema<{ readonly rows: v.GenericSchema<CloudBodyRowsInput['puffs']['rows'], CloudBodyRows['puffs']['rows']>; readonly bones: v.GenericSchema<CloudBodyRowsInput['puffs']['bones'], CloudBodyRows['puffs']['bones']>; readonly detail: v.GenericSchema<CloudBodyRowsInput['puffs']['detail'], CloudBodyRows['puffs']['detail']>; readonly name: v.GenericSchema<CloudBodyRowsInput['puffs']['name'], CloudBodyRows['puffs']['name']>; readonly look: v.GenericSchema<CloudBodyRowsInput['puffs']['look'], CloudBodyRows['puffs']['look']>; readonly swell: v.GenericSchema<CloudBodyRowsInput['puffs']['swell'], CloudBodyRows['puffs']['swell']>; readonly drift: v.GenericSchema<CloudBodyRowsInput['puffs']['drift'], CloudBodyRows['puffs']['drift']>; readonly spin: v.GenericSchema<CloudBodyRowsInput['puffs']['spin'], CloudBodyRows['puffs']['spin']>; readonly squash: v.GenericSchema<CloudBodyRowsInput['puffs']['squash'], CloudBodyRows['puffs']['squash']>; }, undefined>; readonly params: v.GenericSchema<CloudBodyRowsInput['params'], CloudBodyRows['params']>; readonly focus: v.GenericSchema<CloudBodyRowsInput['focus'], CloudBodyRows['focus']>; readonly strip: v.ExactOptionalSchema<v.GenericSchema<Exclude<CloudBodyRowsInput['strip'], undefined>, Exclude<CloudBodyRows['strip'], undefined>>, undefined>; }, undefined> = v.strictObject({
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
export const ArenaSceneSchema: v.GenericSchema<ArenaSceneRowsInput, ArenaSceneRows> = v.strictObject({
  scene: v.unknown(), geometry: v.record(id, v.unknown()), materials: v.record(id, EncounterMaterialSchema),
  wall: v.strictObject({ parts: v.pipe(v.array(id), v.maxLength(8)), spin: v.pipe(v.array(finite), v.maxLength(8)), at: pair, sink: finite, ease: finite }),
  /** ground tells by id: `count` rings or lanes in a self-lit `colour` */
  tells: v.record(id, v.strictObject({ kind: v.picklist(['ring', 'lane']), colour: triple, count: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(16)) })),
});
const cloudHeight=v.strictObject({heightAt:pair});
export const CloudSpecimenSchema: v.GenericSchema<CloudSpecimenRowsInput, CloudSpecimenRows>=v.strictObject({name:id,phone:CloudBodySchema,desktop:CloudBodySchema,
 pose:v.record(id,finite),ports:v.record(id,v.record(id,v.union([finite,cloudHeight])))});





/** Admitted data contracts, independent of validator implementation metadata. */
interface EncounterSitesRowsInputFields {
    name: string;
    label: string;
    file: string;
    surface: 'stone' | 'wood' | 'metal' | 'earth' | 'ground';
    variants: (string)[];
    variantCycle: (number)[];
    sink: number;
    generated: v.InferInput<typeof SpecimenAssetSchema>;
    collider: {
        hw: number;
        hd: number;
        top: number;
        bottom: number;
    };
    sites: ({
        x: number;
        z: number;
        yaw: number;
        scale: number;
        tilt?: number | undefined;
    })[];
}
export type EncounterSitesRowsInput = { [Key in keyof EncounterSitesRowsInputFields]: EncounterSitesRowsInputFields[Key] };
interface EncounterSitesRowsFields {
    name: string;
    label: string;
    file: string;
    surface: 'stone' | 'wood' | 'metal' | 'earth' | 'ground';
    variants: (string)[];
    variantCycle: (number)[];
    sink: number;
    generated: v.InferOutput<typeof SpecimenAssetSchema>;
    collider: {
        hw: number;
        hd: number;
        top: number;
        bottom: number;
    };
    sites: ({
        x: number;
        z: number;
        yaw: number;
        scale: number;
        tilt: number;
    })[];
}
export type EncounterSitesRows = { [Key in keyof EncounterSitesRowsFields]: EncounterSitesRowsFields[Key] };
export type EncounterPatrolRowsInput = EncounterPatrolRows;
interface EncounterPatrolRowsFields {
    parameters: Record<string, number>;
    member: Record<string, number>;
    group: Record<string, number>;
    actors?: {
        kind: string;
        variant: string;
        leader: string;
        count: number;
        herd: number;
        player: {
            x: string;
            z: string;
        };
        target: {
            x: string;
            z: string;
        };
        steering: Record<string, string>;
    } | undefined;
    signals: {
        cycle: string;
        empty: string;
        dissolve: string;
        member: string;
        fire: string;
        retry: string;
        start: string;
        slot: string;
        group: string;
        target: string;
    };
}
export type EncounterPatrolRows = { [Key in keyof EncounterPatrolRowsFields]: EncounterPatrolRowsFields[Key] };
export type EncounterSlotsRowsInput = EncounterSlotsRows;
interface EncounterSlotsRowsFields {
    actors?: {
        kind: string;
        variant: string;
        variants: Record<string, string>;
        herd: number;
        yaw: number;
        sink: number;
        memory: Record<string, number>;
        home: {
            x: string;
            z: string;
            yaw: string;
        };
        dawn: string;
        gone: string;
    } | undefined;
    release: string;
    cycle: {
        signal: string;
        initial: Record<string, number>;
    };
    member: {
        signal: string;
        initial: Record<string, number>;
    };
    select: {
        signal: string;
        count: number;
    };
}
export type EncounterSlotsRows = { [Key in keyof EncounterSlotsRowsFields]: EncounterSlotsRowsFields[Key] };
export type CoupledEncounterRowsInput = CoupledEncounterRows;
interface CoupledEncounterRowsFields {
    initial: Record<string, number>;
    member: Record<string, number>;
    commit: Record<string, number>;
    parameters: Record<string, number>;
    actors?: {
        hp: number;
        memory: Record<string, string>;
    } | undefined;
    signals: {
        couple: string;
        member: string;
        damage: string;
    };
}
export type CoupledEncounterRows = { [Key in keyof CoupledEncounterRowsFields]: CoupledEncounterRowsFields[Key] };
export type EncounterScheduleRowsInput = EncounterScheduleRows;
interface EncounterScheduleRowsFields {
    signal: string;
    initial: Record<string, number>;
    parameters: Record<string, number>;
    retain: Record<string, string>;
    outputs?: (string)[];
}
export type EncounterScheduleRows = { [Key in keyof EncounterScheduleRowsFields]: EncounterScheduleRowsFields[Key] };
interface ArenaEncounterRowsInputFields {
    frame: {
        signals: {
            step: string;
        };
    } & Omit<EncounterScheduleRowsInput, 'signal'>;
    count: string;
    left: string;
    spear: string;
    clear: Record<string, number>;
    landings: ({
        on: string;
        t: string;
        x: string;
        z: string;
        strike: string;
        hurt: string;
    })[];
}
export type ArenaEncounterRowsInput = { [Key in keyof ArenaEncounterRowsInputFields]: ArenaEncounterRowsInputFields[Key] };
interface ArenaEncounterRowsFields {
    frame: {
        signals: {
            step: string;
        };
    } & Omit<EncounterScheduleRows, 'signal'>;
    count: string;
    left: string;
    spear: string;
    clear: Record<string, number>;
    landings: ({
        on: string;
        t: string;
        x: string;
        z: string;
        strike: string;
        hurt: string;
    })[];
}
export type ArenaEncounterRows = { [Key in keyof ArenaEncounterRowsFields]: ArenaEncounterRowsFields[Key] };
interface ArenaWhirlsRowsInputFields {
    view: {
        source: string;
        slot: string;
        draw: string;
        slots: ({
            object: string;
            fields: {
                k: string;
                shown: string;
                x: string;
                y: string;
                z: string;
            };
        })[];
    };
    gate: {
        law: EncounterScheduleRowsInput;
        arm: string;
        slots: ({
            weight: string;
            armed: string;
            shown: string;
        })[];
        inputs: {
            delta: string;
            live: string;
            ease: string;
            mask: string;
            index: string;
            count: string;
        };
    };
    laws: (EncounterScheduleRowsInput)[];
    ease: number;
    spin: number;
    sink: number;
    breathe: [
        number,
        number
    ];
    debris: {
        count: number;
        climb: number;
        turn: number;
        step: number;
        radius: [
            number,
            number
        ];
        height: number;
        axis: [
            number,
            number,
            number
        ];
        roll: number;
        scale: [
            number,
            number,
            number
        ];
    };
}
export type ArenaWhirlsRowsInput = { [Key in keyof ArenaWhirlsRowsInputFields]: ArenaWhirlsRowsInputFields[Key] };
interface ArenaWhirlsRowsFields {
    view: {
        source: string;
        slot: string;
        draw: string;
        slots: ({
            object: string;
            fields: {
                k: string;
                shown: string;
                x: string;
                y: string;
                z: string;
            };
        })[];
    };
    gate: {
        law: EncounterScheduleRows;
        arm: string;
        slots: ({
            weight: string;
            armed: string;
            shown: string;
        })[];
        inputs: {
            delta: string;
            live: string;
            ease: string;
            mask: string;
            index: string;
            count: string;
        };
    };
    laws: (EncounterScheduleRows)[];
    ease: number;
    spin: number;
    sink: number;
    breathe: [
        number,
        number
    ];
    debris: {
        count: number;
        climb: number;
        turn: number;
        step: number;
        radius: [
            number,
            number
        ];
        height: number;
        axis: [
            number,
            number,
            number
        ];
        roll: number;
        scale: [
            number,
            number,
            number
        ];
    };
}
export type ArenaWhirlsRows = { [Key in keyof ArenaWhirlsRowsFields]: ArenaWhirlsRowsFields[Key] };
export type SlotViewRowsInput = SlotViewRows;
interface SlotViewRowsFields {
    cycle: {
        wake: string;
        dawn: string;
    };
    states: {
        broken: string;
        retire: string;
        home: string;
    };
    cues: {
        wake: string;
        hit: string;
        weak: string;
        hard: {
            cue: string;
            drop: number;
        };
        broken: string;
        strike: string;
    };
    lift: {
        wake: number;
        hit: number;
        broken: number;
        strike: number;
    };
    strike: {
        field: string;
        ahead: number;
    };
    every: number;
    trails: ({
        cue: string;
        field: string;
        min: number;
        max: number;
        chance: number;
        at: 'ground' | 'body';
        lift: number;
    })[];
    tell: {
        pool: number;
        cone: number;
        reach: number;
        wind: number;
        strike: number;
        hold: number;
        alpha: [
            number,
            number,
            number
        ];
        look: string;
    };
}
export type SlotViewRows = { [Key in keyof SlotViewRowsFields]: SlotViewRowsFields[Key] };
export type PatrolViewRowsInput = PatrolViewRows;
interface PatrolViewRowsFields {
    looks: Record<string, string>;
    quietLook: string;
    quietScale: number;
    figure: {
        bone: string;
    };
    seat: [
        number,
        number,
        number
    ];
    states: {
        fade: string;
        dying: string;
        dead: string;
    };
    cues: {
        form: string;
        tear: string;
        loose: string;
        hurt: string;
        impact: string;
    };
    lift: {
        form: number;
        loose: number;
    };
    trail: {
        cue: string;
        rate: number;
        back: number;
    };
    aim: string;
    damage: number;
    targets: ({
        at: [
            number,
            number,
            number
        ];
        radius: number;
        head: boolean;
    })[];
    arrow: {
        geometry: unknown;
        colour: [
            number,
            number,
            number
        ];
        renderOrder: number;
        length: number;
        gravity: number;
        drag: number;
        windCoupling: number;
        bury: number;
        recover: number;
        maxFlying: number;
        maxStuck: number;
        stick: boolean;
        hitsAnimals: boolean;
        puffs: boolean;
        hurtsPlayer: {
            radius: number;
            height: number;
        };
    };
}
export type PatrolViewRows = { [Key in keyof PatrolViewRowsFields]: PatrolViewRowsFields[Key] };
export type ArenaFireRowsInput = ArenaFireRows;
interface ArenaFireRowsFields {
    flameLook: string;
    smokeLook: string;
    flameCount: number;
    smokeCount: [
        number,
        number
    ];
    smokeDetail: [
        number,
        number
    ];
    front: [
        number,
        number
    ];
    heat: [
        number,
        number
    ];
    flameWidth: number;
    life: [
        number,
        number
    ];
    rise: [
        number,
        number
    ];
    radius: [
        number,
        number
    ];
    expansion: [
        number,
        number
    ];
    cells?: {
        burn: number;
        scatter: number;
        sink: number;
        size: number;
        smoke: [
            number,
            number
        ];
        scorch: {
            jitter: number;
            lift: number;
            scale: [
                number,
                number
            ];
        };
    };
}
export type ArenaFireRows = { [Key in keyof ArenaFireRowsFields]: ArenaFireRowsFields[Key] };
export type TimedEncountersRowsInput = ({
    presentation: string;
    program: v.InferInput<typeof ReturnProgramSchema>;
    slots: EncounterSlotsRowsInput;
    view: SlotViewRowsInput;
    patrol: EncounterPatrolRowsInput;
    motion: EncounterScheduleRowsInput;
    ride: PatrolViewRowsInput;
    phases: {
        slots: (string)[];
        patrol: (string)[];
    };
    lightFloor: number;
    contact: {
        strike: v.InferInput<typeof CreatureStrikeSchema>;
        tags: (v.InferInput<(typeof CreatureStrikeSchema)['entries']['tags']['pipe'][0]['item']>)[];
        origin: 'actor' | 'player';
    };
}) & Record<string, unknown>;
export type TimedEncountersRows = ({
    presentation: string;
    program: v.InferOutput<typeof ReturnProgramSchema>;
    slots: EncounterSlotsRows;
    view: SlotViewRows;
    patrol: EncounterPatrolRows;
    motion: EncounterScheduleRows;
    ride: PatrolViewRows;
    phases: {
        slots: (string)[];
        patrol: (string)[];
    };
    lightFloor: number;
    contact: {
        strike: v.InferOutput<typeof CreatureStrikeSchema>;
        tags: (v.InferOutput<(typeof CreatureStrikeSchema)['entries']['tags']['pipe'][0]['item']>)[];
        origin: 'actor' | 'player';
    };
}) & Record<string, unknown>;
export type EncounterMaterialRowsInput = EncounterMaterialRows;
export type EncounterMaterialRows = ({
    kind: 'basic';
    colour: [
        number,
        number,
        number
    ];
    additive: boolean;
    opacity?: number;
}) | ({
    kind: 'fx';
    mode: 'shaft' | 'flame' | 'ring' | 'stream' | 'dome' | 'beam' | 'decal' | 'curtain' | 'streak';
    colour: [
        number,
        number,
        number
    ];
    alpha: number;
    additive?: boolean;
}) | ({
    kind: 'lambert';
    colour: number;
}) | ({
    kind: 'decal';
    colour: number;
    size: number;
    alpha: (number)[];
    opacity: number;
    offset: number;
});
interface CloudBodyRowsInputFields {
    scene: unknown;
    geometry: Record<string, unknown>;
    materials: Record<string, EncounterMaterialRowsInput>;
    poses: unknown;
    group: string;
    root: string;
    scale: number;
    shown: (string)[];
    puffs: {
        rows: ({
            bone: string;
            p: [
                number,
                number,
                number
            ];
            r: number;
            ph: number;
            colour: [
                number,
                number,
                number
            ];
        })[];
        bones: (string)[];
        detail: number;
        name: string;
        look: string;
        swell: [
            number,
            number
        ];
        drift: [
            number,
            number,
            number
        ];
        spin: number;
        squash: number;
    };
    params: {
        time: string;
        focus: string;
        glow: string;
        flash: string;
        alpha: string;
        fogColour: string;
        fog: string;
    };
    focus: {
        part: string;
        open: string;
        colour: [
            [
                number,
                number,
                number
            ],
            [
                number,
                number,
                number
            ]
        ];
        glow: string;
        glowAlpha: [
            number,
            number
        ];
        lookGlow: [
            number,
            number
        ];
        ring: string;
        spin: number;
        pulse: [
            number,
            number,
            number
        ];
        dome: string;
    };
    strip?: {
        from: string;
        back: string;
        reach: number;
        colour: [
            number,
            number,
            number
        ];
        segments: number;
        every: number;
        held: [
            number,
            number
        ];
        struck: [
            number,
            number
        ];
    };
}
export type CloudBodyRowsInput = { [Key in keyof CloudBodyRowsInputFields]: CloudBodyRowsInputFields[Key] };
interface CloudBodyRowsFields {
    scene: unknown;
    geometry: Record<string, unknown>;
    materials: Record<string, EncounterMaterialRows>;
    poses: unknown;
    group: string;
    root: string;
    scale: number;
    shown: (string)[];
    puffs: {
        rows: ({
            bone: string;
            p: [
                number,
                number,
                number
            ];
            r: number;
            ph: number;
            colour: [
                number,
                number,
                number
            ];
        })[];
        bones: (string)[];
        detail: number;
        name: string;
        look: string;
        swell: [
            number,
            number
        ];
        drift: [
            number,
            number,
            number
        ];
        spin: number;
        squash: number;
    };
    params: {
        time: string;
        focus: string;
        glow: string;
        flash: string;
        alpha: string;
        fogColour: string;
        fog: string;
    };
    focus: {
        part: string;
        open: string;
        colour: [
            [
                number,
                number,
                number
            ],
            [
                number,
                number,
                number
            ]
        ];
        glow: string;
        glowAlpha: [
            number,
            number
        ];
        lookGlow: [
            number,
            number
        ];
        ring: string;
        spin: number;
        pulse: [
            number,
            number,
            number
        ];
        dome: string;
    };
    strip?: {
        from: string;
        back: string;
        reach: number;
        colour: [
            number,
            number,
            number
        ];
        segments: number;
        every: number;
        held: [
            number,
            number
        ];
        struck: [
            number,
            number
        ];
    };
}
export type CloudBodyRows = { [Key in keyof CloudBodyRowsFields]: CloudBodyRowsFields[Key] };
interface ArenaSceneRowsInputFields {
    scene: unknown;
    geometry: Record<string, unknown>;
    materials: Record<string, EncounterMaterialRowsInput>;
    wall: {
        parts: (string)[];
        spin: (number)[];
        at: [
            number,
            number
        ];
        sink: number;
        ease: number;
    };
    tells: Record<string, {
        kind: 'ring' | 'lane';
        colour: [
            number,
            number,
            number
        ];
        count: number;
    }>;
}
export type ArenaSceneRowsInput = { [Key in keyof ArenaSceneRowsInputFields]: ArenaSceneRowsInputFields[Key] };
interface ArenaSceneRowsFields {
    scene: unknown;
    geometry: Record<string, unknown>;
    materials: Record<string, EncounterMaterialRows>;
    wall: {
        parts: (string)[];
        spin: (number)[];
        at: [
            number,
            number
        ];
        sink: number;
        ease: number;
    };
    tells: Record<string, {
        kind: 'ring' | 'lane';
        colour: [
            number,
            number,
            number
        ];
        count: number;
    }>;
}
export type ArenaSceneRows = { [Key in keyof ArenaSceneRowsFields]: ArenaSceneRowsFields[Key] };
interface CloudSpecimenRowsInputFields {
    name: string;
    phone: CloudBodyRowsInput;
    desktop: CloudBodyRowsInput;
    pose: Record<string, number>;
    ports: Record<string, Record<string, (number) | ({
        heightAt: [
            number,
            number
        ];
    })>>;
}
export type CloudSpecimenRowsInput = { [Key in keyof CloudSpecimenRowsInputFields]: CloudSpecimenRowsInputFields[Key] };
interface CloudSpecimenRowsFields {
    name: string;
    phone: CloudBodyRows;
    desktop: CloudBodyRows;
    pose: Record<string, number>;
    ports: Record<string, Record<string, (number) | ({
        heightAt: [
            number,
            number
        ];
    })>>;
}
export type CloudSpecimenRows = { [Key in keyof CloudSpecimenRowsFields]: CloudSpecimenRowsFields[Key] };
