import * as v from 'valibot';
import type { NpcDialogueRow } from './npcs';
import type { AchievementCounterData } from './achievementCounters';
import type { ContractCatalogue } from './contracts';
import { QuestStorySchema, type QuestStory } from './questStory';
import { ChapterDirectorSchema, parseChapterDirector, type ChapterDirectorRows } from './chapterDirector';

const finite = v.pipe(v.number(), v.finite());
const text = v.pipe(v.string(), v.minLength(1));
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE));
const point = v.strictObject({ x: finite, y: finite, z: finite });
const prompt = v.strictObject({ ...point.entries, radius: positive });
const transitions = v.strictObject({ ids: v.pipe(v.array(v.string()), v.maxLength(1024)),
  rowLimit: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(1024)),
  flagLimit: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(1024)),
  touch: v.picklist(['direct', 'graph']), pickup: v.union([v.literal('walk-in'), v.strictObject({ radius: positive, height: positive })]),
  plate: v.exactOptional(v.strictObject({ inset: finite, depth: finite })),
});
/** Build admission for the existing renderer-free story policy document.
 * Its wire names, owner identities and chapter program remain authored data. */
export const NativeStoryPolicySchema = v.strictObject({
  savedNames: v.record(text, text), step: text, eye: finite,
  launcher: v.pipe(finite, v.integer(), v.minValue(0)), boss: text, cable: text, pack: text,
  primary: text, trader: text, transitions, benchRow: text, bench: QuestStorySchema.entries.bench,
  pickup: v.strictObject({ flag: text }),
  finish: v.strictObject({ id: text, claims: v.pipe(finite, v.integer(), v.minValue(0)), ids: v.array(text) }),
  lead: v.strictObject({ step: text, target: text, nightAbove: finite }), clock: ChapterDirectorSchema,
});
/** Build admission retains every existing placement, including cable endpoints.
 * No second placement document or runtime placement owner is introduced. */
export const NativeStorySpotsSchema = v.strictObject({
  rows: v.array(v.strictObject({ ...point.entries, id: text, kind: text, yaw: finite, prompt: v.nullable(point) })),
  people: v.array(v.strictObject({ kind: text, at: point, prompt })), board: prompt, pickup: prompt,
  cable: v.strictObject({ prompt, top: point, bottom: point, landing: point }), signals: v.record(text, prompt),
});
/** Refuse ambiguous saved aliases and finish identities before emitting bytes. */
export function parseNativeStoryPolicy(input: unknown): v.InferOutput<typeof NativeStoryPolicySchema> {
  const rows = v.parse(NativeStoryPolicySchema, input);
  parseChapterDirector(rows.clock);
  const keys = ['lead', 'clock', 'fast', 'cable', 'pickup', 'counts', 'pack', 'dialogue', 'board', 'rewardOwned', 'trader', 'ammunition'];
  const names = keys.map(key => rows.savedNames[key] ?? key);
  if (new Set(names).size !== names.length || new Set(rows.finish.ids).size !== rows.finish.ids.length
    || !rows.finish.ids.includes(rows.finish.id)) throw new Error('Ambiguous native story identity');
  return rows;
}
/** Refuse duplicate placement identities before any native ports are installed. */
export function parseNativeStorySpots(input: unknown): v.InferOutput<typeof NativeStorySpotsSchema> {
  const rows = v.parse(NativeStorySpotsSchema, input);
  if (new Set(rows.rows.map(row => row.id)).size !== rows.rows.length
    || new Set(rows.people.map(row => row.kind)).size !== rows.people.length) throw new Error('Duplicate native story spot');
  return rows;
}

interface Point { x: number; y: number; z: number }
interface Prompt extends Point { radius: number }
/** Borrowed placement view; callers may lend immutable admitted arrays. */
export interface NativeStorySpots {
  readonly rows: readonly (Point & { id: string; kind: string; yaw: number; prompt: Point | null })[];
  readonly people: readonly { kind: string; at: Point; prompt: Prompt }[];
  readonly board: Prompt; readonly pickup: Prompt;
  readonly cable: { readonly prompt: Prompt };
  readonly signals: Readonly<Record<string, Prompt>>;
}
/** Renderer-free composition view over admitted documents. The table type is
 * lent by its owning layer, keeping format independent of engine and game. */
export interface NativeStoryRows<Table> {
  readonly content: {
    readonly table: Table;
    readonly steps: unknown; readonly deaths: unknown;
    readonly readings: { readonly speakers: Readonly<Record<string, NpcDialogueRow>>;
      readonly continuation?: { readonly bare: string; readonly wrapped: readonly string[] } };
    readonly policy: { readonly readingDelay: number };
    readonly lead: { readonly program: unknown; readonly path: readonly (readonly [number, number])[] };
  };
  readonly counters: AchievementCounterData; readonly contracts: ContractCatalogue; readonly trades: unknown;
  readonly spots: NativeStorySpots;
  readonly policy: {
    readonly savedNames: Readonly<Record<string, string>>;
    readonly step: string;
    readonly eye: number; readonly launcher: number; readonly boss: string; readonly cable: string; readonly pack: string;
    readonly primary: string; readonly trader: string;
    readonly transitions: unknown; readonly benchRow: string; readonly bench: QuestStory['bench'];
    readonly pickup: { readonly flag: string };
    readonly finish: { readonly id: string; readonly claims: number; readonly ids: readonly string[] };
    readonly lead: { readonly step: string; readonly target: string; readonly nightAbove: number };
    readonly clock: ChapterDirectorRows;
  };
}
