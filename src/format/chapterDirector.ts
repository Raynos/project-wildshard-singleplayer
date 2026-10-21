import * as v from 'valibot';
import { WakeEncounterSchema } from './bossEncounter';
import { QuestCommitEffectSchema } from './questSteps';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
/** A chapter's wake encounter binds its real spawn and chapter by identity.
 * Cues select lifecycle operations and ordered quest effects only. */
export const ChapterWakeSchema = v.strictObject({ version: v.literal(1), quest: name, spawn: name, director: name,
  encounter: WakeEncounterSchema,
  cues: v.pipe(v.array(v.strictObject({ id: name, operation: v.picklist(['restore', 'wake', 'effects']),
    effects: v.pipe(v.array(QuestCommitEffectSchema), v.maxLength(32)), combat: v.exactOptional(v.pipe(finite, v.minValue(0), v.maxValue(1))) })), v.maxLength(64)),
  systems: v.strictObject({ encounter: name, director: name, before: v.pipe(v.array(name), v.maxLength(64)) }),
});
export type ChapterWakeRows = v.InferOutput<typeof ChapterWakeSchema>;
/** Refuse aliases before any body, chapter subscription or UI is installed. */
export function parseChapterWake(input: unknown): ChapterWakeRows {
  const rows = v.parse(ChapterWakeSchema, input);
  if (new Set(rows.cues.map(row => row.id)).size !== rows.cues.length || rows.systems.encounter === rows.systems.director)
    throw new Error('Duplicate chapter wake identity');
  return rows;
}
const caption = v.strictObject({ kicker: name, title: name, subtitle: v.pipe(v.string(), v.maxLength(1024)) });
const observation = v.union([finite, v.strictObject({ flag: name }), v.strictObject({ read: v.picklist([
  'day-present', 'night', 'player-x', 'player-z', 'reward-x', 'reward-z',
]) })]);
const effect = v.variant('kind', [
  v.strictObject({ kind: v.literal('flag'), flag: name, value: v.exactOptional(v.boolean()) }),
  v.strictObject({ kind: v.literal('item'), item: name, count: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(8192)) }),
  v.strictObject({ kind: v.literal('toast'), text: v.pipe(v.string(), v.maxLength(4096)) }),
  v.strictObject({ kind: v.literal('sting'), name: v.picklist(['pickup', 'death', 'chunk', 'dawn']) }),
  v.strictObject({ kind: v.literal('phase'), to: v.pipe(finite, v.minValue(0), v.maxValue(1)), seconds: v.pipe(finite, v.minValue(0.001), v.maxValue(86400)) }),
  v.strictObject({ kind: v.literal('caption'), show: v.boolean() }),
  v.strictObject({ kind: v.literal('objective'), hide: v.boolean() }),
  v.strictObject({ kind: v.literal('cue'), id: name }),
  v.strictObject({ kind: v.literal('reward'), state: v.picklist(['started', 'completed']) }),
]);
export const ChapterDirectorSchema = v.strictObject({
  version: v.literal(1), quest: name, caption,
  observations: v.pipe(v.record(name, observation), v.maxEntries(32)),
  actions: v.pipe(v.record(name, v.pipe(v.array(effect), v.maxLength(32))), v.maxEntries(64)),
  source: v.picklist(['matching', 'optional']), initialDt: v.pipe(finite, v.minValue(0), v.maxValue(1)),
  changes: v.pipe(v.array(name), v.maxLength(32)),
  requests: v.pipe(v.array(v.union([v.strictObject({ flag: name, request: name }), v.strictObject({ step: name, request: name })])), v.maxLength(32)),
  reward: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, yaw: finite, pitch: finite, phase: finite })),
});
/** Closed chapter publications: no reflected paths, methods or shard callbacks. */
export type ChapterDirectorRows = v.InferOutput<typeof ChapterDirectorSchema>;
/** Read-only observations shared by page and renderer-free chapter entries. */
export function chapterObservations(rows: ChapterDirectorRows['observations'], frame: {
  readonly flags: readonly string[]; readonly day: { readonly night: number } | null;
  readonly player: { readonly x: number; readonly z: number };
  readonly reward: { readonly x: number; readonly z: number } | null;
}): Record<string, number> {
  return Object.fromEntries(Object.entries(rows).map(([key, row]) => {
    if (typeof row === 'number') return [key, row];
    if ('flag' in row) return [key, Number(frame.flags.includes(row.flag))];
    const value = row.read === 'day-present' ? Number(frame.day !== null) : row.read === 'night' ? frame.day?.night ?? 0
      : row.read === 'player-x' ? frame.player.x : row.read === 'player-z' ? frame.player.z
      : row.read === 'reward-x' ? frame.reward?.x : frame.reward?.z;
    if (value === undefined) throw new Error('Chapter reward observation lacks its pose');
    return [key, value];
  }));
}
/** Admission is pure and precedes any subscription, clock or presentation. */
export function parseChapterDirector(input: unknown): ChapterDirectorRows {
  const rows = v.parse(ChapterDirectorSchema, input);
  if (rows.reward === undefined && (Object.values(rows.observations).some(row => typeof row !== 'number' && 'read' in row && row.read.startsWith('reward-'))
    || Object.values(rows.actions).some(actions => actions.some(action => action.kind === 'reward')))) throw new Error('Chapter reward requires its target pose');
  return rows;
}
