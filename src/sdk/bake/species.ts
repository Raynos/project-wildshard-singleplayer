import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { readSpecies, SpeciesSchema, type SpeciesData } from '@wildshard/format/speciesPrograms';

/** Build-only extraction of gameplay fields from a resolved species. Visual variants stay with their look;
 * a species with native think/act callbacks refuses instead of silently discarding its behaviour. */
export function bakeSpecies(row: Omit<SpeciesRow, 'id'>, speciesId: string): SpeciesData {
  if (row.think !== undefined || row.act !== undefined) throw new Error('Species programmes require callback-free gameplay rows');
  const fields: Record<string, unknown> = { id: speciesId };
  for (const key of Object.keys(SpeciesSchema.entries)) {
    if (key === 'id' || key === 'variants' || key === 'spawnOnly' || !Object.hasOwn(row, key)) continue;
    const value: unknown = Reflect.get(row, key); fields[key] = value;
  }
  const variant = ({ id, label, weight, rarity, scale, hp, mods }: SpeciesRow['variants'][number]): SpeciesRow['variants'][number] =>
    ({ id, label, weight, rarity, scale, ...(hp === undefined ? {} : { hp }), ...(mods === undefined ? {} : { mods }) });
  fields['variants'] = row.variants.map(variant);
  if (row.spawnOnly !== undefined) fields['spawnOnly'] = row.spawnOnly.map(variant);
  return readSpecies(fields);
}
