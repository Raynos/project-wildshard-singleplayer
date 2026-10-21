import type { SpeciesDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import * as v from 'valibot';
import rows from '../data/speciesLooks.json' with { type: 'json' };
import { SpeciesLookBookSchema } from '@wildshard/format/speciesBookRows';
/** Build-only variant facts shared with the admitted body catalogue. */
export function bodySpecies(kind: string): Pick<SpeciesDef, 'kind' | 'label' | 'variants' | 'spawnOnly' | 'pose' | 'gait'> {
  const source = rows.find(row => row.metadata.kind === kind);
  if (source === undefined) throw new Error('Missing body species row');
  const row = v.parse(SpeciesLookBookSchema, { slug: 'nalati-grasslands', body: {}, rows: [source] }).rows[0];
  if (row === undefined) throw new Error('Missing admitted body species');
  const paint = (variant: VariantDef): VariantDef => {
    const view = row.variants[variant.id];
    return { ...variant, ...(view?.tint === undefined ? {} : { tint: view.tint }), ...(view?.traits === undefined ? {} : { traits: view.traits }) };
  };
  const variants = row.metadata.variants.map(paint);
  const spawnOnly = row.metadata.spawnOnly?.map(paint);
  return { ...row.metadata, variants, ...(spawnOnly === undefined ? {} : { spawnOnly }),
    ...(row.pose === undefined ? {} : { pose: row.pose }), ...(row.gait === undefined ? {} : { gait: row.gait }) };
}
