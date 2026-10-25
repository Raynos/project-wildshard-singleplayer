import * as v from 'valibot';
import { SpecimenCatalogueSchema } from './specimenCatalogue';
import { ReturnProgramSchema } from './namedJsonContracts';
import { isJsonData } from './json';
import { HandleIdSchema, ObservationRefSchema } from './sceneRefs';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const names = v.pipe(v.array(name), v.maxLength(128));
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });
const toast = v.strictObject({ kind: v.literal('toast'), when: v.exactOptional(ObservationRefSchema), text: v.pipe(v.string(), v.maxLength(4096)),
  progress: v.exactOptional(v.strictObject({ flags: names, complete: v.pipe(v.string(), v.maxLength(4096)) })),
  counter: v.exactOptional(v.strictObject({ prefix: name, of: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(8192)) })) });
const sting = v.strictObject({ kind: v.literal('sting'), name: v.picklist(['pickup', 'death', 'chunk', 'dawn']) });
/** Client presentation addresses published resources and native services by identity.
 * Page actions and quest steps share these effect kinds and the same dispatcher. */
export const QuestSceneEffectSchema: v.GenericSchema<QuestSceneEffectRowsInput, QuestSceneEffectRows> = v.variant('kind', [
  v.strictObject({ kind: v.literal('label'), prompt: name, text: v.pipe(v.string(), v.maxLength(4096)) }),
  v.strictObject({ kind: v.literal('visible'), part: HandleIdSchema, value: v.boolean() }),
  v.strictObject({ kind: v.literal('light'), part: HandleIdSchema, intensity: v.pipe(finite, v.minValue(0)) }),
  v.strictObject({ kind: v.literal('mover'), id: name, command: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(3)) }),
  v.strictObject({ kind: v.literal('emitter'), target: name, value: v.boolean() }),
  v.strictObject({ kind: v.literal('mark'), target: name, value: v.boolean() }),
]);
/** Effects the concrete quest owners commit directly, in authored order. */
export const QuestCommitEffectSchema: v.GenericSchema<QuestCommitEffectRowsInput, QuestCommitEffectRows> = v.variant('kind', [
  toast, sting,
  v.strictObject({ kind: v.literal('reading'), title: v.pipe(v.string(), v.maxLength(512)),
    lines: v.pipe(v.array(v.pipe(v.string(), v.maxLength(8192))), v.maxLength(128)) }),
  v.strictObject({ kind: v.literal('flag'), flag: name, value: v.exactOptional(v.boolean()) }),
  v.strictObject({ kind: v.literal('item'), item: name, count: v.pipe(finite, v.safeInteger(), v.minValue(1)) }),
]);
/** Ordered effects, admitted identically for page actions and quest step rows. */
export const QuestEffectSchema: v.GenericSchema<QuestEffectInput, QuestEffect> = v.union([QuestSceneEffectSchema, QuestCommitEffectSchema, v.variant('kind', [
  v.strictObject({ kind: v.literal('command'), script: name, type: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(2147483647)),
    target: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(2147483647)), value: finite }),
  v.strictObject({ kind: v.literal('notice'), text: v.pipe(v.string(), v.maxLength(2048)) }),
])]);

const base = { id: name, when: v.exactOptional(condition), once: v.exactOptional(name),
  effects: v.pipe(v.array(QuestEffectSchema), v.minLength(1), v.maxLength(32)) };
const signal = v.strictObject({ ...base, kind: v.picklist(['talk', 'kill', 'collect', 'lead', 'follow', 'interact']), target: v.exactOptional(name) });
const step = v.union([signal,
  v.strictObject({ ...base, kind: v.literal('deliver'), target: name, item: name, count: v.pipe(finite, v.safeInteger(), v.minValue(1)) }),
  v.strictObject({ ...base, kind: v.literal('go-to'), at: v.strictObject({ x: finite, z: finite }), radius: v.pipe(finite, v.minValue(0.001)) }),
  v.strictObject({ ...base, kind: v.literal('wait'), seconds: v.pipe(finite, v.minValue(0), v.maxValue(86400)) }),
]);
const guard = v.strictObject({ id: name, actor: name, message: name, absentUnless: v.exactOptional(name) });
export const QuestStepRowsSchema: v.StrictObjectSchema<{
 readonly version: v.GenericSchema<1>;
 readonly steps: v.GenericSchema<QuestStepRowsInput['steps'], QuestStepRows['steps']>;
 readonly guards: v.ArraySchema<v.GenericSchema<QuestStepRowsInput['guards'][number], QuestStepRows['guards'][number]>, undefined>;
}, undefined> = v.strictObject({ version: v.literal(1), steps: v.pipe(v.array(step), v.maxLength(256)), guards: v.pipe(v.array(guard), v.maxLength(64)) });
/** Quest signals come from existing dialogue, inventory, actors and traversal owners; these rows own no mechanic. */

/** Refuse duplicate identities, unknown fields and unbounded effects before borrowing any owner. */
export function parseQuestStepRows(input: unknown): QuestStepRows {
  const rows = v.parse(QuestStepRowsSchema, input);
  if (new Set(rows.steps.map(row => row.id)).size !== rows.steps.length || new Set(rows.guards.map(row => row.id)).size !== rows.guards.length)
    throw new Error('Quest step identities must be unique');
  return rows;
}

export const QuestKillRowsSchema: v.GenericSchema<QuestKillRowsInput, QuestKillRows> = v.strictObject({ step: name, prefix: v.pipe(v.string(), v.maxLength(96)), runner: QuestStepRowsSchema });
/** Native death observers retain their declared adapter identity and fact prefix. */
export function parseQuestKillRows(input: unknown): v.InferOutput<typeof QuestKillRowsSchema> {
  const rows = v.parse(QuestKillRowsSchema, input);
  if (rows.runner.guards.length > 0 || rows.runner.steps.some(row => row.kind !== 'kill')) throw new Error('Kill observer accepts only kill steps');
  if (rows.runner.steps.some(row => row.effects.some(entry => entry.kind !== 'flag'))) throw new Error('Kill observer accepts only flag effects');
  return rows;
}

const control = v.picklist(['move', 'jump', 'attack', 'lock', 'dodge', 'use']);
const distance = v.pipe(finite, v.minValue(0));
const hintCondition = v.variant('kind', [
  v.strictObject({ kind: v.literal('windup'), seconds: distance }),
  v.strictObject({ kind: v.literal('nearest'), relation: v.picklist(['lt', 'gt']), radius: distance }),
  v.strictObject({ kind: v.literal('done'), control }),
  v.strictObject({ kind: v.literal('lockable') }),
  v.strictObject({ kind: v.literal('prompt'), contains: name }),
  v.strictObject({ kind: v.literal('walked'), metres: distance }),
]);
export const QuestHintRowsSchema: v.GenericSchema<QuestHintRowsInput, QuestHintRows> = v.strictObject({
  hostile: names, scanEvery: v.pipe(finite, v.minValue(0.001)), maxScan: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(1024)), windupRadius: distance,
  hints: v.pipe(v.array(v.strictObject({ control, when: v.pipe(v.array(hintCondition), v.maxLength(8)), touch: v.exactOptional(name), desk: v.exactOptional(name) })), v.maxLength(6)),
  system: v.strictObject({ id: name, after: names, before: names }),
});
/** Ordered onboarding triggers borrow the existing control hints and their global learned-control save. */

export function parseQuestHintRows(input: unknown): QuestHintRows {
  const rows = v.parse(QuestHintRowsSchema, input);
  if (new Set(rows.hints.map(row => row.control)).size !== rows.hints.length) throw new Error('Duplicate quest hint control');
  return rows;
}

/** Client-only service rows share the quest effect vocabulary and retain their authored order. */
export const QuestServiceActionsSchema: v.GenericSchema<QuestServiceActionsRowsInput, QuestServiceActionsRows> = v.strictObject({ version: v.literal(1), actions: v.pipe(v.array(v.strictObject({ id: name,
  effects: v.pipe(v.array(v.union([toast, sting])), v.minLength(1), v.maxLength(32)) })), v.maxLength(128)) });
/** Admit only existing page services, never reflected methods or unbound script commands. */
export function parseQuestServiceActions(input: unknown): v.InferOutput<typeof QuestServiceActionsSchema> {
  const rows = v.parse(QuestServiceActionsSchema, input);
  if (new Set(rows.actions.map(row => row.id)).size !== rows.actions.length) throw new Error('Quest service action ids must be unique');
  return rows;
}

/** Quest-bound observations and publications around an existing spawn guest.
 * The AS program owns encounter decisions; these rows only connect owners. */
const pageEffects = v.pipe(v.array(QuestCommitEffectSchema), v.maxLength(32));
/** A non-combat guide borrows an existing species model and an admitted
 * chapter projection. Path, motion and effect identities are authored data. */
/** G565: the guide's view rows; its gate (quest step, night) and its appear / complete effects are its AS and chapter rows. */
export const QuestLeadPageSchema: v.GenericSchema<QuestLeadPageRowsInput, QuestLeadPageRows> = v.strictObject({ quest: name, signal: name, actor: v.strictObject({ kind: name, variant: name }),
  path: v.pipe(v.array(v.tuple([finite, finite])), v.minLength(1), v.maxLength(256)),
  motion: v.strictObject({ faceTurn: finite, trotSpeed: finite, trotTurn: finite, stopTurn: finite }),
  sound: name,
  puffs: v.strictObject({ color: v.tuple([finite, finite, finite]), count: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(16)),
    height: finite, appear: v.tuple([finite, finite, finite, finite]), fade: v.tuple([finite, finite, finite, finite]) }),
});

export function parseQuestLeadPage(input: unknown): QuestLeadPageRows { return v.parse(QuestLeadPageSchema, input); }

export const QuestSpawnPageSchema: v.GenericSchema<QuestSpawnPageRowsInput, QuestSpawnPageRows> = v.strictObject({ quest: name, script: name,
  channel: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(64)),
  limit: v.strictObject({ phone: v.pipe(finite, v.safeInteger(), v.minValue(0), v.maxValue(256)), desktop: v.pipe(finite, v.safeInteger(), v.minValue(0), v.maxValue(256)) }),
  /** G565: the script reads its declared quest flags itself (its spawn conditions are AS); a flag it raises that the quest
   *  does not hold yet commits these effects once (they set the flag) */
  complete: v.pipe(v.array(v.strictObject({ flag: name, effects: pageEffects })), v.maxLength(64)),
  cues: v.pipe(v.array(v.variant('kind', [v.strictObject({ id: v.pipe(finite, v.safeInteger(), v.minValue(1)), kind: v.literal('sound'), name }),
    v.strictObject({ id: v.pipe(finite, v.safeInteger(), v.minValue(1)), kind: v.literal('puff') })])), v.maxLength(64)),
  puffs: v.strictObject({ color: v.tuple([finite, finite, finite]), count: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(16)),
    height: finite, burst: v.tuple([finite, finite, finite, finite]) }),
});

export function parseQuestSpawnPage(input: unknown): QuestSpawnPageRows {
  const rows = v.parse(QuestSpawnPageSchema, input);
  if (new Set(rows.cues.map(row => row.id)).size !== rows.cues.length || new Set(rows.complete.map(row => row.flag)).size !== rows.complete.length)
    throw new Error('Duplicate quest spawn binding');
  return rows;
}

/** Carried quests project an admitted guest through a declared player or mount carrier. Client-only. */
const xyz=v.tuple([finite,finite,finite]),location=v.strictObject({x:finite,z:finite});
export const CarriedQuestSchema: v.GenericSchema<CarriedQuestRowsInput, CarriedQuestRows> =v.strictObject({
  quest:name,objectName:name,model:v.pipe(SpecimenCatalogueSchema,v.length(1)),program:ReturnProgramSchema,
  carrier:v.exactOptional(v.variant('kind',[v.strictObject({kind:v.literal('mount')}),v.strictObject({kind:v.literal('player'),minimumSpeed:v.pipe(finite,v.minValue(0),v.maxValue(100))})])),
  floorWindow:v.pipe(finite,v.minValue(0)),step:v.pipe(finite,v.minValue(.1),v.maxValue(1)),home:location,goals:v.pipe(v.array(location),v.minLength(1),v.maxLength(64)),
  state:v.pipe(v.record(name,finite),v.maxEntries(32)),signals:v.strictObject({step:name,win:name}),
  fields:v.strictObject({dt:name,playerX:name,playerZ:name,objectX:name,objectZ:name,mounted:name,carrier:name,fast:name,practice:name,carrierX:name,carrierZ:name}),
  outputs:v.strictObject({carrying:name,warning:name,pose:name,goal:name,event:name}),
  poses:v.strictObject({reset:finite,carry:v.pipe(v.array(finite),v.maxLength(8)),goal:finite,
    home:v.strictObject({height:finite,rotation:xyz}),attached:v.strictObject({out:finite,height:finite,yaw:finite,roll:finite}),delivered:v.strictObject({height:finite,rotation:xyz})}),
  warning:v.pipe(v.array(QuestCommitEffectSchema),v.maxLength(16)),events:v.pipe(v.array(v.strictObject({value:finite,effects:v.pipe(v.array(QuestCommitEffectSchema),v.maxLength(16))})),v.maxLength(32)),
});

export function parseCarriedQuest(input:unknown):CarriedQuestRows{
  if(!isJsonData(input))throw new Error('Carried quest rows require JSON data');
  const rows=v.parse(CarriedQuestSchema,input);
  if(!Object.hasOwn(rows.state,rows.outputs.carrying)||new Set(rows.events.map(row=>row.value)).size!==rows.events.length)throw new Error('Invalid carried quest continuation');
  return rows;
}

/** Admitted quest data independent of validator implementation metadata. */
export type QuestSceneEffectRowsInput = ({ kind: 'label'; prompt: string; text: string; }) | ({ kind: 'visible'; part: v.InferInput<typeof HandleIdSchema>; value: boolean; }) | ({ kind: 'light'; part: v.InferInput<typeof HandleIdSchema>; intensity: number; }) | ({ kind: 'mover'; id: string; command: number; }) | ({ kind: 'emitter'; target: string; value: boolean; }) | ({ kind: 'mark'; target: string; value: boolean; });
export type QuestSceneEffectRows = ({ kind: 'label'; prompt: string; text: string; }) | ({ kind: 'visible'; part: v.InferOutput<typeof HandleIdSchema>; value: boolean; }) | ({ kind: 'light'; part: v.InferOutput<typeof HandleIdSchema>; intensity: number; }) | ({ kind: 'mover'; id: string; command: number; }) | ({ kind: 'emitter'; target: string; value: boolean; }) | ({ kind: 'mark'; target: string; value: boolean; });
export type QuestCommitEffectRowsInput = ({ kind: 'toast'; when?: v.InferInput<typeof ObservationRefSchema>; text: string; progress?: { flags: (string)[]; complete: string; }; counter?: { prefix: string; of: number; }; }) | ({ kind: 'sting'; name: 'pickup' | 'death' | 'chunk' | 'dawn'; }) | ({ kind: 'reading'; title: string; lines: (string)[]; }) | ({ kind: 'flag'; flag: string; value?: boolean; }) | ({ kind: 'item'; item: string; count: number; });
export type QuestCommitEffectRows = ({ kind: 'toast'; when?: v.InferOutput<typeof ObservationRefSchema>; text: string; progress?: { flags: (string)[]; complete: string; }; counter?: { prefix: string; of: number; }; }) | ({ kind: 'sting'; name: 'pickup' | 'death' | 'chunk' | 'dawn'; }) | ({ kind: 'reading'; title: string; lines: (string)[]; }) | ({ kind: 'flag'; flag: string; value?: boolean; }) | ({ kind: 'item'; item: string; count: number; });
export type QuestEffectInput = (QuestSceneEffectRowsInput) | (QuestCommitEffectRowsInput) | (({ kind: 'command'; script: string; type: number; target: number; value: number; }) | ({ kind: 'notice'; text: string; }));
export type QuestEffect = (QuestSceneEffectRows) | (QuestCommitEffectRows) | (({ kind: 'command'; script: string; type: number; target: number; value: number; }) | ({ kind: 'notice'; text: string; }));
export interface QuestStepRowsInput { version: 1; steps: (({ kind: 'talk' | 'kill' | 'collect' | 'lead' | 'follow' | 'interact'; target?: string; } & { id: string; when?: { all?: (string)[]; any?: (string)[]; none?: (string)[]; }; once?: string; effects: (QuestEffectInput)[]; }) | ({ kind: 'deliver'; target: string; item: string; count: number; } & { id: string; when?: { all?: (string)[]; any?: (string)[]; none?: (string)[]; }; once?: string; effects: (QuestEffectInput)[]; }) | ({ kind: 'go-to'; at: { x: number; z: number; }; radius: number; } & { id: string; when?: { all?: (string)[]; any?: (string)[]; none?: (string)[]; }; once?: string; effects: (QuestEffectInput)[]; }) | ({ kind: 'wait'; seconds: number; } & { id: string; when?: { all?: (string)[]; any?: (string)[]; none?: (string)[]; }; once?: string; effects: (QuestEffectInput)[]; }))[]; guards: ({ id: string; actor: string; message: string; absentUnless?: string; })[]; }
export interface QuestStepRows { version: 1; steps: (({ kind: 'talk' | 'kill' | 'collect' | 'lead' | 'follow' | 'interact'; target?: string; } & { id: string; when?: { all?: (string)[]; any?: (string)[]; none?: (string)[]; }; once?: string; effects: (QuestEffect)[]; }) | ({ kind: 'deliver'; target: string; item: string; count: number; } & { id: string; when?: { all?: (string)[]; any?: (string)[]; none?: (string)[]; }; once?: string; effects: (QuestEffect)[]; }) | ({ kind: 'go-to'; at: { x: number; z: number; }; radius: number; } & { id: string; when?: { all?: (string)[]; any?: (string)[]; none?: (string)[]; }; once?: string; effects: (QuestEffect)[]; }) | ({ kind: 'wait'; seconds: number; } & { id: string; when?: { all?: (string)[]; any?: (string)[]; none?: (string)[]; }; once?: string; effects: (QuestEffect)[]; }))[]; guards: ({ id: string; actor: string; message: string; absentUnless?: string; })[]; }
export interface QuestKillRowsInput { step: string; prefix: string; runner: QuestStepRowsInput; }
export interface QuestKillRows { step: string; prefix: string; runner: QuestStepRows; }
export type QuestHintRowsInput = QuestHintRows;
export interface QuestHintRows { hostile: (string)[]; scanEvery: number; maxScan: number; windupRadius: number; hints: ({ control: 'move' | 'jump' | 'attack' | 'lock' | 'dodge' | 'use'; when: (({ kind: 'windup'; seconds: number; }) | ({ kind: 'nearest'; relation: 'lt' | 'gt'; radius: number; }) | ({ kind: 'done'; control: 'move' | 'jump' | 'attack' | 'lock' | 'dodge' | 'use'; }) | ({ kind: 'lockable'; }) | ({ kind: 'prompt'; contains: string; }) | ({ kind: 'walked'; metres: number; }))[]; touch?: string; desk?: string; })[]; system: { id: string; after: (string)[]; before: (string)[]; }; }
export interface QuestServiceActionsRowsInput { version: 1; actions: ({ id: string; effects: (({ kind: 'toast'; when?: v.InferInput<typeof ObservationRefSchema>; text: string; progress?: { flags: (string)[]; complete: string; }; counter?: { prefix: string; of: number; }; }) | ({ kind: 'sting'; name: 'pickup' | 'death' | 'chunk' | 'dawn'; }))[]; })[]; }
export interface QuestServiceActionsRows { version: 1; actions: ({ id: string; effects: (({ kind: 'toast'; when?: v.InferOutput<typeof ObservationRefSchema>; text: string; progress?: { flags: (string)[]; complete: string; }; counter?: { prefix: string; of: number; }; }) | ({ kind: 'sting'; name: 'pickup' | 'death' | 'chunk' | 'dawn'; }))[]; })[]; }
export type QuestLeadPageRowsInput = QuestLeadPageRows;
export interface QuestLeadPageRows { quest: string; signal: string; actor: { kind: string; variant: string; }; path: ([number, number])[]; motion: { faceTurn: number; trotSpeed: number; trotTurn: number; stopTurn: number; }; sound: string; puffs: { color: [number, number, number]; count: number; height: number; appear: [number, number, number, number]; fade: [number, number, number, number]; }; }
export interface QuestSpawnPageRowsInput { quest: string; script: string; channel: number; limit: { phone: number; desktop: number; }; complete: ({ flag: string; effects: (QuestCommitEffectRowsInput)[]; })[]; cues: (({ id: number; kind: 'sound'; name: string; }) | ({ id: number; kind: 'puff'; }))[]; puffs: { color: [number, number, number]; count: number; height: number; burst: [number, number, number, number]; }; }
export interface QuestSpawnPageRows { quest: string; script: string; channel: number; limit: { phone: number; desktop: number; }; complete: ({ flag: string; effects: (QuestCommitEffectRows)[]; })[]; cues: (({ id: number; kind: 'sound'; name: string; }) | ({ id: number; kind: 'puff'; }))[]; puffs: { color: [number, number, number]; count: number; height: number; burst: [number, number, number, number]; }; }
export interface CarriedQuestRowsInput { quest: string; objectName: string; model: v.InferInput<typeof SpecimenCatalogueSchema>; program: v.InferInput<typeof ReturnProgramSchema>; carrier?: ({ kind: 'mount'; }) | ({ kind: 'player'; minimumSpeed: number; }); floorWindow: number; step: number; home: { x: number; z: number; }; goals: ({ x: number; z: number; })[]; state: Record<string, number>; signals: { step: string; win: string; }; fields: { dt: string; playerX: string; playerZ: string; objectX: string; objectZ: string; mounted: string; carrier: string; fast: string; practice: string; carrierX: string; carrierZ: string; }; outputs: { carrying: string; warning: string; pose: string; goal: string; event: string; }; poses: { reset: number; carry: (number)[]; goal: number; home: { height: number; rotation: [number, number, number]; }; attached: { out: number; height: number; yaw: number; roll: number; }; delivered: { height: number; rotation: [number, number, number]; }; }; warning: (QuestCommitEffectRowsInput)[]; events: ({ value: number; effects: (QuestCommitEffectRowsInput)[]; })[]; }
export interface CarriedQuestRows { quest: string; objectName: string; model: v.InferOutput<typeof SpecimenCatalogueSchema>; program: v.InferOutput<typeof ReturnProgramSchema>; carrier?: ({ kind: 'mount'; }) | ({ kind: 'player'; minimumSpeed: number; }); floorWindow: number; step: number; home: { x: number; z: number; }; goals: ({ x: number; z: number; })[]; state: Record<string, number>; signals: { step: string; win: string; }; fields: { dt: string; playerX: string; playerZ: string; objectX: string; objectZ: string; mounted: string; carrier: string; fast: string; practice: string; carrierX: string; carrierZ: string; }; outputs: { carrying: string; warning: string; pose: string; goal: string; event: string; }; poses: { reset: number; carry: (number)[]; goal: number; home: { height: number; rotation: [number, number, number]; }; attached: { out: number; height: number; yaw: number; roll: number; }; delivered: { height: number; rotation: [number, number, number]; }; }; warning: (QuestCommitEffectRows)[]; events: ({ value: number; effects: (QuestCommitEffectRows)[]; })[]; }
