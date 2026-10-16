import * as v from 'valibot';
import { isJsonData } from './json';
import type { Shardfile } from './shardSchema';

const id = v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9.:-]*$/u), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const coordinate = v.pipe(finite, v.minValue(-10000), v.maxValue(10000));
const distance = v.pipe(finite, v.minValue(0), v.maxValue(100));
const names = v.pipe(v.array(id), v.maxLength(64));
const needs = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });
const effectSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('flag'), id }),
  v.strictObject({ kind: v.literal('interaction'), id }),
  v.strictObject({ kind: v.literal('hint'), text: v.pipe(v.string(), v.minLength(1), v.maxLength(4096)) }),
]);
const scan = v.variant('kind', [
  v.strictObject({ kind: v.literal('cone'), reach: distance, halfAngle: v.pipe(finite, v.minValue(0), v.maxValue(Math.PI)), selection: v.literal('all') }),
  v.strictObject({ kind: v.literal('ray'), selection: v.literal('nearest') }),
]);
const target = v.pipe(v.strictObject({ id, weapon: id, at: v.tuple([coordinate, coordinate, coordinate]), radius: distance,
  needs: v.exactOptional(needs), scan,
  rules: v.pipe(v.array(v.strictObject({ move: id, contact: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(31)),
    effects: v.pipe(v.array(effectSchema), v.maxLength(32), v.check(rows => rows.filter(row => row.kind === 'interaction').length <= 1, 'one atomic interaction per rule')), caught: v.picklist(['always', 'if-applied', 'never']) })), v.minLength(1), v.maxLength(32),
    v.check(rows => new Set(rows.map(row => `${row.move}/${row.contact}`)).size === rows.length, 'unique move/contact rules')),
}), v.check(row => row.scan.kind !== 'cone' || row.radius === 0, 'cone contacts use immutable points'));
/** Ordered immutable world contacts. `contact` is the zero-based landing ordinal within a move, not a move-table slot. */
const targets = v.pipe(v.array(target), v.maxLength(128),
  v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'unique world target ids'),
  v.check(rows => rows.every(row => rows.every(other => row.weapon !== other.weapon || JSON.stringify(row.scan) === JSON.stringify(other.scan))), 'one scan law per weapon'));
export const WorldTargetsSchema = v.pipe(v.unknown(), v.check(isJsonData, 'plain JSON world targets'), v.strictObject({ targets,
  spots: v.pipe(v.array(v.strictObject({ id, at: v.tuple([coordinate, coordinate, coordinate]), yaw: v.pipe(finite, v.minValue(-2 * Math.PI), v.maxValue(2 * Math.PI)) })),
    v.maxLength(256), v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'unique world spot ids')) }));
export type WorldTargets = v.InferOutput<typeof WorldTargetsSchema>;
export type WorldTarget = WorldTargets['targets'][number];
/** Refuse callbacks, malformed shapes and ambiguous rules before touching the existing world owners. */
export function parseWorldTargets(input: unknown): WorldTargets { return v.parse(WorldTargetsSchema, input); }
/** One resolver for named contact/perch points, used by decision glue and the existing move runner. */
export function worldTargetSpots(input: WorldTargets): ReadonlyMap<string, { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number }> {
  return new Map(input.spots.map(row => [row.id, { x: row.at[0], y: row.at[1], z: row.at[2], yaw: row.yaw }]));
}
/** Every mechanic identity comes from the actual admitted item and interaction tables. */
export function worldTargetRules(input: WorldTargets, source: Pick<Shardfile, 'items' | 'quests' | 'questHost'>): string[] {
  const errors = new Set<string>(), flags = new Set(source.quests.flags), interactions = source.questHost?.interactions;
  const known = new Set([...flags, ...(interactions?.marks.map(row => row.id) ?? [])]);
  for (const row of input.targets) {
    const weapon = source.items.rows.find(item => item.id === row.weapon && item.kind === 'weapon');
    for (const name of [...row.needs?.all ?? [], ...row.needs?.any ?? [], ...row.needs?.none ?? []]) if (!known.has(name)) errors.add('world target condition names a declared flag or mark');
    for (const rule of row.rules) {
      if (weapon?.kind !== 'weapon' || !weapon.contacts?.some(move => move.hits[rule.contact]?.moveId === rule.move)) errors.add('world target move/contact resolves on its declared weapon');
      for (const effect of rule.effects) {
        if (effect.kind === 'flag' && !flags.has(effect.id)) errors.add('world target flag is declared');
        if (effect.kind === 'interaction' && !interactions?.rows.some(value => value.id === effect.id)) errors.add('world target interaction is declared');
      }
    }
  }
  return [...errors];
}
