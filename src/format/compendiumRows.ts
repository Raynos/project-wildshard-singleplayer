import * as v from 'valibot';

const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(Number.MIN_VALUE), v.maxValue(10000000));
const natural = v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(1024));
const hash = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u));
const entryKind = v.picklist(['species', 'variant', 'elite', 'boss', 'place']);
const match = v.strictObject({ kind: key, variants: v.exactOptional(v.pipe(v.array(key), v.maxLength(128))) });
const point = v.strictObject({ x: finite, z: finite, r: positive });
const model = v.strictObject({ id: key, variant: v.exactOptional(key) });
const entry = v.strictObject({ id: key, kind: entryKind, tab: key, name: text, notes: text,
  subtitle: v.exactOptional(text), hint: v.exactOptional(text), rarity: v.exactOptional(v.picklist(['common', 'uncommon', 'rare', 'legendary'])),
  massKg: v.exactOptional(positive), match: v.exactOptional(match), place: v.exactOptional(point),
  plate: v.strictObject({ sketch: hash, silhouette: v.exactOptional(hash), model: v.exactOptional(model) }) });
const stat = v.strictObject({ label: text, value: v.picklist(['seen', 'taken', 'best', 'rarity', 'status']),
  fallback: v.exactOptional(text), suffix: v.exactOptional(text), words: v.exactOptional(v.record(key, text)) });
const stats = v.pipe(v.array(stat), v.maxLength(8));
const icon = v.strictObject({ entryKind: v.exactOptional(entryKind), matchKind: v.exactOptional(key),
  icon: v.picklist(['antlers', 'ghost', 'ironhide', 'deer', 'boar', 'elk', 'bear']) });
const cell = v.strictObject({ x: finite, y: finite, w: positive, h: positive });
const trophy = v.strictObject({ entry: key, outline: key, mount: v.exactOptional(v.strictObject({ kind: key, variant: key })), title: text });
const wall = v.strictObject({ cabin: natural, at: v.tuple([finite, finite, finite]), yaw: finite, width: positive,
  rows: v.pipe(v.array(natural), v.minLength(1), v.maxLength(16)), rowY: v.pipe(v.array(finite), v.minLength(1), v.maxLength(16)) });
/** Rich journal content is still data: image hashes, matching, labels and bounded stat selectors. */
export const JournalRowSchema = v.strictObject({ kind: v.literal('journal'), id: key, chunkId: key, className: key, title: text,
  tabs: v.pipe(v.array(v.strictObject({ id: key, label: text })), v.minLength(1), v.maxLength(16)), trophyTab: v.exactOptional(key),
  stamp: v.strictObject({ place: text, default: text }), icons: v.pipe(v.array(icon), v.maxLength(64)),
  stats: v.strictObject({ place: stats, default: stats }),
  chalk: v.exactOptional(v.strictObject({ atlas: hash, cells: v.record(key, cell) })),
  entries: v.pipe(v.array(entry), v.maxLength(256)), trophies: v.exactOptional(v.pipe(v.array(trophy), v.maxLength(256))),
  wall: v.exactOptional(wall) });
export type JournalRow = v.InferOutput<typeof JournalRowSchema>;

/** Cross references are checked before any image read or registration. */
export function journalRowRules(row: JournalRow): readonly string[] {
  const errors: string[] = [], tabs = new Set(row.tabs.map(tab => tab.id)), ids = new Set(row.entries.map(value => value.id));
  if (tabs.size !== row.tabs.length || ids.size !== row.entries.length || row.entries.some(value => !tabs.has(value.tab)
    || (value.kind === 'place' ? value.place === undefined || value.match !== undefined : value.place !== undefined))) errors.push('journal identities, tabs and places');
  if (row.trophyTab !== undefined && !tabs.has(row.trophyTab)) errors.push('journal trophy tab');
  if ((row.trophies ?? []).some(value => !ids.has(value.entry) || row.chalk?.cells[value.outline] === undefined)
    || new Set((row.trophies ?? []).map(value => value.entry)).size !== (row.trophies?.length ?? 0)) errors.push('journal trophy references');
  if (row.wall !== undefined && (row.wall.rows.length !== row.wall.rowY.length
    || row.wall.rows.reduce((sum, value) => sum + value, 0) !== row.trophies?.length)) errors.push('journal wall layout');
  return errors;
}
/** All raster images must be charged immutable library roots; logical URLs are resolved by the admitted product. */
export function journalImageRefs(row: JournalRow): readonly string[] {
  return [...new Set([...row.entries.flatMap(value => [value.plate.sketch, ...value.plate.silhouette === undefined ? [] : [value.plate.silhouette]]),
    ...row.chalk === undefined ? [] : [row.chalk.atlas]])];
}
