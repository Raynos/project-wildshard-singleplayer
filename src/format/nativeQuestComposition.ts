import * as v from 'valibot';
import { QuestStorySchema } from './questStory';
import { ChapterDirectorSchema, parseChapterDirector } from './chapterDirector';

const n = v.pipe(v.number(), v.finite()), key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const integer = v.pipe(n, v.safeInteger(), v.minValue(0));
const phase = v.picklist(['commands', 'reading', 'props', 'transitions', 'cable', 'director', 'reward', 'chapter', 'lead']);
const saved = v.picklist(['key', 'finale', 'iron', 'lead', 'clock', 'fast', 'cable', 'pickup', 'counts', 'pack', 'dialogue', 'board', 'rewardOwned', 'trader', 'ammunition', 'zipline', 'reward', 'barrel']);
const transitions = v.strictObject({ ids: v.pipe(v.array(v.string()), v.maxLength(1024)),
  rowLimit: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(1024)), flagLimit: v.pipe(n, v.integer(), v.minValue(1), v.maxValue(1024)),
  touch: v.picklist(['direct', 'graph']), pickup: v.union([v.literal('walk-in'), v.strictObject({ radius: v.pipe(n, v.minValue(Number.MIN_VALUE)), height: v.pipe(n, v.minValue(Number.MIN_VALUE)) })]),
  plate: v.exactOptional(v.strictObject({ inset: n, depth: n })),
});
/** One renderer-free composition frame over the existing native owners. Facets
 * select mechanics; phase and save order retain the caller's admitted wire. */
export const NativeQuestCompositionSchema = v.strictObject({
  step: key, cable: key, eye: n, counts: v.picklist(['all', 'declared']), phases: v.pipe(v.array(phase), v.minLength(1)),
  saved: v.strictObject({ names: v.record(key, key), snapshot: v.array(saved), restore: v.array(saved), optional: v.array(saved) }),
  bounds: v.exactOptional(v.strictObject({ rows: v.pipe(integer, v.minValue(1), v.maxValue(64)), items: v.exactOptional(v.pipe(integer, v.maxValue(64))), ordered: v.exactOptional(v.boolean()) })),
  transitions,
  props: v.exactOptional(v.strictObject({
    barrel: v.strictObject({ kind: key, id: key }), drop: v.strictObject({ kind: key, id: key }), promptHeight: n,
  })),
  acquisition: v.exactOptional(v.strictObject({ population: key, equipment: key, kind: key, slot: v.pipe(integer, v.maxValue(31)),
    id: key, observation: key, guardRadius: n, radius: n, action: n })),
  reward: v.exactOptional(v.strictObject({ director: key, channels: key, field: key, complete: key, seen: key })),
  prompts: v.exactOptional(v.strictObject({ talk: v.strictObject({ id: key, action: n, radius: n }), cable: v.strictObject({ id: key, action: n }), rowBase: n })),
  reading: v.exactOptional(v.strictObject({ primary: key, delay: n })),
  effects: v.exactOptional(v.strictObject({ pack: key })),
  board: v.exactOptional(v.strictObject({ finish: key, claims: integer, ids: v.array(key) })),
  trade: v.exactOptional(v.strictObject({ pack: key, finish: key, speaker: key })),
  ammunition: v.exactOptional(v.strictObject({ launcher: integer })),
  bench: v.exactOptional(v.strictObject({ id: key, pose: QuestStorySchema.entries.bench })),
  pickup: v.exactOptional(v.strictObject({ flag: key })),
  boss: v.exactOptional(v.strictObject({ id: key })),
  chapter: v.exactOptional(ChapterDirectorSchema),
  lead: v.exactOptional(v.strictObject({ step: key, target: key })),
});
/** Closed rows over actual native mechanics, with no authored executable ports. */
export type NativeQuestCompositionRows = v.InferOutput<typeof NativeQuestCompositionSchema>;
/** Admit role/phase identities and dependencies before allocating any owner. */
export function parseNativeQuestComposition(input: unknown): NativeQuestCompositionRows {
  const rows = v.parse(NativeQuestCompositionSchema, input);
  if (rows.chapter !== undefined) parseChapterDirector(rows.chapter);
  const optional = new Set<string>(['pack', 'dialogue', 'board', 'rewardOwned', 'trader', 'ammunition']);
  if (rows.saved.optional.some(role => !optional.has(role)) || !rows.saved.snapshot.includes('counts') || !rows.saved.snapshot.includes('pack')
    || rows.saved.snapshot.includes('cable') === rows.saved.snapshot.includes('zipline')) throw new Error('Invalid native saved role policy');
  const aliases = rows.saved.snapshot.map(name => rows.saved.names[name] ?? name);
  if (new Set(rows.phases).size !== rows.phases.length || new Set(aliases).size !== aliases.length
    || new Set(rows.saved.restore).size !== rows.saved.restore.length
    || new Set(rows.saved.optional).size !== rows.saved.optional.length
    || rows.saved.optional.some(name => !rows.saved.snapshot.includes(name))
    || rows.saved.restore.length !== rows.saved.snapshot.length
    || rows.saved.restore.some(name => !rows.saved.snapshot.includes(name))) throw new Error('Duplicate or unknown native quest role');
  if ((rows.board !== undefined && (rows.ammunition === undefined || rows.effects === undefined))
    || (rows.trade !== undefined && (rows.ammunition === undefined || rows.board === undefined))
    || (rows.lead !== undefined && (rows.chapter === undefined || rows.effects === undefined))
    || (rows.reading !== undefined && rows.effects === undefined)
    || (rows.acquisition !== undefined && rows.props === undefined)) throw new Error('Missing native quest facet dependency');
  if (Object.keys(rows.saved.names).some(name => !rows.saved.snapshot.some(role => role === name))
    || (rows.board !== undefined && (new Set(rows.board.ids).size !== rows.board.ids.length || !rows.board.ids.includes(rows.board.finish))))
    throw new Error('Ambiguous native saved or finish identity');
  return rows;
}

const point = v.strictObject({ x: n, y: n, z: n });
const prompt = v.strictObject({ ...point.entries, radius: v.pipe(n, v.minValue(Number.MIN_VALUE)) });
/** Build admission for captured service prompts; all existing cable endpoints
 * survive unchanged in the original named placement document. */
export const NativeQuestServiceSpotsSchema = v.strictObject({
  rows: v.array(v.strictObject({ ...point.entries, id: key, kind: key, yaw: n, prompt: v.nullable(point) })),
  people: v.array(v.strictObject({ kind: key, at: point, prompt })), board: prompt, pickup: prompt,
  cable: v.strictObject({ prompt, top: point, bottom: point, landing: point }), signals: v.record(key, prompt),
});
/** Duplicate placement identities refuse before a native service is installed. */
export function parseNativeQuestServiceSpots(input: unknown): v.InferOutput<typeof NativeQuestServiceSpotsSchema> {
  const rows = v.parse(NativeQuestServiceSpotsSchema, input);
  if (new Set(rows.rows.map(row => row.id)).size !== rows.rows.length
    || new Set(rows.people.map(row => row.kind)).size !== rows.people.length) throw new Error('Duplicate native story spot');
  return rows;
}
