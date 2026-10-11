import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { SimStrike } from '@wildshard/engine/sim';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { ShardRows } from '@wildshard/format/rows';

/** Resolve both species and variant, preserving authored health and gameplay multipliers. */
export function speciesResolver(rows: ShardRows): (speciesId: string, variantId: string) => AnimalSimSpec {
  const catalogue = new Map(rows.species.map((row) => [row.id, row]));
  return (speciesId, variantId) => {
    const row = catalogue.get(speciesId), selected = row?.variants.find((variantRow) => variantRow.id === variantId);
    if (row === undefined || selected === undefined) throw new Error('Unresolved declared species/variant');
    return { kind: row.kind, label: selected.label, variant: selected.id, rarity: selected.rarity, hp: selected.hp, aggressive: row.aggressive, lockable: row.lockable,
      dims: { ...row.dims, feet: row.dims.feet.map(([x, z]) => [x, z]) }, mods: { ...selected.mods }, ...(row.flight === undefined ? {} : { flight: { ...row.flight } }) };
  };
}
/** Numeric strike rows feed the authoritative sim without a score callback. */
export function simStrikes(rows: ShardRows): ReadonlyMap<string, SimStrike> {
  return new Map(rows.strikes.map(({ weight: _weight, speed, ...row }) => [row.id, { ...row, motion: { speed } }]));
}
/** Legacy strike scoring is an engine-owned constant adapter over the declared weight. */
export function scoredStrikes(rows: ShardRows): readonly StrikeSpec[] {
  const numeric = simStrikes(rows);
  return rows.strikes.map((row) => { const spec = numeric.get(row.id); if (spec === undefined) throw new Error('Missing strike'); return { ...spec, weight: () => row.weight }; });
}
