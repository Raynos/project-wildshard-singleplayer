import * as v from 'valibot';
import { isJsonData } from './json';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(400));
const integer = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const positive = v.pipe(integer, v.minValue(1));
const reward = v.strictObject({ items: v.pipe(v.array(v.strictObject({ id: text, n: positive })), v.maxLength(16)),
  bolts: integer, skin: v.exactOptional(text) });
const target = v.strictObject({ kind: text, target: text });
/** Deterministic contract board policy and content. Selection laws and identities are authored rows. */
export const ContractCatalogueSchema = v.strictObject({
  id: text, store: text, slots: v.pipe(positive, v.maxValue(8)), attempts: v.pipe(positive, v.maxValue(256)),
  initial: v.array(target), fallback: target,
  draws: v.pipe(v.array(v.strictObject({ below: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)),
    kind: text, targets: v.pipe(v.array(text), v.minLength(1), v.maxLength(64)) })), v.minLength(1), v.maxLength(32)),
  ranks: v.record(text, integer), defaultRank: text,
  matches: v.pipe(v.array(v.strictObject({ kind: text, match: v.picklist(['species', 'rarity', 'elite', 'tag']),
    excludeTags: v.array(text), excludeElite: v.boolean(), belowRank: v.exactOptional(positive) })), v.minLength(1), v.maxLength(32)),
  milestones: v.pipe(v.array(v.strictObject({ claimed: positive, skin: text })), v.maxLength(32)),
  species: v.array(v.strictObject({ id: text, plural: text, need: positive, title: text })),
  rarity: v.array(v.strictObject({ id: text, need: positive, title: text })),
  elites: v.record(text, v.strictObject({ name: text, kind: text, variant: text })),
  eliteIds: v.array(text),
  rows: v.pipe(v.array(v.strictObject({ id: text, kind: text, target: text, need: positive,
    title: text, goal: text, reward })), v.minLength(1), v.maxLength(256)),
});
/** Successful claims return ids for the existing inventory and cosmetic owners. */
export type ContractReward = v.InferOutput<typeof reward>;
export type ContractCatalogue = v.InferOutput<typeof ContractCatalogueSchema>;
/** Admit the complete catalogue before creating state; duplicate and missing references refuse. */
export function parseContractCatalogue(input: unknown): ContractCatalogue {
  if (!isJsonData(input)) throw new Error('Contract catalogue must be plain JSON');
  const rows = v.parse(ContractCatalogueSchema, input);
  const has = (kind: string, value: string): boolean => rows.rows.some(row => row.kind === kind && row.target === value);
  if (new Set(rows.rows.map(row => row.id)).size !== rows.rows.length
    || new Set(rows.rows.map(row => JSON.stringify([row.kind, row.target]))).size !== rows.rows.length
    || new Set(rows.matches.map(row => row.kind)).size !== rows.matches.length
    || rows.rows.some(row => !rows.matches.some(match => match.kind === row.kind))
    || rows.draws.some((row, index) => (index > 0 && row.below <= (rows.draws[index - 1]?.below ?? 0))
      || row.targets.some(value => !has(row.kind, value)))
    || rows.draws.at(-1)?.below !== 1 || rows.initial.some(row => !has(row.kind, row.target))
    || !has(rows.fallback.kind, rows.fallback.target) || rows.ranks[rows.defaultRank] === undefined
    || new Set(rows.eliteIds).size !== rows.eliteIds.length || rows.eliteIds.length !== Object.keys(rows.elites).length
    || rows.eliteIds.some(id => rows.elites[id] === undefined)) throw new Error('Invalid contract catalogue references');
  return rows;
}
