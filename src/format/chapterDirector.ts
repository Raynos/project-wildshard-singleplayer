import * as v from 'valibot';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
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
const schema = v.strictObject({
  version: v.literal(1), quest: name, caption,
  observations: v.pipe(v.record(name, observation), v.maxEntries(32)),
  actions: v.pipe(v.record(name, v.pipe(v.array(effect), v.maxLength(32))), v.maxEntries(64)),
  source: v.picklist(['matching', 'optional']), initialDt: v.pipe(finite, v.minValue(0), v.maxValue(1)),
  changes: v.pipe(v.array(name), v.maxLength(32)),
  requests: v.pipe(v.array(v.union([v.strictObject({ flag: name, request: name }), v.strictObject({ step: name, request: name })])), v.maxLength(32)),
  reward: v.exactOptional(v.strictObject({ x: finite, y: finite, z: finite, yaw: finite, pitch: finite, phase: finite })),
});
/** Closed chapter publications: no reflected paths, methods or shard callbacks. */
export type ChapterDirectorRows = v.InferOutput<typeof schema>;
/** Admission is pure and precedes any subscription, clock or presentation. */
export function parseChapterDirector(input: unknown): ChapterDirectorRows {
  const rows = v.parse(schema, input);
  if (rows.reward === undefined && (Object.values(rows.observations).some(row => typeof row !== 'number' && 'read' in row && row.read.startsWith('reward-'))
    || Object.values(rows.actions).some(actions => actions.some(action => action.kind === 'reward')))) throw new Error('Chapter reward requires its target pose');
  return rows;
}
