import * as v from 'valibot';
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
export const QuestSceneEffectSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('label'), prompt: name, text: v.pipe(v.string(), v.maxLength(4096)) }),
  v.strictObject({ kind: v.literal('visible'), part: HandleIdSchema, value: v.boolean() }),
  v.strictObject({ kind: v.literal('light'), part: HandleIdSchema, intensity: v.pipe(finite, v.minValue(0)) }),
  v.strictObject({ kind: v.literal('mover'), id: name, command: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(3)) }),
  v.strictObject({ kind: v.literal('emitter'), target: name, value: v.boolean() }),
  v.strictObject({ kind: v.literal('mark'), target: name, value: v.boolean() }),
]);
/** Ordered effects, admitted identically for page actions and quest step rows. */
export const QuestEffectSchema = v.union([QuestSceneEffectSchema, v.variant('kind', [
  toast, sting,
  v.strictObject({ kind: v.literal('reading'), title: v.pipe(v.string(), v.maxLength(512)),
    lines: v.pipe(v.array(v.pipe(v.string(), v.maxLength(8192))), v.maxLength(128)) }),
  v.strictObject({ kind: v.literal('flag'), flag: name, value: v.exactOptional(v.boolean()) }),
  v.strictObject({ kind: v.literal('item'), item: name, count: v.pipe(finite, v.safeInteger(), v.minValue(1)) }),
  v.strictObject({ kind: v.literal('command'), script: name, type: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(2147483647)),
    target: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(2147483647)), value: finite }),
  v.strictObject({ kind: v.literal('notice'), text: v.pipe(v.string(), v.maxLength(2048)) }),
])]);
export type QuestEffect = v.InferOutput<typeof QuestEffectSchema>;
const base = { id: name, when: v.exactOptional(condition), once: v.exactOptional(name),
  effects: v.pipe(v.array(QuestEffectSchema), v.minLength(1), v.maxLength(32)) };
const signal = v.strictObject({ ...base, kind: v.picklist(['talk', 'kill', 'collect', 'lead', 'follow', 'interact']), target: v.exactOptional(name) });
const step = v.union([signal,
  v.strictObject({ ...base, kind: v.literal('deliver'), target: name, item: name, count: v.pipe(finite, v.safeInteger(), v.minValue(1)) }),
  v.strictObject({ ...base, kind: v.literal('go-to'), at: v.strictObject({ x: finite, z: finite }), radius: v.pipe(finite, v.minValue(0.001)) }),
  v.strictObject({ ...base, kind: v.literal('wait'), seconds: v.pipe(finite, v.minValue(0), v.maxValue(86400)) }),
]);
const guard = v.strictObject({ id: name, actor: name, message: name, absentUnless: v.exactOptional(name) });
export const QuestStepRowsSchema = v.strictObject({ version: v.literal(1), steps: v.pipe(v.array(step), v.maxLength(256)), guards: v.pipe(v.array(guard), v.maxLength(64)) });
/** Quest signals come from existing dialogue, inventory, actors and traversal owners; these rows own no mechanic. */
export type QuestStepRows = v.InferOutput<typeof QuestStepRowsSchema>;
/** Refuse duplicate identities, unknown fields and unbounded effects before borrowing any owner. */
export function parseQuestStepRows(input: unknown): QuestStepRows {
  const rows = v.parse(QuestStepRowsSchema, input);
  if (new Set(rows.steps.map(row => row.id)).size !== rows.steps.length || new Set(rows.guards.map(row => row.id)).size !== rows.guards.length)
    throw new Error('Quest step identities must be unique');
  return rows;
}

export const QuestKillRowsSchema = v.strictObject({ step: name, prefix: v.pipe(v.string(), v.maxLength(96)), runner: QuestStepRowsSchema });
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
export const QuestHintRowsSchema = v.strictObject({
  hostile: names, scanEvery: v.pipe(finite, v.minValue(0.001)), maxScan: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(1024)), windupRadius: distance,
  hints: v.pipe(v.array(v.strictObject({ control, when: v.pipe(v.array(hintCondition), v.maxLength(8)), touch: v.exactOptional(name), desk: v.exactOptional(name) })), v.maxLength(6)),
  system: v.strictObject({ id: name, after: names, before: names }),
});
/** Ordered onboarding triggers borrow the existing control hints and their global learned-control save. */
export type QuestHintRows = v.InferOutput<typeof QuestHintRowsSchema>;
export function parseQuestHintRows(input: unknown): QuestHintRows {
  const rows = v.parse(QuestHintRowsSchema, input);
  if (new Set(rows.hints.map(row => row.control)).size !== rows.hints.length) throw new Error('Duplicate quest hint control');
  return rows;
}

/** Client-only service rows share the quest effect vocabulary and retain their authored order. */
export const QuestServiceActionsSchema = v.strictObject({ version: v.literal(1), actions: v.pipe(v.array(v.strictObject({ id: name,
  effects: v.pipe(v.array(v.union([toast, sting])), v.minLength(1), v.maxLength(32)) })), v.maxLength(128)) });
/** Admit only existing page services, never reflected methods or unbound script commands. */
export function parseQuestServiceActions(input: unknown): v.InferOutput<typeof QuestServiceActionsSchema> {
  const rows = v.parse(QuestServiceActionsSchema, input);
  if (new Set(rows.actions.map(row => row.id)).size !== rows.actions.length) throw new Error('Quest service action ids must be unique');
  return rows;
}

/** Quest-bound observations and publications around an existing spawn guest.
 * The AS program owns encounter decisions; these rows only connect owners. */
const pageEffects = v.pipe(v.array(v.variant('kind', [toast, sting,
  v.strictObject({ kind: v.literal('flag'), flag: name, value: v.exactOptional(v.boolean()) })])), v.maxLength(32));
/** A non-combat guide borrows an existing species model and an admitted
 * chapter projection. Path, motion and effect identities are authored data. */
export const QuestLeadPageSchema = v.strictObject({ quest: name, step: name, signal: name,
  nightAbove: v.pipe(finite, v.minValue(0), v.maxValue(1)), actor: v.strictObject({ kind: name, variant: name }),
  path: v.pipe(v.array(v.tuple([finite, finite])), v.minLength(1), v.maxLength(256)),
  motion: v.strictObject({ faceTurn: finite, trotSpeed: finite, trotTurn: finite, stopTurn: finite }),
  sound: name, effects: v.strictObject({ appear: pageEffects, complete: pageEffects }),
  puffs: v.strictObject({ color: v.tuple([finite, finite, finite]), count: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(16)),
    height: finite, appear: v.tuple([finite, finite, finite, finite]), fade: v.tuple([finite, finite, finite, finite]) }),
});
export type QuestLeadPageRows = v.InferOutput<typeof QuestLeadPageSchema>;
export function parseQuestLeadPage(input: unknown): QuestLeadPageRows { return v.parse(QuestLeadPageSchema, input); }

export const QuestSpawnPageSchema = v.strictObject({ quest: name, script: name,
  channel: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(64)),
  limit: v.strictObject({ phone: v.pipe(finite, v.safeInteger(), v.minValue(0), v.maxValue(256)), desktop: v.pipe(finite, v.safeInteger(), v.minValue(0), v.maxValue(256)) }),
  flags: v.pipe(v.array(v.strictObject({ flag: name, when: condition })), v.maxLength(64)),
  complete: v.pipe(v.array(v.strictObject({ flag: name, when: condition,
    effects: pageEffects })), v.maxLength(64)),
  cues: v.pipe(v.array(v.variant('kind', [v.strictObject({ id: v.pipe(finite, v.safeInteger(), v.minValue(1)), kind: v.literal('sound'), name }),
    v.strictObject({ id: v.pipe(finite, v.safeInteger(), v.minValue(1)), kind: v.literal('puff') })])), v.maxLength(64)),
  puffs: v.strictObject({ color: v.tuple([finite, finite, finite]), count: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(16)),
    height: finite, burst: v.tuple([finite, finite, finite, finite]) }),
});
export type QuestSpawnPageRows = v.InferOutput<typeof QuestSpawnPageSchema>;
export function parseQuestSpawnPage(input: unknown): QuestSpawnPageRows {
  const rows = v.parse(QuestSpawnPageSchema, input);
  if (new Set(rows.cues.map(row => row.id)).size !== rows.cues.length || new Set(rows.flags.map(row => row.flag)).size !== rows.flags.length
    || new Set(rows.complete.map(row => row.flag)).size !== rows.complete.length)
    throw new Error('Duplicate quest spawn binding');
  return rows;
}
